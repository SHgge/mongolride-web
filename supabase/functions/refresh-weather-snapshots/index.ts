// EP-05 P0-4: refresh-weather-snapshots
//
// Cron-driven (pg_cron, every 30 min). For each published event with
// meet_at within [now, now+7d] and meet_lat/lng set:
//   1. Fetch a fresh snapshot via fetch-weather-snapshot logic (inlined here
//      to avoid cross-function HTTP hop).
//   2. Classify via classify_weather_risk SQL.
//   3. For each component ≥ yellow, upsert event_alerts row keyed by
//      (event_id, alert_type, severity, forecast_window).
//   4. On NEW alert (insert, not update), fire notify-weather-alert.
//
// verify_jwt = false (cron-only entry point); ingress is the cron job using
// the service_role key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function gridLat(lat: number): number { return Math.round(lat * 20) / 20; }
function gridLng(lng: number): number { return Math.round(lng * 20) / 20; }
function hourBucket(iso: string): string {
  const d = new Date(iso); d.setUTCMinutes(0, 0, 0); return d.toISOString();
}

interface MiniEvent {
  id: string;
  title: string;
  meet_at: string;
  meet_lat: number | null;
  meet_lng: number | null;
}

interface Snapshot {
  provider: string;
  temp_c: number | null;
  feels_like_c: number | null;
  wind_speed_ms: number | null;
  wind_dir_deg: number | null;
  wind_gust_ms: number | null;
  precip_prob_pct: number | null;
  precip_amount_mm: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  cloud_cover_pct: number | null;
  visibility_km: number | null;
  aqi_us: number | null;
  pm25_ugm3: number | null;
  pm10_ugm3: number | null;
  o3_ugm3: number | null;
  no2_ugm3: number | null;
  uv_index: number | null;
  thunderstorm_prob_pct: number | null;
  sunrise_at: string | null;
  sunset_at: string | null;
  raw_payload?: unknown;
}

