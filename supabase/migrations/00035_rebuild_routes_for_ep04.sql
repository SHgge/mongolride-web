-- ============================================================
-- EP-04 P0-1: Routes + Maps + Elevation — schema rebuild
-- Хуучин simple routes/route_ratings table-уудыг устгаж rich schema
-- (PostGIS LineString path, climbs jsonb, surface breakdown, difficulty)
-- + route_completions, route_photos, event_routes тогтворжуулна.
-- PostGIS extension 00002-д аль хэдийн enabled.
-- ============================================================

-- 1. Хуучин артефактуудыг бүхэлд нь устгах
drop table if exists public.route_ratings cascade;
drop table if exists public.routes cascade;
drop type if exists surface_type cascade;
drop type if exists route_status cascade;

-- 2. Шинэ rich routes schema
create table public.routes (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null,
  description              text default '',

  -- Geometry (PostGIS)
  -- path: бүх trackpoint-ыг хадгална. Geometry (geography биш) — ST_DWithin
  -- spatial-index ашиглана. CRS 4326 (WGS84 lat/lng).
  path                     geometry(LineString, 4326) not null,
  start_point              geography(Point, 4326),
  end_point                geography(Point, 4326),
  bbox_geog                geography(Polygon, 4326),

  -- Computed metrics (parse-gpx Edge Function-ээс хийгдэнэ)
  distance_km              numeric(7,2) not null,
  elevation_gain_m         integer not null default 0,
  elevation_loss_m         integer not null default 0,
  max_elevation_m          integer,
  min_elevation_m          integer,
  avg_grade_pct            numeric(4,2),
  max_grade_pct            numeric(4,2),

  -- Climbs (extracted segments: [{start_km, end_km, length_km, gain_m, avg_grade, max_grade, category}])
  climbs                   jsonb not null default '[]'::jsonb,

  -- Surface classification (Overpass-аас бөглөнө: {asphalt:60, gravel:30, dirt:10})
  surface_breakdown        jsonb not null default '{}'::jsonb,
  surface_classified_at    timestamptz,

  -- Difficulty (auto-computed via compute_route_difficulty)
  difficulty_score         numeric(4,2),
  difficulty_label         text check (difficulty_label in ('easy','moderate','hard','expert')),

  -- Discipline / topology
  discipline               text not null
    check (discipline in ('road','mtb','gravel','urban','commute','bikepacking','training','other')),
  loop_type                text check (loop_type in ('loop','out_and_back','point_to_point')),

  -- GPX storage paths
  gpx_path                 text,
  cleaned_gpx_path         text,

  -- Cover photo
  cover_photo_path         text,

  -- Geographic context
  region                   text,
  country                  text not null default 'Mongolia',

  -- Visibility / status
  visibility               text not null default 'public'
    check (visibility in ('public','members','private')),
  status                   text not null default 'draft'
    check (status in ('draft','published','archived')),

  -- Authorship
  created_by               uuid not null references auth.users(id) on delete restrict,

  -- Stats (denormalized for browse perf)
  completion_count         integer not null default 0,
  photo_count              integer not null default 0,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint routes_distance_positive check (distance_km > 0),
  constraint routes_elevation_nonneg check (
    elevation_gain_m >= 0 and elevation_loss_m >= 0
  )
);

-- Spatial indices
create index routes_path_gix          on public.routes using gist (path);
create index routes_bbox_gix          on public.routes using gist (bbox_geog);
create index routes_start_gix         on public.routes using gist (start_point);
-- Filter indices
create index routes_status_idx        on public.routes(status);
create index routes_visibility_idx    on public.routes(visibility);
create index routes_discipline_idx    on public.routes(discipline);
create index routes_difficulty_idx    on public.routes(difficulty_label);
create index routes_distance_idx      on public.routes(distance_km);
create index routes_region_idx        on public.routes(region);
create index routes_created_by_idx    on public.routes(created_by);

-- 3. Route completions (хэрэглэгч энэ маршрутыг туулсан тэмдэглэл)
create table public.route_completions (
  id                  uuid primary key default gen_random_uuid(),
  route_id            uuid not null references public.routes(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  event_id            uuid references public.events(id) on delete set null,

  ridden_at           timestamptz not null,
  duration_seconds    integer check (duration_seconds is null or duration_seconds > 0),
  avg_speed_kmh       numeric(5,2),
  notes               text check (notes is null or length(notes) <= 1000),
  rating              integer check (rating is null or rating between 1 and 5),

  -- Optional GPX of the ride itself (for matching against route)
  ride_gpx_path       text,

  created_at          timestamptz not null default now()
);

create index route_completions_route_idx on public.route_completions(route_id);
create index route_completions_user_idx  on public.route_completions(user_id);
create index route_completions_event_idx on public.route_completions(event_id);

-- 4. Route photos (multiple per route, optional km marker)
create table public.route_photos (
  id              uuid primary key default gen_random_uuid(),
  route_id        uuid not null references public.routes(id) on delete cascade,
  uploaded_by     uuid not null references auth.users(id) on delete cascade,
  photo_path      text not null,
  caption         text check (caption is null or length(caption) <= 500),
  km_marker       numeric(7,2),
  taken_at        timestamptz,
  created_at      timestamptz not null default now()
);

create index route_photos_route_idx on public.route_photos(route_id);

-- 5. Event-Routes many-to-many (event-д хэд хэдэн route option санал болгож болно)
create table public.event_routes (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  route_id        uuid not null references public.routes(id) on delete restrict,
  is_primary      boolean not null default false,
  display_order   integer not null default 0,
  label           text,                                          -- "Урт", "Богино", etc.
  created_at      timestamptz not null default now(),
  unique (event_id, route_id)
);

create index event_routes_event_idx on public.event_routes(event_id);
create index event_routes_route_idx on public.event_routes(route_id);

-- Зөвхөн нэг primary route per event
create unique index event_routes_one_primary
  on public.event_routes(event_id) where is_primary;

-- 6. event_rsvps дээр selected_route_id нэмэх (multi-route событийн үед)
alter table public.event_rsvps
  add column if not exists selected_route_id uuid
    references public.routes(id) on delete set null;

create index if not exists event_rsvps_route_idx on public.event_rsvps(selected_route_id);

-- 7. events.route_id FK болгох (EP-03-аас nullable column байсан)
alter table public.events
  drop constraint if exists events_route_id_fkey;
alter table public.events
  add constraint events_route_id_fkey
  foreign key (route_id) references public.routes(id) on delete set null;

-- ============================================================
-- 8. RLS
-- ============================================================
alter table public.routes              enable row level security;
alter table public.route_completions   enable row level security;
alter table public.route_photos        enable row level security;
alter table public.event_routes        enable row level security;

-- Routes SELECT
create policy "anyone reads published public routes"
  on public.routes for select
  using (status = 'published' and visibility = 'public');

create policy "members read members routes"
  on public.routes for select
  using (
    status = 'published'
    and visibility = 'members'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('member','admin')
    )
  );

