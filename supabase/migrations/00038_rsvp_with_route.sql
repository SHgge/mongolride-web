-- ============================================================
-- EP-04 P1-5: rsvp_event-д selected_route_id нэмж, multi-route
-- эвентийн үед оролцогчид аль маршрутаар явахаа сонгох боломжтой болгоно.
-- ============================================================

drop function if exists public.rsvp_event(uuid, integer, text, text, boolean, boolean, text);

create or replace function public.rsvp_event(
  p_event_id          uuid,
  p_guest_count       integer default 0,
  p_emergency_name    text default null,
  p_emergency_phone   text default null,
  p_liability_ack     boolean default false,
  p_gear_confirmed    boolean default false,
  p_notes             text default null,
  p_selected_route_id uuid default null
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
  v_route_count        integer;
  v_route_valid        boolean;
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

  -- Route validation
  select count(*) into v_route_count
    from public.event_routes where event_id = p_event_id;

  if v_route_count > 0 then
    -- Эвент-д хавсаргасан route байгаа бол сонголт зайлшгүй биш — null үлдээж болно
    -- (хэрэглэгч хүсвэл сонгоно). Гэхдээ оруулсан id нь тухайн event-д зөвшөөрөгдсөн байх ёстой.
    if p_selected_route_id is not null then
      select exists (
        select 1 from public.event_routes
        where event_id = p_event_id and route_id = p_selected_route_id
      ) into v_route_valid;
      if not v_route_valid then
        raise exception 'Selected route is not part of this event' using errcode = 'P0018';
      end if;
    end if;
  else
    -- Routes хавсаргаагүй бол id заавал null байх ёстой
    if p_selected_route_id is not null then
      raise exception 'This event has no route options' using errcode = 'P0019';
    end if;
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
           selected_route_id = p_selected_route_id,
           cancelled_at = null,
           cancellation_reason = null,
           updated_at = now()
     where id = v_existing_rsvp.id
     returning id into v_rsvp_id;
  else
    insert into public.event_rsvps (
      event_id, user_id, status, waitlist_position, guest_count,
      liability_accepted_at, gear_confirmed_at,
      emergency_contact_name, emergency_contact_phone, notes,
      selected_route_id
    ) values (
      p_event_id, auth.uid(), v_new_status, v_new_waitlist_pos, p_guest_count,
      now(), now(), p_emergency_name, p_emergency_phone, p_notes,
      p_selected_route_id
    ) returning id into v_rsvp_id;
  end if;

  return query select v_rsvp_id, v_new_status, v_new_waitlist_pos;
end;
$$;

grant execute on function public.rsvp_event(
  uuid, integer, text, text, boolean, boolean, text, uuid
) to authenticated;
