-- ============================================================
-- EP-05 P0-1: Weather & Environmental Intelligence — schema
--   weather_snapshots: coarse-grid cache (~5.5km / 1h)
--   event_alerts: weather-driven actionable alerts
--   profile_weather_prefs: per-user notification preferences
-- ============================================================

-- ------------------------------------------------------------
-- 1. weather_snapshots
-- ------------------------------------------------------------
create table public.weather_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  -- Coarse spatial key: 0.05° (~5.5 km) for dedup
  lat_grid            numeric(7,3) not null,
  lng_grid            numeric(7,3) not null,
  -- Coarse temporal key: floor to hour (UTC)
  hour_bucket         timestamptz not null,
  -- Provenance
  provider            text not null
    check (provider in ('open-meteo','iqair','aqicn','cached')),
  fetched_at          timestamptz not null default now(),
  is_stale            boolean not null default false,

  -- Weather
  temp_c              numeric(4,1),
  feels_like_c        numeric(4,1),
  wind_speed_ms       numeric(4,1),
  wind_dir_deg        integer,
  wind_gust_ms        numeric(4,1),
  precip_prob_pct     integer,
  precip_amount_mm    numeric(5,2),
  humidity_pct        integer,
  pressure_hpa        numeric(6,1),
  cloud_cover_pct     integer,
  visibility_km       numeric(4,1),

  -- Air quality (US EPA scale)
  aqi_us              integer,
  pm25_ugm3           numeric(5,1),
  pm10_ugm3           numeric(5,1),
  o3_ugm3             numeric(5,1),
  no2_ugm3            numeric(5,1),

  -- UV / thunderstorm / sun
  uv_index              numeric(3,1),
  thunderstorm_prob_pct integer,
  sunrise_at            timestamptz,
  sunset_at             timestamptz,

  raw_payload         jsonb,

  unique (lat_grid, lng_grid, hour_bucket, provider)
);

create index weather_snapshots_grid_hour_idx
  on public.weather_snapshots(lat_grid, lng_grid, hour_bucket);
create index weather_snapshots_fetched_idx
  on public.weather_snapshots(fetched_at desc);

alter table public.weather_snapshots enable row level security;

create policy "anyone reads weather snapshots"
  on public.weather_snapshots for select using (true);
-- inserts/updates only via service role (Edge Functions)

-- ------------------------------------------------------------
-- 2. event_alerts
-- ------------------------------------------------------------
create table public.event_alerts (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  alert_type          text not null
    check (alert_type in (
      'cold','heat','wind','aqi','dust','rain','snow',
      'thunderstorm','uv','reroute_suggested'
    )),
  severity            text not null
    check (severity in ('info','warning','severe','hazardous','cancel_recommended')),
  triggered_at        timestamptz not null default now(),
  forecast_window     text not null
    check (forecast_window in ('t_minus_72h','t_minus_24h','t_minus_6h','t_minus_2h','live')),
  values_snapshot     jsonb not null,
  acknowledged_at     timestamptz,
  acknowledged_by     uuid references auth.users(id) on delete set null,
  acknowledgment_note text,
  resolved_at         timestamptz,

  unique (event_id, alert_type, severity, forecast_window)
);

create index event_alerts_event_idx on public.event_alerts(event_id);
create index event_alerts_unresolved_idx
  on public.event_alerts(event_id, severity)
  where resolved_at is null;

alter table public.event_alerts enable row level security;

create policy "users read alerts for visible events"
  on public.event_alerts for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_alerts.event_id
        and (
          (e.status in ('published','completed','cancelled')
            and (
              e.visibility = 'public'
              or (e.visibility = 'members' and exists (
                    select 1 from public.profiles p
                    where p.id = auth.uid() and p.role in ('member','admin')
                  ))
            ))
          or e.organizer_id = auth.uid()
          or auth.uid() = any(e.co_organizer_ids)
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
          )
        )
    )
  );

create policy "admins ack/resolve alerts"
  on public.event_alerts for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
-- Inserts only via service role (Edge Functions)

do $$ begin
  alter publication supabase_realtime add table public.event_alerts;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 3. profile_weather_prefs
-- ------------------------------------------------------------
create table public.profile_weather_prefs (
  user_id                         uuid primary key references auth.users(id) on delete cascade,
  notifications_enabled           boolean not null default true,
  cold_threshold_c                numeric(4,1) not null default -25,
  wind_threshold_ms               numeric(4,1) not null default 15,
  aqi_threshold                   integer not null default 100,
  notify_on_yellow                boolean not null default false,
  notify_on_orange                boolean not null default true,
  notify_on_red                   boolean not null default true,
  notify_on_black                 boolean not null default true,
  preferred_notification_channels text[] not null default array['in_app','email']::text[],
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

alter table public.profile_weather_prefs enable row level security;

create policy "users manage own weather prefs"
  on public.profile_weather_prefs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "admins read all weather prefs"
  on public.profile_weather_prefs for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Auto-create default prefs when a profile is created
create or replace function public.create_default_weather_prefs()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_weather_prefs(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_weather_prefs on public.profiles;
create trigger profiles_create_weather_prefs
  after insert on public.profiles
  for each row execute function public.create_default_weather_prefs();

-- Backfill existing profiles
insert into public.profile_weather_prefs(user_id)
  select id from public.profiles
  on conflict (user_id) do nothing;

-- updated_at touch trigger
create trigger profile_weather_prefs_updated_at
  before update on public.profile_weather_prefs
  for each row execute function update_updated_at();

-- ------------------------------------------------------------
-- 4. Notifications type CHECK update — weather alert types
-- ------------------------------------------------------------
do $$ begin
  alter table public.notifications drop constraint if exists notifications_type_check;
exception when others then null; end $$;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'event','sos','marketplace','route','system','achievement',
    'rsvp.confirmed','rsvp.promoted','rsvp.waitlist','rsvp.cancelled',
    'event.reminder','event.cancelled',
    'event.reminder.t_minus_24h','event.reminder.t_minus_3h','event.reminder.t_minus_30m',
    'weather.alert','weather.reroute_suggested'
  ));
