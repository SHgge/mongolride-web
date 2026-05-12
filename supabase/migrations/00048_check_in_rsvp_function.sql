-- ============================================================
-- EP-09 P0-2: check_in_rsvp atomic function
--
-- Authorisation: caller must be admin OR event organizer / co-organizer /
-- sweep_rider for the given event.
--
-- Idempotent: scanning the same QR twice returns 'already_checked_in'.
-- Time-window guard: T-2h .. T+6h around meet_at; override flag bypasses.
-- ============================================================

create or replace function public.check_in_rsvp(
  p_token       uuid,
  p_event_id    uuid,
  p_method      text default 'qr',
  p_override    boolean default false,
  p_lat         double precision default null,
  p_lng         double precision default null
) returns table (
  rsvp_id           uuid,
  user_id           uuid,
  user_name         text,
  status            text,
  checked_in_at     timestamptz,
  late              boolean,
  message           text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_event       record;
  v_rsvp        record;
  v_now         timestamptz := now();
  v_late        boolean;
  v_in_window   boolean;
  v_user_name   text;
begin
  -- Authentication
  if auth.uid() is null then
    return query select null::uuid, null::uuid, null::text, 'forbidden'::text,
                        null::timestamptz, null::boolean, 'Not signed in'::text;
    return;
  end if;

  if p_method is not null and p_method not in ('qr','manual','self','wallet') then
    return query select null::uuid, null::uuid, null::text, 'token_invalid'::text,
                        null::timestamptz, null::boolean, 'Invalid method'::text;
    return;
  end if;

  -- Authorisation: caller must be admin OR scoped role on this event
  select role into v_caller_role from public.profiles where id = auth.uid();
  select * into v_event from public.events e where e.id = p_event_id;

  if not found then
    return query select null::uuid, null::uuid, null::text, 'wrong_event'::text,
                        null::timestamptz, null::boolean, 'Event not found'::text;
    return;
  end if;

  if not (
    v_caller_role = 'admin'
    or v_event.organizer_id = auth.uid()
    or auth.uid() = any(v_event.co_organizer_ids)
    or v_event.sweep_rider_id = auth.uid()
  ) then
    return query select null::uuid, null::uuid, null::text, 'forbidden'::text,
                        null::timestamptz, null::boolean, 'Not authorised to scan'::text;
    return;
  end if;

  -- Lock the RSVP by token
  select * into v_rsvp
  from public.event_rsvps r
  where r.check_in_token = p_token
  for update;

  if not found then
    return query select null::uuid, null::uuid, null::text, 'token_invalid'::text,
                        null::timestamptz, null::boolean, 'QR is invalid'::text;
    return;
  end if;

  if v_rsvp.event_id <> p_event_id then
    return query select v_rsvp.id, v_rsvp.user_id, null::text, 'wrong_event'::text,
                        null::timestamptz, null::boolean,
                        'This QR is for a different event'::text;
    return;
  end if;

  if v_rsvp.status = 'cancelled' then
    return query select v_rsvp.id, v_rsvp.user_id, null::text, 'cancelled'::text,
                        null::timestamptz, null::boolean,
                        'RSVP was cancelled'::text;
    return;
  end if;

  if v_rsvp.status = 'pending_payment' then
    return query select v_rsvp.id, v_rsvp.user_id, null::text, 'payment_pending'::text,
                        null::timestamptz, null::boolean,
                        'Payment not confirmed'::text;
    return;
  end if;

  -- Resolve display name once (used in both already_checked_in + checked_in branches)
  select coalesce(p.full_name, '')
    into v_user_name
    from public.profiles p
   where p.id = v_rsvp.user_id;

  -- Idempotent: already checked in
  if v_rsvp.checked_in_at is not null then
    return query select v_rsvp.id, v_rsvp.user_id, v_user_name,
                        'already_checked_in'::text,
                        v_rsvp.checked_in_at, v_rsvp.checked_in_late,
                        'Already checked in'::text;
    return;
  end if;

  -- Time window guard
  v_in_window :=
    v_now between (v_event.meet_at - interval '2 hours')
              and (v_event.meet_at + interval '6 hours');
  if not v_in_window and not p_override then
    return query select v_rsvp.id, v_rsvp.user_id, v_user_name,
                        'outside_window'::text,
                        null::timestamptz, null::boolean,
                        'Outside check-in window. Override required.'::text;
    return;
  end if;

  v_late := v_now > v_event.meet_at + interval '15 minutes';

  update public.event_rsvps r
     set status = 'attended',
         checked_in_at = v_now,
         checked_in_method = p_method,
         checked_in_by = auth.uid(),
         checked_in_late = v_late,
         checked_in_override = p_override,
         checked_in_lat = p_lat,
         checked_in_lng = p_lng,
         updated_at = v_now
   where r.id = v_rsvp.id;

  return query select v_rsvp.id, v_rsvp.user_id, v_user_name,
                      'checked_in'::text,
                      v_now, v_late,
                      case when v_late then 'Checked in (late)'::text
                                       else 'Checked in'::text end;
end;
$$;

grant execute on function public.check_in_rsvp(
  uuid, uuid, text, boolean, double precision, double precision
) to authenticated;
