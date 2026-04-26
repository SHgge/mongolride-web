-- ============================================================
-- P0-1: хуучин events дахь буруу bucket cover_photo_path-уудыг null болгох
-- (event-assets bucket-руу re-upload хийнэ)
-- P0-3: visibility CHECK constraint-ээс 'invitation'-ийг хасах
-- ============================================================

-- 1. Cover photo paths reset (test data only — production-д careful)
update public.events
set cover_photo_path = null
where cover_photo_path is not null;

-- 2. Block 'invitation' visibility (V1.2-д буцааж нээнэ)
alter table public.events drop constraint if exists events_visibility_check;

alter table public.events add constraint events_visibility_check
  check (visibility in ('public', 'members'));

-- Хэрэв ямар нэг row 'invitation' статустай байсан бол members руу шилжүүлье
update public.events set visibility = 'members' where visibility = 'invitation';

-- 3. P0-4 prep: event_rsvps дээр reminders_sent column нэмэх (idempotency for cron)
alter table public.event_rsvps
  add column if not exists reminders_sent text[] not null default array[]::text[];
