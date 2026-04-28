-- ============================================================
-- EP-04 P0-2..P0-5
--   P0-2: bbox_geog auto-computation trigger
--   P0-3: compute_route_difficulty function
--   P0-4: routes_near + routes_in_bbox spatial RPCs
--   P0-5: route-assets storage bucket + policies
-- ============================================================

-- ------------------------------------------------------------
-- P0-2: bbox_geog computation trigger
-- ------------------------------------------------------------
-- LineString-аас bounding box (Polygon) гаргана. Spatial filter-т хэрэгтэй.
create or replace function public.compute_route_bbox()
returns trigger language plpgsql as $$
begin
  if new.path is not null then
    new.bbox_geog := ST_Envelope(new.path)::geography;
    new.start_point := ST_StartPoint(new.path)::geography;
    new.end_point   := ST_EndPoint(new.path)::geography;
  end if;
  return new;
end $$;

create trigger routes_bbox_compute
  before insert or update of path on public.routes
  for each row execute function public.compute_route_bbox();

-- ------------------------------------------------------------
-- P0-3: compute_route_difficulty
-- ------------------------------------------------------------
-- Heuristic 0-10 score:
--   distance_factor   = least(distance_km / 100, 1) * 3       (0..3)
--   gain_factor       = least(elevation_gain_m / 2000, 1) * 4 (0..4)
--   grade_factor      = least(max_grade_pct / 15, 1) * 2      (0..2)
--   surface_factor    = (gravel% + dirt%) / 100               (0..1)
-- Label: 0..2.5 easy, 2.5..5 moderate, 5..7.5 hard, 7.5..10 expert
create or replace function public.compute_route_difficulty(p_route_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  distance_factor numeric;
  gain_factor     numeric;
  grade_factor    numeric;
  surface_factor  numeric;
  total_score     numeric;
  label           text;
  gravel_pct      integer;
  dirt_pct        integer;
begin
  select distance_km, elevation_gain_m, max_grade_pct, surface_breakdown
    into r
    from public.routes
   where id = p_route_id;

  if not found then
    raise exception 'route % not found', p_route_id;
  end if;

  distance_factor := least(coalesce(r.distance_km, 0) / 100.0, 1.0) * 3.0;
  gain_factor     := least(coalesce(r.elevation_gain_m, 0) / 2000.0, 1.0) * 4.0;
  grade_factor    := least(coalesce(r.max_grade_pct, 0) / 15.0, 1.0) * 2.0;

  gravel_pct := coalesce((r.surface_breakdown->>'gravel')::integer, 0);
  dirt_pct   := coalesce((r.surface_breakdown->>'dirt')::integer, 0);
  surface_factor := least((gravel_pct + dirt_pct) / 100.0, 1.0);

  total_score := round(distance_factor + gain_factor + grade_factor + surface_factor, 2);

  label := case
    when total_score < 2.5 then 'easy'
    when total_score < 5.0 then 'moderate'
    when total_score < 7.5 then 'hard'
    else 'expert'
  end;

  update public.routes
     set difficulty_score = total_score,
         difficulty_label = label,
         updated_at = now()
   where id = p_route_id;
end $$;

grant execute on function public.compute_route_difficulty(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- P0-4: Spatial RPCs
-- ------------------------------------------------------------
-- routes_near: цэгээс radius_km дотор start_point-той маршрутууд
create or replace function public.routes_near(
  p_lat            double precision,
  p_lng            double precision,
  p_radius_km      numeric default 50,
  p_discipline     text default null,
  p_difficulty     text default null,
  p_min_distance   numeric default null,
  p_max_distance   numeric default null,
  p_limit          integer default 50
)
returns table (
  id                uuid,
  title             text,
  distance_km       numeric,
  elevation_gain_m  integer,
  difficulty_label  text,
  difficulty_score  numeric,
  discipline        text,
  loop_type         text,
  region            text,
  cover_photo_path  text,
  start_lat         double precision,
  start_lng         double precision,
  distance_from_query_m double precision,
  completion_count  integer,
  surface_breakdown jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.title,
    r.distance_km,
    r.elevation_gain_m,
    r.difficulty_label,
    r.difficulty_score,
    r.discipline,
    r.loop_type,
    r.region,
    r.cover_photo_path,
    ST_Y(r.start_point::geometry) as start_lat,
    ST_X(r.start_point::geometry) as start_lng,
    ST_Distance(r.start_point, ST_MakePoint(p_lng, p_lat)::geography) as distance_from_query_m,
    r.completion_count,
    r.surface_breakdown
  from public.routes r
  where r.status = 'published'
    and (
      r.visibility = 'public'
      or (
        r.visibility = 'members'
        and exists (select 1 from public.profiles
                    where id = auth.uid() and role in ('member','admin'))
      )
    )
    and r.start_point is not null
    and ST_DWithin(
      r.start_point,
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius_km * 1000
    )
    and (p_discipline   is null or r.discipline = p_discipline)
    and (p_difficulty   is null or r.difficulty_label = p_difficulty)
    and (p_min_distance is null or r.distance_km >= p_min_distance)
    and (p_max_distance is null or r.distance_km <= p_max_distance)
  order by distance_from_query_m asc
  limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.routes_near(
  double precision, double precision, numeric, text, text, numeric, numeric, integer
) to anon, authenticated, service_role;

-- routes_in_bbox: газрын зураг дээрх viewport-д унах routes
create or replace function public.routes_in_bbox(
  p_min_lat   double precision,
  p_min_lng   double precision,
  p_max_lat   double precision,
  p_max_lng   double precision,
  p_limit     integer default 100
)
returns table (
  id                uuid,
  title             text,
  distance_km       numeric,
  elevation_gain_m  integer,
  difficulty_label  text,
  discipline        text,
  region            text,
  cover_photo_path  text,
  start_lat         double precision,
  start_lng         double precision,
  path_geojson      jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.title,
    r.distance_km,
    r.elevation_gain_m,
    r.difficulty_label,
    r.discipline,
    r.region,
    r.cover_photo_path,
    ST_Y(r.start_point::geometry) as start_lat,
    ST_X(r.start_point::geometry) as start_lng,
    ST_AsGeoJSON(ST_Simplify(r.path, 0.001))::jsonb as path_geojson
  from public.routes r
  where r.status = 'published'
    and (
      r.visibility = 'public'
      or (
        r.visibility = 'members'
        and exists (select 1 from public.profiles
                    where id = auth.uid() and role in ('member','admin'))
      )
    )
    and ST_Intersects(
      r.bbox_geog,
      ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
    )
  order by r.completion_count desc, r.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

grant execute on function public.routes_in_bbox(
  double precision, double precision, double precision, double precision, integer
) to anon, authenticated, service_role;

-- get_route_path_geojson: маршрутын path-ыг GeoJSON хэлбэрээр буцаана.
-- Authorization: admin OR creator OR (route published AND visible to caller).
-- Used by:
--   - parse-gpx / classify-route-surface (admin paths)
--   - download-clean-gpx (any visible route)
--   - frontend RouteDetailPage (drawing the map)
create or replace function public.get_route_path_geojson(p_route_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  is_admin boolean;
  is_member boolean;
begin
  select status, visibility, created_by, path
    into r
    from public.routes
   where id = p_route_id;
  if not found then
    raise exception 'route not found';
  end if;

  is_admin := exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
  is_member := exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('member','admin')
  );

  if not (
    is_admin
    or r.created_by = auth.uid()
    or (r.status = 'published' and r.visibility = 'public')
    or (r.status = 'published' and r.visibility = 'members' and is_member)
  ) then
    raise exception 'forbidden';
  end if;

  return ST_AsGeoJSON(r.path)::jsonb;
end $$;

grant execute on function public.get_route_path_geojson(uuid)
  to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- P0-5: route-assets storage bucket
-- ------------------------------------------------------------
-- Хуучин 'routes' bucket нь зөвхөн зургийнх. Шинэ 'route-assets' bucket нь
-- GPX + cleaned GPX + cover + photos бүх зүйлийг folder-аар хадгална:
--   <route_id>/gpx/original.gpx
--   <route_id>/gpx/cleaned.gpx
--   <route_id>/cover/<filename>
--   <route_id>/photos/<filename>
insert into storage.buckets (id, name, public)
  values ('route-assets', 'route-assets', true)
  on conflict (id) do nothing;

-- Public read (зургууд + cleaned GPX public-аар үзэгдэнэ)
drop policy if exists "route_assets_select" on storage.objects;
create policy "route_assets_select" on storage.objects
  for select using (bucket_id = 'route-assets');

-- Зөвхөн admin upload хийнэ (V1.1-д member submit hooked)
drop policy if exists "route_assets_insert" on storage.objects;
create policy "route_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'route-assets'
    and auth.uid() is not null
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "route_assets_update" on storage.objects;
create policy "route_assets_update" on storage.objects
  for update using (
    bucket_id = 'route-assets'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "route_assets_delete" on storage.objects;
create policy "route_assets_delete" on storage.objects
  for delete using (
    bucket_id = 'route-assets'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