create policy "creators read own routes"
  on public.routes for select
  using (auth.uid() = created_by);

create policy "admins read all routes"
  on public.routes for select
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

-- Routes INSERT/UPDATE/DELETE — admin only (member-ууд V1.1-д suggest хийнэ)
create policy "admins insert routes"
  on public.routes for insert
  with check (
    auth.uid() = created_by
    and exists (select 1 from public.profiles
                where id = auth.uid() and role = 'admin')
  );

create policy "admins update routes"
  on public.routes for update
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

create policy "admins delete routes"
  on public.routes for delete
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

-- Route completions
create policy "users read own completions"
  on public.route_completions for select
  using (auth.uid() = user_id);

create policy "anyone reads completions of public routes"
  on public.route_completions for select
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_completions.route_id
        and r.status = 'published'
        and r.visibility = 'public'
    )
  );

create policy "members read completions of members routes"
  on public.route_completions for select
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_completions.route_id
        and r.status = 'published'
        and r.visibility = 'members'
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('member','admin')
    )
  );

create policy "users insert own completions"
  on public.route_completions for insert
  with check (auth.uid() = user_id);

create policy "users update own completions"
  on public.route_completions for update
  using (auth.uid() = user_id);

create policy "users delete own completions"
  on public.route_completions for delete
  using (auth.uid() = user_id);

-- Route photos (same visibility rules as parent route)
create policy "anyone reads photos of public routes"
  on public.route_photos for select
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_photos.route_id
        and r.status = 'published'
        and r.visibility = 'public'
    )
  );

create policy "members read photos of members routes"
  on public.route_photos for select
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_photos.route_id
        and r.status = 'published'
        and r.visibility = 'members'
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('member','admin')
    )
  );

create policy "uploaders read own photos"
  on public.route_photos for select
  using (auth.uid() = uploaded_by);

create policy "members upload photos"
  on public.route_photos for insert
  with check (
    auth.uid() = uploaded_by
    and exists (select 1 from public.profiles
                where id = auth.uid() and role in ('member','admin'))
  );

create policy "uploaders delete own photos"
  on public.route_photos for delete
  using (auth.uid() = uploaded_by);

create policy "admins delete any photo"
  on public.route_photos for delete
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

-- Event routes (visibility наашаа event-ийн дагуу)
create policy "anyone reads event_routes for visible events"
  on public.event_routes for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_routes.event_id
        and e.status in ('published','completed','cancelled')
        and (
          e.visibility = 'public'
          or (e.visibility = 'members' and exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('member','admin')
          ))
        )
    )
  );

create policy "organizers read event_routes for own events"
  on public.event_routes for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_routes.event_id
        and (e.organizer_id = auth.uid() or auth.uid() = any(e.co_organizer_ids))
    )
  );

create policy "admins manage event_routes"
  on public.event_routes for all
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 9. Stats trigger: completion_count + photo_count
-- ============================================================
create or replace function public.bump_route_completion_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.routes set completion_count = completion_count + 1 where id = new.route_id;
  elsif tg_op = 'DELETE' then
    update public.routes set completion_count = greatest(0, completion_count - 1) where id = old.route_id;
  end if;
  return null;
end $$;

create trigger route_completions_count
  after insert or delete on public.route_completions
  for each row execute function public.bump_route_completion_count();

create or replace function public.bump_route_photo_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.routes set photo_count = photo_count + 1 where id = new.route_id;
  elsif tg_op = 'DELETE' then
    update public.routes set photo_count = greatest(0, photo_count - 1) where id = old.route_id;
  end if;
  return null;
end $$;

create trigger route_photos_count
  after insert or delete on public.route_photos
  for each row execute function public.bump_route_photo_count();

-- 10. updated_at trigger (00001-д update_updated_at function үүссэн)
create trigger routes_updated_at
  before update on public.routes
  for each row execute function update_updated_at();

-- 11. Realtime publications
do $$ begin
  alter publication supabase_realtime add table public.routes;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.route_completions;
exception when duplicate_object then null; end $$;
