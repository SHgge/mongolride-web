-- ============================================================
-- EP-03: rsvp_event + cancel_rsvp postgres functions (atomic)
-- ============================================================

create or replace function public.rsvp_event(
  p_event_id          uuid,
  p_guest_count       integer default 0,
  p_emergency_name    text default null,
  p_emergency_phone   text default null,
  p_liability_ack     boolean default false,
  p_gear_confirmed    boolean default false,
  p_notes             text default null
) returns table (
  rsvp_id           uuid,
  status            text,
  waitlist_position integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event              record;
  v_user_role          text;
  v_seat_count         integer;
  v_existing_rsvp      record;
  v_confirmed_seats    integer;
  v_next_waitlist_pos  integer;
  v_new_status         text;
  v_new_waitlist_pos   integer;
  v_rsvp_id            uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in' using errcode = 'P0001';
  end if;

  if not p_liability_ack then
    raise exception 'Liability acknowledgment required' using errcode = 'P0010';
  end if;
  if not p_gear_confirmed then
    raise exception 'Gear confirmation required' using errcode = 'P0011';
  end if;
  if p_emergency_name is null or trim(p_emergency_name) = ''
     or p_emergency_phone is null or trim(p_emergency_phone) = '' then
    raise exception 'Emergency contact required' using errcode = 'P0012';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id and status = 'published'
  for update;

  if not found then
    raise exception 'Event not found or not published' using errcode = 'P0002';
  end if;

  select role into v_user_role from public.profiles where id = auth.uid();
  if v_event.visibility = 'members' and coalesce(v_user_role, '') not in ('member','admin') then
    raise exception 'This event is members-only' using errcode = 'P0013';
  end if;

  if p_guest_count > 0 and not v_event.allow_guests then
    raise exception 'Guests not allowed' using errcode = 'P0014';
  end if;
  if p_guest_count > v_event.max_guests_per_member then
    raise exception 'Too many guests (max %)', v_event.max_guests_per_member
      using errcode = 'P0015';
  end if;

  v_seat_count := 1 + p_guest_count;

  select * into v_existing_rsvp
  from public.event_rsvps
  where event_id = p_event_id and user_id = auth.uid()
  for update;

  if found and v_existing_rsvp.status in ('confirmed','waitlist','pending_payment') then
    raise exception 'You already have an active RSVP' using errcode = 'P0016';
  end if;

  if v_event.capacity is not null then
    select coalesce(sum(1 + guest_count), 0) into v_confirmed_seats
    from public.event_rsvps
    where event_id = p_event_id and status = 'confirmed';

    if v_confirmed_seats + v_seat_count <= v_event.capacity then
      v_new_status := case when v_event.fee_amount > 0 then 'pending_payment' else 'confirmed' end;
      v_new_waitlist_pos := null;
    else
      v_new_status := 'waitlist';
      select coalesce(max(waitlist_position), 0) + 1 into v_next_waitlist_pos
      from public.event_rsvps where event_id = p_event_id;
      v_new_waitlist_pos := v_next_waitlist_pos;
    end if;
  else
    v_new_status := case when v_event.fee_amount > 0 then 'pending_payment' else 'confirmed' end;
    v_new_waitlist_pos := null;
  end if;

  if found then
    update public.event_rsvps
       set status = v_new_status,
           waitlist_position = v_new_waitlist_pos,
           guest_count = p_guest_count,
           liability_accepted_at = now(),
           gear_confirmed_at = now(),
           emergency_contact_name = p_emergency_name,
           emergency_contact_phone = p_emergency_phone,
           notes = p_notes,
           cancelled_at = null,
           cancellation_reason = null,
           updated_at = now()
     where id = v_existing_rsvp.id
     returning id into v_rsvp_id;
  else
    insert into public.event_rsvps (
      event_id, user_id, status, waitlist_position, guest_count,
      liability_accepted_at, gear_confirmed_at,
      emergency_contact_name, emergency_contact_phone, notes
    ) values (
      p_event_id, auth.uid(), v_new_status, v_new_waitlist_pos, p_guest_count,
      now(), now(), p_emergency_name, p_emergency_phone, p_notes
    ) returning id into v_rsvp_id;
  end if;

  return query select v_rsvp_id, v_new_status, v_new_waitlist_pos;
end;
$$;

grant execute on function public.rsvp_event(uuid,integer,text,text,boolean,boolean,text)
  to authenticated;

-- ============================================================
-- cancel_rsvp + auto-promote first waitlist
-- ============================================================
create or replace function public.cancel_rsvp(
  p_event_id uuid,
  p_reason   text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event       record;
  v_now         timestamptz := now();
  v_promote_id  uuid;
  v_is_admin    boolean;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in' using errcode = 'P0001';
  end if;

  select * into v_event from public.events
   where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  v_is_admin := exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');

  if v_now > v_event.meet_at - (v_event.cancellation_deadline_hours || ' hours')::interval
     and not v_is_admin then
    raise exception 'Cancellation deadline has passed' using errcode = 'P0017';
  end if;

  update public.event_rsvps
     set status = 'cancelled',
         cancelled_at = v_now,
         cancellation_reason = p_reason,
         updated_at = v_now
   where event_id = p_event_id and user_id = auth.uid()
     and status in ('confirmed','waitlist','pending_payment');

  -- Promote first waitlist
  select id into v_promote_id
  from public.event_rsvps
  where event_id = p_event_id and status = 'waitlist'
  order by waitlist_position asc
  limit 1
  for update;

  if v_promote_id is not null then
    update public.event_rsvps
       set status = case when v_event.fee_amount > 0 then 'pending_payment' else 'confirmed' end,
           waitlist_position = null,
           updated_at = v_now
     where id = v_promote_id;

    insert into public.notifications (user_id, type, title, message, link)
    select user_id,
           'rsvp.promoted',
           'Сайн мэдээ — та эвентэд бүртгүүллээ',
           'Хүлээгдэж байсан хүсэлт чинь зөвшөөрөгдлөө: ' || v_event.title,
           '/events/' || v_event.id
    from public.event_rsvps where id = v_promote_id;
  end if;
end;
$$;

grant execute on function public.cancel_rsvp(uuid,text) to authenticated;
