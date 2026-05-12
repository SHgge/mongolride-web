-- ============================================================
-- EP-05 P0-2: classify_weather_risk(...)
-- Pure, immutable risk classifier. Returns:
--   overall    text  : 'green' | 'yellow' | 'orange' | 'red' | 'black'
--   components jsonb : per-category levels (cold, heat, wind, aqi, dust, ...)
-- Frontend & backend share this single source of truth.
-- ============================================================

create or replace function public.classify_weather_risk(
  p_temp_c          numeric default null,
  p_feels_like_c    numeric default null,
  p_wind_ms         numeric default null,
  p_aqi             integer default null,
  p_pm10_ugm3       numeric default null,
  p_precip_mm       numeric default null,
  p_thunder_prob    integer default null,
  p_uv              numeric default null
) returns table (
  overall      text,
  components   jsonb
)
language plpgsql
immutable
as $$
declare
  cold_lvl   text;
  heat_lvl   text;
  wind_lvl   text;
  aqi_lvl    text;
  dust_lvl   text;
  precip_lvl text;
  thunder_lvl text;
  uv_lvl     text;
  worst_rank int;
begin
  -- Cold (raw temp + feels like)
  cold_lvl := case
    when (p_feels_like_c is not null and p_feels_like_c <= -30)
      or (p_temp_c is not null and p_temp_c <= -30) then 'black'
    when (p_feels_like_c is not null and p_feels_like_c <= -25)
      or (p_temp_c is not null and p_temp_c <= -25) then 'red'
    when p_temp_c is not null and p_temp_c <= -15 then 'orange'
    when p_temp_c is not null and p_temp_c <= -5  then 'yellow'
    else 'green'
  end;

  -- Heat
  heat_lvl := case
    when p_temp_c is not null and p_temp_c >= 35 then 'red'
    when p_temp_c is not null and p_temp_c >= 32 then 'orange'
    when p_temp_c is not null and p_temp_c >= 28 then 'yellow'
    else 'green'
  end;

  -- Wind
  wind_lvl := case
    when p_wind_ms is not null and p_wind_ms >= 22 then 'red'
    when p_wind_ms is not null and p_wind_ms >= 18 then 'orange'
    when p_wind_ms is not null and p_wind_ms >= 12 then 'yellow'
    else 'green'
  end;

  -- AQI (US EPA scale)
  aqi_lvl := case
    when p_aqi is not null and p_aqi >= 300 then 'black'
    when p_aqi is not null and p_aqi >= 200 then 'red'
    when p_aqi is not null and p_aqi >= 150 then 'orange'
    when p_aqi is not null and p_aqi >= 100 then 'yellow'
    else 'green'
  end;

  -- Dust (high PM10 + wind)
  dust_lvl := case
    when p_pm10_ugm3 is not null and p_wind_ms is not null
         and p_pm10_ugm3 >= 250 and p_wind_ms >= 10 then 'red'
    when p_pm10_ugm3 is not null and p_pm10_ugm3 >= 150 then 'orange'
    when p_pm10_ugm3 is not null and p_pm10_ugm3 >= 80  then 'yellow'
    else 'green'
  end;

  -- Precipitation
  precip_lvl := case
    when p_precip_mm is not null and p_precip_mm >= 10 then 'orange'
    when p_precip_mm is not null and p_precip_mm >= 3  then 'yellow'
    else 'green'
  end;

  -- Thunderstorm
  thunder_lvl := case
    when p_thunder_prob is not null and p_thunder_prob >= 60 then 'red'
    when p_thunder_prob is not null and p_thunder_prob >= 30 then 'orange'
    else 'green'
  end;

  -- UV
  uv_lvl := case
    when p_uv is not null and p_uv >= 11 then 'orange'
    when p_uv is not null and p_uv >= 8  then 'yellow'
    else 'green'
  end;

  -- Roll-up: pick worst component via inline level→rank map
  with levels(lvl) as (
    values (cold_lvl), (heat_lvl), (wind_lvl), (aqi_lvl),
           (dust_lvl), (precip_lvl), (thunder_lvl), (uv_lvl)
  )
  select max(case lvl
    when 'green'  then 0
    when 'yellow' then 1
    when 'orange' then 2
    when 'red'    then 3
    when 'black'  then 4
    else 0
  end) into worst_rank
  from levels;

  overall := case worst_rank
    when 0 then 'green'
    when 1 then 'yellow'
    when 2 then 'orange'
    when 3 then 'red'
    when 4 then 'black'
    else 'green'
  end;

  components := jsonb_build_object(
    'cold',         cold_lvl,
    'heat',         heat_lvl,
    'wind',         wind_lvl,
    'aqi',          aqi_lvl,
    'dust',         dust_lvl,
    'precip',       precip_lvl,
    'thunderstorm', thunder_lvl,
    'uv',           uv_lvl
  );
  return next;
end;
$$;

grant execute on function public.classify_weather_risk(
  numeric, numeric, numeric, integer, numeric, numeric, integer, numeric
) to anon, authenticated, service_role;
