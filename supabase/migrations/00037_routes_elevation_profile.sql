-- ============================================================
-- EP-04 P1-2: routes.elevation_profile (km, ele) downsampled samples
-- parse-gpx Edge Function-аас бөглөнө. Detail page-ийн elevation
-- chart-д шууд ашиглана (geometry-д elevation хадгалагдахгүй).
-- ============================================================

alter table public.routes
  add column if not exists elevation_profile jsonb not null default '[]'::jsonb;

-- Format example:
--   [{"km": 0,    "ele": 1234},
--    {"km": 0.2,  "ele": 1240},
--    ...,
--    {"km": 87.5, "ele": 1190}]
-- Дээд тал нь ~500 цэг хадгална (≈ 25KB / route).

comment on column public.routes.elevation_profile
  is 'Downsampled (km, elevation_m) pairs for the elevation chart, populated by parse-gpx';
