-- ============================================================
-- EP-04 P1-5 fix v2: event_rsvp_counts-ийг сайжруулах
--   1. Visibility check-аас болж empty row буцааж байсныг засна — үргэлж
--      нэг row буцаах (count нь өөрөө PII задлахгүй).
--   2. "confirmed_count" нь capacity эзэлж буй бүх RSVP-ыг тоолно
--      (confirmed + pending_payment + attended), waitlist-ийг тусад нь.
-- ============================================================

drop function if exists public.event_rsvp_counts(uuid);

create or replace function public.event_rsvp_counts(p_event_id uuid)
returns table (
  confirmed_count integer,
  waitlist_count  integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select count(*)::int from public.event_rsvps r
      where r.event_id = p_event_id
        and r.status in ('confirmed', 'pending_payment', 'attended')
    ), 0) as confirmed_count,
    coalesce((
      select count(*)::int from public.event_rsvps r
      where r.event_id = p_event_id
        and r.status = 'waitlist'
    ), 0) as waitlist_count;
$$;

grant execute on function public.event_rsvp_counts(uuid)
  to anon, authenticated, service_role;
