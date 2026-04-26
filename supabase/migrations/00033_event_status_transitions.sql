-- EP-03 P0-2: Event status transition guards, capacity reduction guard,
-- and notification type allowlist for cancellation events.

-- ============================================================
-- 1) Status transition guard
-- ============================================================
create or replace function public.change_event_status(
  p_event_id uuid,
  p_new_status text,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_user_role text;
begin
  -- Auth check
  select role into v_user_role from public.profiles where id = auth.uid();
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;

  if v_user_role <> 'admin'
     and v_event.organizer_id <> auth.uid()
     and not (auth.uid() = any(v_event.co_organizer_ids)) then
    raise exception 'Forbidden' using errcode = 'P0003';
  end if;

  -- Allowed transitions
  if v_event.status = 'draft' and p_new_status not in ('published','cancelled') then
    raise exception 'From draft only published or cancelled allowed' using errcode = 'P0020';
  end if;
  if v_event.status = 'published' and p_new_status not in ('cancelled','completed') then
    raise exception 'From published only cancelled or completed allowed' using errcode = 'P0021';
  end if;
  if v_event.status = 'cancelled' then
    raise exception 'Cancelled events cannot be reactivated' using errcode = 'P0022';
  end if;
  if v_event.status = 'completed' then
    raise exception 'Completed events cannot change status' using errcode = 'P0023';
  end if;

  update public.events
     set status = p_new_status,
         cancellation_reason = case when p_new_status = 'cancelled' then p_reason else cancellation_reason end,
         updated_at = now()
   where id = p_event_id;
end;
$$;

grant execute on function public.change_event_status(uuid, text, text) to authenticated;

-- ============================================================
-- 2) Block capacity reduction below confirmed count
-- ============================================================
create or replace function public.check_capacity_reduction()
returns trigger language plpgsql as $$
declare
  v_confirmed_seats integer;
begin
  if new.capacity is not null
     and (old.capacity is null or new.capacity < old.capacity) then
    select coalesce(sum(1 + guest_count), 0) into v_confirmed_seats
    from public.event_rsvps
    where event_id = new.id and status = 'confirmed';

    if v_confirmed_seats > new.capacity then
      raise exception 'Cannot reduce capacity below confirmed count (% confirmed)', v_confirmed_seats
        using errcode = 'P0024';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists events_check_capacity on public.events;
create trigger events_check_capacity
  before update of capacity on public.events
  for each row execute function public.check_capacity_reduction();

-- ============================================================
-- 3) Update notifications type CHECK to allow cancellation type
-- ============================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'event','sos','marketplace','route','system','achievement',
    'rsvp.confirmed','rsvp.promoted','rsvp.waitlist','rsvp.cancelled',
    'event.reminder','event.cancelled',
    'event.reminder.t_minus_24h','event.reminder.t_minus_3h','event.reminder.t_minus_30m'
  ));
