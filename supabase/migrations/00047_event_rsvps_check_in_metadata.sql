-- ============================================================
-- EP-09 P0-1: check-in metadata columns on event_rsvps
-- (check_in_token already exists from EP-03 / migration 00029)
-- ============================================================

alter table public.event_rsvps
  add column if not exists checked_in_method text
    check (checked_in_method is null
           or checked_in_method in ('qr','manual','self','wallet')),
  add column if not exists checked_in_by uuid references auth.users(id) on delete set null,
  add column if not exists checked_in_late boolean,
  add column if not exists checked_in_override boolean not null default false,
  add column if not exists checked_in_lat double precision,
  add column if not exists checked_in_lng double precision;

create index if not exists event_rsvps_check_in_idx
  on public.event_rsvps(event_id, checked_in_at)
  where checked_in_at is not null;
