-- ============================================================
-- EP-04 P1-7: routes.cue_sheet
-- parse-gpx Edge Function-ээс bearing-based turn detection-аар
-- бөглөнө. RouteDetailPage дээр turn-by-turn cue list-ээр харуулна.
-- ============================================================

alter table public.routes
  add column if not exists cue_sheet jsonb not null default '[]'::jsonb;

-- Format example:
--   [
--     {"km": 0,    "type": "start",       "segment_distance_m": 0,   "bearing_change": 0},
--     {"km": 1.2,  "type": "right",       "segment_distance_m": 1200,"bearing_change": 75.4},
--     {"km": 5.7,  "type": "slight_left", "segment_distance_m": 4500,"bearing_change": -22.1},
--     {"km": 12.3, "type": "u_turn",      "segment_distance_m": 6600,"bearing_change": -178.0},
--     {"km": 47.9, "type": "end",         "segment_distance_m": 35600,"bearing_change": 0}
--   ]
comment on column public.routes.cue_sheet
  is 'Turn-by-turn cue list populated by parse-gpx (bearing-based detection on ~50m resampled path)';
