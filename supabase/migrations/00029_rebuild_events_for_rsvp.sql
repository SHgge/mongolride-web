-- ============================================================
-- EP-03 Event Management + RSVP — schema rebuild
-- Хуучин simple events + event_participants table-уудыг устгаж
-- cycling-club шаардлагатай rich schema болгоно.
-- ============================================================

-- 1. Хуучин артефактуудыг устгах (cascade-аар хамаарал бүхий бүхнийг устгана)
drop trigger if exists event_participants_count on public.event_participants;
drop trigger if exists events_updated_at on public.events;
drop function if exists public.update_participant_count() cascade;
drop table if exists public.event_participants cascade;
drop table if exists public.events cascade;
drop type if exists event_status cascade;

-- 2. Шинэ events schema
create table public.events (
  id                          uuid primary key default gen_random_uuid(),
  series_id                   uuid,
  series_instance_index       integer,
  title                       text not null,
  description                 text default '',
  cover_photo_path            text,

  discipline                  text not null
    check (discipline in ('road','mtb','gravel','urban','commute','bikepacking','training','other')),
  skill_level                 text not null
    check (skill_level in ('beginner','intermediate','advanced','expert','all')),
  effort_zone                 text
    check (effort_zone is null or effort_zone in ('z1','z2','z3','z4','z5','mixed')),
  pace_min_kmh                numeric(4,1),
  pace_max_kmh                numeric(4,1),
  drop_policy                 text not null default 'no_drop'
    check (drop_policy in ('drop','no_drop','regroup')),

  meet_at                     timestamptz not null,
  roll_out_at                 timestamptz not null,
  end_at                      timestamptz,
  meet_location_name          text not null,
  meet_lat                    double precision,
  meet_lng                    double precision,

  distance_km                 numeric(6,2),
  elevation_gain_m            integer,
  surface_asphalt_pct         integer check (surface_asphalt_pct between 0 and 100),
  surface_gravel_pct          integer check (surface_gravel_pct between 0 and 100),
  surface_dirt_pct            integer check (surface_dirt_pct between 0 and 100),

  required_gear               text[] not null default array[]::text[],
  has_sag                     boolean not null default false,
  has_mechanical_support      boolean not null default false,

  capacity                    integer,
  allow_guests                boolean not null default false,
  max_guests_per_member       integer not null default 0,
  cancellation_deadline_hours integer not null default 24,
  fee_amount                  integer not null default 0,
  visibility                  text not null default 'public'
    check (visibility in ('public','members','invitation')),

  status                      text not null default 'draft'
    check (status in ('draft','published','cancelled','completed')),
  cancellation_reason         text,

  organizer_id                uuid not null references auth.users(id),
  co_organizer_ids            uuid[] not null default array[]::uuid[],
  sweep_rider_id              uuid references auth.users(id),

  -- Cross-epic stubs
  route_id                    uuid,
  buddy_pairing_enabled       boolean not null default false,
  live_tracking_enabled       boolean not null default false,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint surface_pct_total check (
    coalesce(surface_asphalt_pct,0)
    + coalesce(surface_gravel_pct,0)
    + coalesce(surface_dirt_pct,0) <= 100
  ),
  constraint roll_out_after_meet check (roll_out_at >= meet_at),
  constraint end_after_roll_out check (end_at is null or end_at >= roll_out_at),
  constraint pace_range_valid check (
    pace_min_kmh is null or pace_max_kmh is null or pace_max_kmh >= pace_min_kmh
  ),
  constraint guest_capacity_positive check (max_guests_per_member >= 0),
  constraint capacity_positive check (capacity is null or capacity > 0)
);

create index events_status_idx       on public.events(status);
create index events_meet_at_idx      on public.events(meet_at);
create index events_visibility_idx   on public.events(visibility);
create index events_discipline_idx   on public.events(discipline);
create index events_organizer_idx    on public.events(organizer_id);
create index events_series_idx       on public.events(series_id);

alter table public.events enable row level security;

create policy "anyone reads published public events"
  on public.events for select
  using (
    status in ('published','completed','cancelled')
    and visibility = 'public'
  );

create policy "members read members events"
  on public.events for select
  using (
    status in ('published','completed','cancelled')
    and visibility = 'members'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('member','admin')
    )
  );

create policy "organizers read own events"
  on public.events for select
  using (
    auth.uid() = organizer_id
    or auth.uid() = any(co_organizer_ids)
  );

create policy "admins read all events"
  on public.events for select
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

create policy "admins insert events"
  on public.events for insert
  with check (
    auth.uid() = organizer_id
    and exists (select 1 from public.profiles
                where id = auth.uid() and role = 'admin')
  );

create policy "organizers and admins update events"
  on public.events for update
  using (
    auth.uid() = organizer_id
    or auth.uid() = any(co_organizer_ids)
    or exists (select 1 from public.profiles
               where id = auth.uid() and role = 'admin')
  );

create policy "admins delete events"
  on public.events for delete
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

-- 3. Event RSVPs
create table public.event_rsvps (
  id                       uuid primary key default gen_random_uuid(),
  event_id                 uuid not null references public.events(id) on delete cascade,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  status                   text not null
    check (status in ('confirmed','waitlist','cancelled','pending_payment','no_show','attended')),
  waitlist_position        integer,
  guest_count              integer not null default 0
    check (guest_count >= 0),

  liability_accepted_at    timestamptz,
  gear_confirmed_at        timestamptz,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  notes                    text check (notes is null or length(notes) <= 500),

  cancelled_at             timestamptz,
  cancellation_reason      text,
  checked_in_at            timestamptz,
  check_in_token           uuid not null default gen_random_uuid(),

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (event_id, user_id)
);

create index event_rsvps_event_status_idx on public.event_rsvps(event_id, status);
create index event_rsvps_user_idx on public.event_rsvps(user_id);
create index event_rsvps_waitlist_idx on public.event_rsvps(event_id, waitlist_position)
  where status = 'waitlist';

alter table public.event_rsvps enable row level security;

create policy "users read own rsvps"
  on public.event_rsvps for select
  using (auth.uid() = user_id);

create policy "organizers read own event rsvps"
  on public.event_rsvps for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_rsvps.event_id
        and (e.organizer_id = auth.uid() or auth.uid() = any(e.co_organizer_ids))
    )
  );

create policy "admins read all rsvps"
  on public.event_rsvps for select
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

create policy "admins update rsvps"
  on public.event_rsvps for update
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );
-- Inserts/updates only via security-definer functions in 00030

-- 4. Recurring event series
create table public.event_series (
  id                  uuid primary key default gen_random_uuid(),
  template            jsonb not null,
  recurrence_rule     text not null,
  start_date          date not null,
  end_date            date,
  occurrence_count    integer,
  last_generated_at   timestamptz,
  organizer_id        uuid not null references auth.users(id),
  created_at          timestamptz not null default now()
);

alter table public.event_series enable row level security;

create policy "admins manage series"
  on public.event_series for all
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

-- 5. Realtime publications (idempotent)
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.event_rsvps;
exception when duplicate_object then null; end $$;

-- 6. Notifications type CHECK update — RSVP types нэмэх
do $$ begin
  alter table public.notifications drop constraint if exists notifications_type_check;
exception when others then null; end $$;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'event','sos','marketplace','route','system','achievement',
    'rsvp.confirmed','rsvp.promoted','rsvp.waitlist','rsvp.cancelled',
    'event.reminder','event.cancelled'
  ));
