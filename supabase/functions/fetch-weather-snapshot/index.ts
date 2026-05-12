// EP-05 P0-3: fetch-weather-snapshot
//
// POST { lat: number, lng: number, at: ISO8601 } → returns weather snapshot.
//
// Provider strategy:
//   1. Cache hit (≤30 min old at coarse 0.05° / 1h grid) → return.
//   2. Open-Meteo Forecast + Air Quality (free, no key).
//   3. On 5xx/timeout, fall back to IQAir (key required).
//   4. On second failure, return last cached row with is_stale=true.
//
// verify_jwt is DISABLED (see supabase/config.toml). Weather data is public
// (Open-Meteo is itself anonymous), so we serve unauthenticated callers too.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function gridLat(lat: number): number { return Math.round(lat * 20) / 20; }
function gridLng(lng: number): number { return Math.round(lng * 20) / 20; }
function hourBucket(iso: string): string {
  const d = new Date(iso);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

// Standard wind chill (Environment Canada formula). Defined for tempC ≤ 10°C
// and wind ≥ 4.8 km/h (= 1.33 m/s). Returns null otherwise.
function windChillC(tempC: number, windMs: number): number | null {
  const windKmh = windMs * 3.6;
  if (tempC > 10 || windKmh < 4.8) return null;
  return +(13.12
    + 0.6215 * tempC
    - 11.37 * Math.pow(windKmh, 0.16)
    + 0.3965 * tempC * Math.pow(windKmh, 0.16)).toFixed(1);
}

interface Snapshot {
  provider: 'open-meteo' | 'iqair' | 'aqicn' | 'cached';
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
  raw_payload: Record<string, unknown>;
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchOpenMeteo(lat: number, lng: number, atIso: string): Promise<Snapshot> {
  const at = new Date(atIso);
  // Fetch a 3-day window centered on target; index lookup picks the right hour
  const start = new Date(at.getTime() - 86_400_000).toISOString().slice(0, 10);
  const end   = new Date(at.getTime() + 86_400_000).toISOString().slice(0, 10);

  const wxUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,` +
    `wind_gusts_10m,precipitation,precipitation_probability,relative_humidity_2m,` +
    `pressure_msl,cloud_cover,visibility,uv_index,weather_code` +
    `&daily=sunrise,sunset` +
    `&timezone=UTC&start_date=${start}&end_date=${end}`;
  const aqUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
    `&hourly=pm10,pm2_5,us_aqi,ozone,nitrogen_dioxide` +
    `&timezone=UTC&start_date=${start}&end_date=${end}`;

  const [wxRes, aqRes] = await Promise.all([
    fetchWithTimeout(wxUrl),
    fetchWithTimeout(aqUrl),
  ]);
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

  // Pick the sunrise/sunset for the local date of the target
  const targetDate = at.toISOString().slice(0, 10);
  const dailyDates: string[] = wx.daily?.time ?? [];
  const dayIdx = Math.max(0, dailyDates.indexOf(targetDate));

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
    thunderstorm_prob_pct: null, // Open-Meteo doesn't expose this directly
    sunrise_at:       wx.daily?.sunrise?.[dayIdx] ?? null,
    sunset_at:        wx.daily?.sunset?.[dayIdx] ?? null,
    raw_payload:      { wx, aq },
  };
}

async function fetchIQAir(lat: number, lng: number): Promise<Snapshot> {
  const key = Deno.env.get('IQAIR_API_KEY');
  if (!key) throw new Error('iqair key missing');
  const r = await fetchWithTimeout(
    `https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lng}&key=${key}`,
    8000,
  );
  if (!r.ok) throw new Error(`iqair ${r.status}`);
  const d = await r.json();
  const cur = d?.data?.current;
  const w = cur?.weather ?? {};
  const p = cur?.pollution ?? {};
  return {
    provider: 'iqair',
    temp_c:           typeof w.tp === 'number' ? w.tp : null,
    feels_like_c:     null,
    wind_speed_ms:    typeof w.ws === 'number' ? w.ws : null,
    wind_dir_deg:     typeof w.wd === 'number' ? w.wd : null,
    wind_gust_ms:     null,
    precip_prob_pct:  null,
    precip_amount_mm: null,
    humidity_pct:     typeof w.hu === 'number' ? w.hu : null,
    pressure_hpa:     typeof w.pr === 'number' ? w.pr : null,
    cloud_cover_pct:  null,
    visibility_km:    null,
    aqi_us:           typeof p.aqius === 'number' ? p.aqius : null,
    pm25_ugm3:        null,
    pm10_ugm3:        null,
    o3_ugm3:          null,
    no2_ugm3:         null,
    uv_index:         null,
    thunderstorm_prob_pct: null,
    sunrise_at:       null,
    sunset_at:        null,
    raw_payload:      d,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }

  let body: { lat?: number; lng?: number; at?: string };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }

  const { lat, lng, at } = body;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !at) {
    return new Response('Missing lat/lng/at', { status: 400, headers: cors });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const lat_grid    = gridLat(lat);
  const lng_grid    = gridLng(lng);
  const hour_bucket = hourBucket(at);

  // Cache lookup (≤ 30 min old)
  const { data: cached } = await admin
    .from('weather_snapshots')
    .select('*')
    .eq('lat_grid', lat_grid)
    .eq('lng_grid', lng_grid)
    .eq('hour_bucket', hour_bucket)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached && (Date.now() - new Date(cached.fetched_at).getTime()) < 30 * 60_000) {
    return new Response(JSON.stringify({ ...cached, cache_hit: true }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Provider chain
  let snap: Snapshot | null = null;
  let lastErr: unknown = null;
  try {
    snap = await fetchOpenMeteo(lat, lng, at);
  } catch (e) {
    lastErr = e;
    console.error('[fetch-weather-snapshot] open-meteo failed:', e);
    try {
      snap = await fetchIQAir(lat, lng);
    } catch (e2) {
      console.error('[fetch-weather-snapshot] iqair failed:', e2);
      lastErr = e2;
    }
  }

  if (!snap) {
    if (cached) {
      return new Response(JSON.stringify({ ...cached, is_stale: true, cache_hit: true }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      `All providers failed and no cache: ${lastErr instanceof Error ? lastErr.message : 'unknown'}`,
      { status: 503, headers: cors },
    );
  }

  // Derive feels_like via wind chill if provider didn't supply one
  if (snap.feels_like_c == null && snap.temp_c != null && snap.wind_speed_ms != null) {
    snap.feels_like_c = windChillC(snap.temp_c, snap.wind_speed_ms);
  }

  const row = {
    lat_grid,
    lng_grid,
    hour_bucket,
    fetched_at: new Date().toISOString(),
    is_stale: false,
    ...snap,
  };

  const { data: persisted, error: upErr } = await admin
    .from('weather_snapshots')
    .upsert(row, { onConflict: 'lat_grid,lng_grid,hour_bucket,provider' })
    .select()
    .single();

  if (upErr) console.error('[fetch-weather-snapshot] persist error:', upErr.message);

  return new Response(JSON.stringify({ ...(persisted ?? row), cache_hit: false }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