async function fetchOpenMeteo(lat: number, lng: number, atIso: string): Promise<Snapshot> {
  const at = new Date(atIso);
  const start = new Date(at.getTime() - 86_400_000).toISOString().slice(0, 10);
  const end   = new Date(at.getTime() + 86_400_000).toISOString().slice(0, 10);
  const wxUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,` +
    `wind_gusts_10m,precipitation,precipitation_probability,relative_humidity_2m,` +
    `pressure_msl,cloud_cover,visibility,uv_index` +
    `&daily=sunrise,sunset&timezone=UTC&start_date=${start}&end_date=${end}`;
  const aqUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
    `&hourly=pm10,pm2_5,us_aqi,ozone,nitrogen_dioxide&timezone=UTC&start_date=${start}&end_date=${end}`;
  const [wxRes, aqRes] = await Promise.all([fetch(wxUrl), fetch(aqUrl)]);
  if (!wxRes.ok) throw new Error(`open-meteo wx ${wxRes.status}`);
  const wx = await wxRes.json();
  const aq = aqRes.ok ? await aqRes.json() : null;
  const hours: string[] = wx.hourly?.time ?? [];
  const targetTime = at.getTime();
  let idx = hours.findIndex((h) => new Date(h).getTime() >= targetTime);
  if (idx === -1) idx = Math.max(0, hours.length - 1);
  const aqHours: string[] = aq?.hourly?.time ?? [];
  let aqI = aqHours.findIndex((h) => new Date(h).getTime() >= targetTime);
  if (aqI === -1) aqI = Math.max(0, aqHours.length - 1);
  const targetDate = at.toISOString().slice(0, 10);
  const dayIdx = Math.max(0, (wx.daily?.time ?? []).indexOf(targetDate));
  return {
    provider: 'open-meteo',
    temp_c:           wx.hourly?.temperature_2m?.[idx] ?? null,
    feels_like_c:     wx.hourly?.apparent_temperature?.[idx] ?? null,
    wind_speed_ms:    wx.hourly?.wind_speed_10m?.[idx] != null
                       ? +(wx.hourly.wind_speed_10m[idx] / 3.6).toFixed(1) : null,
    wind_dir_deg:     wx.hourly?.wind_direction_10m?.[idx] ?? null,
    wind_gust_ms:     wx.hourly?.wind_gusts_10m?.[idx] != null
                       ? +(wx.hourly.wind_gusts_10m[idx] / 3.6).toFixed(1) : null,
    precip_amount_mm: wx.hourly?.precipitation?.[idx] ?? null,
    precip_prob_pct:  wx.hourly?.precipitation_probability?.[idx] ?? null,
    humidity_pct:     wx.hourly?.relative_humidity_2m?.[idx] ?? null,
    pressure_hpa:     wx.hourly?.pressure_msl?.[idx] ?? null,
    cloud_cover_pct:  wx.hourly?.cloud_cover?.[idx] ?? null,
    visibility_km:    wx.hourly?.visibility?.[idx] != null
                       ? +(wx.hourly.visibility[idx] / 1000).toFixed(1) : null,
    uv_index:         wx.hourly?.uv_index?.[idx] ?? null,
    pm25_ugm3:        aq?.hourly?.pm2_5?.[aqI] ?? null,
    pm10_ugm3:        aq?.hourly?.pm10?.[aqI] ?? null,
    aqi_us:           aq?.hourly?.us_aqi?.[aqI] ?? null,
    o3_ugm3:          aq?.hourly?.ozone?.[aqI] ?? null,
    no2_ugm3:         aq?.hourly?.nitrogen_dioxide?.[aqI] ?? null,
    thunderstorm_prob_pct: null,
    sunrise_at:       wx.daily?.sunrise?.[dayIdx] ?? null,
    sunset_at:        wx.daily?.sunset?.[dayIdx] ?? null,
    raw_payload:      { wx, aq },
  };
}

// Map a component level → severity name used in event_alerts
function levelToSeverity(level: string): string | null {
  switch (level) {
    case 'yellow': return 'warning';
    case 'orange': return 'severe';
    case 'red':    return 'severe';
    case 'black':  return 'cancel_recommended';
    default:       return null;
  }
}

function pickForecastWindow(meetAt: string): string {
  const ms = new Date(meetAt).getTime() - Date.now();
  const h = ms / 3_600_000;
  if (h <= 2)  return 't_minus_2h';
  if (h <= 6)  return 't_minus_6h';
  if (h <= 24) return 't_minus_24h';
  return 't_minus_72h';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Fetch upcoming published events with coords
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 86_400_000);
  const { data: events, error: evErr } = await admin
    .from('events')
    .select('id, title, meet_at, meet_lat, meet_lng')
    .eq('status', 'published')
    .gte('meet_at', now.toISOString())
    .lte('meet_at', horizon.toISOString());

  if (evErr) {
    return new Response(`Event fetch failed: ${evErr.message}`, { status: 500, headers: cors });
  }

  let processed = 0;
  let snapshotsWritten = 0;
  let alertsCreated = 0;
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const ev of (events as MiniEvent[]) ?? []) {
    if (ev.meet_lat == null || ev.meet_lng == null) {
      skipped.push({ id: ev.id, reason: 'no_coords' });
      continue;
    }
    processed++;

    const lat_grid    = gridLat(ev.meet_lat);
    const lng_grid    = gridLng(ev.meet_lng);
    const hour_bucket = hourBucket(ev.meet_at);

    let snap: Snapshot | null = null;
    try {
      snap = await fetchOpenMeteo(ev.meet_lat, ev.meet_lng, ev.meet_at);
    } catch (e) {
      console.error(`[refresh] fetch failed for ${ev.id}:`, e);
      skipped.push({ id: ev.id, reason: 'fetch_failed' });
      continue;
    }

    // Persist
    const { error: upErr } = await admin.from('weather_snapshots').upsert({
      lat_grid, lng_grid, hour_bucket,
      fetched_at: new Date().toISOString(),
      is_stale: false,
      ...snap,
    }, { onConflict: 'lat_grid,lng_grid,hour_bucket,provider' });
    if (upErr) {
      console.error(`[refresh] persist failed for ${ev.id}:`, upErr.message);
      continue;
    }
    snapshotsWritten++;

    // Classify
    const { data: classified, error: classErr } = await admin.rpc('classify_weather_risk', {
      p_temp_c:       snap.temp_c,
      p_feels_like_c: snap.feels_like_c,
      p_wind_ms:      snap.wind_speed_ms,
      p_aqi:          snap.aqi_us,
      p_pm10_ugm3:    snap.pm10_ugm3,
      p_precip_mm:    snap.precip_amount_mm,
      p_thunder_prob: snap.thunderstorm_prob_pct,
      p_uv:           snap.uv_index,
    });
    if (classErr) {
      console.error(`[refresh] classify failed for ${ev.id}:`, classErr.message);
      continue;
    }
    const cls = Array.isArray(classified) ? classified[0] : classified;
    const components: Record<string, string> = cls?.components ?? {};
    const window = pickForecastWindow(ev.meet_at);

    for (const [component, level] of Object.entries(components)) {
      const severity = levelToSeverity(level);
      if (!severity) continue;
      // Map component → alert_type
      const alertType =
        component === 'precip' ? (snap.temp_c != null && snap.temp_c <= 0 ? 'snow' : 'rain') :
        component;
      // Only allow recognised alert_type values
      if (!['cold','heat','wind','aqi','dust','rain','snow','thunderstorm','uv'].includes(alertType)) {
        continue;
      }

      // Upsert alert; capture whether it's a new row (sent flag)
      const { data: existing } = await admin
        .from('event_alerts')
        .select('id')
        .eq('event_id', ev.id)
        .eq('alert_type', alertType)
        .eq('severity', severity)
        .eq('forecast_window', window)
        .maybeSingle();

      if (existing) continue; // already alerted at this severity for this window

      const { data: inserted, error: alErr } = await admin
        .from('event_alerts')
        .insert({
          event_id: ev.id,
          alert_type: alertType,
          severity,
          forecast_window: window,
          values_snapshot: {
            component, level,
            temp_c: snap.temp_c, feels_like_c: snap.feels_like_c,
            wind_speed_ms: snap.wind_speed_ms,
            aqi_us: snap.aqi_us, pm10_ugm3: snap.pm10_ugm3,
            precip_amount_mm: snap.precip_amount_mm,
            uv_index: snap.uv_index,
          },
        })
        .select('id')
        .single();

      if (alErr) {
        console.error(`[refresh] alert insert failed:`, alErr.message);
        continue;
      }
      alertsCreated++;

      // Fire notification fan-out (best-effort; ignore non-fatal failures)
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-weather-alert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ alert_id: inserted!.id }),
        });
      } catch (e) {
        console.error('[refresh] notify dispatch failed:', e);
      }
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    processed,
    snapshots_written: snapshotsWritten,
    alerts_created: alertsCreated,
    skipped,
  }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
