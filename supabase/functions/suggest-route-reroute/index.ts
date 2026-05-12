// EP-05 P0-6: suggest-route-reroute
//
// POST { event_id: uuid } — admin-only.
//   1. Loads event + current route
//   2. Samples AQI at 8 cardinal points within 25km of meet_lat/lng
//      (via Open-Meteo Air Quality)
//   3. If a substantially better-AQI direction exists (delta ≥ 50),
//      calls routes_near() at that point
//   4. Returns sorted route candidates AND fallback time-window suggestions
//
// Response:
//   {
//     current_aqi: number,
//     best_alt_lat, best_alt_lng, best_alt_aqi,
//     alternatives: [{ route_id, name, estimated_aqi, distance_km_from_meet }],
//     alternative_time_windows: [{ from, to, estimated_aqi }]
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SAMPLE_RADIUS_KM = 25;
const AQI_DELTA_THRESHOLD = 50;
const EARTH_R = 6_371; // km

// Offset (lat,lng) by (north_km, east_km) using equirectangular approximation
function offsetLatLng(lat: number, lng: number, northKm: number, eastKm: number): [number, number] {
  const dLat = (northKm / EARTH_R) * (180 / Math.PI);
  const dLng = (eastKm / (EARTH_R * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);
  return [lat + dLat, lng + dLng];
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

interface AqiSample {
  lat: number; lng: number; aqi: number | null;
}

async function fetchAqiAt(lat: number, lng: number, atIso: string): Promise<number | null> {
  const at = new Date(atIso);
  const dateStr = at.toISOString().slice(0, 10);
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&hourly=us_aqi&timezone=UTC&start_date=${dateStr}&end_date=${dateStr}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const hours: string[] = d.hourly?.time ?? [];
    const targetTime = at.getTime();
    let idx = hours.findIndex((h) => new Date(h).getTime() >= targetTime);
    if (idx === -1) idx = Math.max(0, hours.length - 1);
    return d.hourly?.us_aqi?.[idx] ?? null;
  } catch (e) {
    console.error(`[reroute] aqi fetch failed at ${lat},${lng}:`, e);
    return null;
  }
}

// Fetch hourly AQI for the next 36h to find a low-AQI time window
async function fetchAqiTimeline(lat: number, lng: number): Promise<Array<{ time: string; aqi: number | null }>> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&hourly=us_aqi&timezone=UTC&start_date=${today}&end_date=${tomorrow}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    const hours: string[] = d.hourly?.time ?? [];
    return hours.map((t, i) => ({ time: t, aqi: d.hourly?.us_aqi?.[i] ?? null }));
  } catch {
    return [];
  }
}

interface RouteCandidate {
  type: 'route';
  route_id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  difficulty_label: string | null;
  start_lat: number;
  start_lng: number;
  estimated_aqi: number | null;
  distance_km_from_meet: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }

  // Admin guard
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: cors });
  }

  let body: { event_id?: string };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  if (!body.event_id) return new Response('Missing event_id', { status: 400, headers: cors });

  const { data: event, error: eErr } = await admin
    .from('events')
    .select('id, title, meet_at, meet_lat, meet_lng, route_id, discipline')
    .eq('id', body.event_id).single();
  if (eErr || !event) {
    return new Response(`Event not found: ${eErr?.message}`, { status: 404, headers: cors });
  }
  if (event.meet_lat == null || event.meet_lng == null) {
    return new Response('Event has no meet coordinates', { status: 400, headers: cors });
  }

  // 1. Sample AQI at 8 cardinal points within 25 km
  const offsets: Array<[number, number, string]> = [
    [SAMPLE_RADIUS_KM,  0,                  'N'],
    [SAMPLE_RADIUS_KM*0.7,  SAMPLE_RADIUS_KM*0.7, 'NE'],
    [0,                  SAMPLE_RADIUS_KM,  'E'],
    [-SAMPLE_RADIUS_KM*0.7, SAMPLE_RADIUS_KM*0.7, 'SE'],
    [-SAMPLE_RADIUS_KM, 0,                  'S'],
    [-SAMPLE_RADIUS_KM*0.7, -SAMPLE_RADIUS_KM*0.7, 'SW'],
    [0,                  -SAMPLE_RADIUS_KM, 'W'],
    [SAMPLE_RADIUS_KM*0.7, -SAMPLE_RADIUS_KM*0.7, 'NW'],
  ];

  const samplePoints: Array<{ lat: number; lng: number; dir: string }> = offsets.map(([n, e, dir]) => {
    const [lat, lng] = offsetLatLng(event.meet_lat as number, event.meet_lng as number, n, e);
    return { lat, lng, dir };
  });

  const samples: AqiSample[] = await Promise.all([
    fetchAqiAt(event.meet_lat, event.meet_lng, event.meet_at).then((aqi) => ({
      lat: event.meet_lat as number, lng: event.meet_lng as number, aqi,
    })),
    ...samplePoints.map(async (p) => ({
      lat: p.lat, lng: p.lng, aqi: await fetchAqiAt(p.lat, p.lng, event.meet_at),
    })),
  ]);

  const currentAqi = samples[0].aqi;
  const validSamples = samples.slice(1).filter((s) => s.aqi != null) as Required<AqiSample>[];

  // Find best (lowest) alternative
  validSamples.sort((a, b) => (a.aqi ?? 999) - (b.aqi ?? 999));
  const best = validSamples[0];

  let alternatives: RouteCandidate[] = [];
  if (best && currentAqi != null && best.aqi != null && (currentAqi - best.aqi) >= AQI_DELTA_THRESHOLD) {
    // 2. Query routes_near() at the better point
    const { data: nearbyRoutes, error: rErr } = await admin.rpc('routes_near', {
      p_lat: best.lat,
      p_lng: best.lng,
      p_radius_km: 30,
      p_discipline: event.discipline ?? null,
      p_difficulty: null,
      p_min_distance: null,
      p_max_distance: null,
      p_limit: 8,
    });
    if (rErr) {
      console.error('[reroute] routes_near failed:', rErr.message);
    } else {
      const rows = (nearbyRoutes ?? []) as Array<{
        id: string; title: string; distance_km: number;
        elevation_gain_m: number; difficulty_label: string | null;
        start_lat: number; start_lng: number;
      }>;
      alternatives = rows
        .filter((r) => r.id !== event.route_id)
        .map((r) => ({
          type: 'route',
          route_id: r.id,
          name: r.title,
          distance_km: Number(r.distance_km),
          elevation_gain_m: r.elevation_gain_m,
          difficulty_label: r.difficulty_label,
          start_lat: r.start_lat,
          start_lng: r.start_lng,
          estimated_aqi: best.aqi,
          distance_km_from_meet: +haversineKm(
            event.meet_lat as number, event.meet_lng as number,
            r.start_lat, r.start_lng,
          ).toFixed(1),
        }));
    }
  }

  // 3. Fallback: alternative time windows (look 36h ahead at meet point)
  let alternative_time_windows: Array<{ from: string; to: string; estimated_aqi: number }> = [];
  if (currentAqi != null && currentAqi >= 100 && alternatives.length === 0) {
    const timeline = await fetchAqiTimeline(event.meet_lat, event.meet_lng);
    // Find runs of ≥3 consecutive hours where AQI < 100, starting from the next hour
    const now = Date.now();
    let runStart: number | null = null;
    let runMax = 0;
    for (let i = 0; i < timeline.length; i++) {
      const t = new Date(timeline[i].time).getTime();
      if (t < now) continue;
      const aqi = timeline[i].aqi;
      if (aqi != null && aqi < 100) {
        if (runStart === null) { runStart = i; runMax = aqi; }
        else { runMax = Math.max(runMax, aqi); }
      } else if (runStart !== null) {
        if (i - runStart >= 3) {
          alternative_time_windows.push({
            from: timeline[runStart].time,
            to: timeline[i - 1].time,
            estimated_aqi: runMax,
          });
        }
        runStart = null;
        runMax = 0;
      }
    }
    if (runStart !== null && timeline.length - runStart >= 3) {
      alternative_time_windows.push({
        from: timeline[runStart].time,
        to: timeline[timeline.length - 1].time,
        estimated_aqi: runMax,
      });
    }
    alternative_time_windows = alternative_time_windows.slice(0, 3);
  }

  return new Response(JSON.stringify({
    ok: true,
    current_aqi: currentAqi,
    best_alt_dir: best ? samplePoints.find((p) => p.lat === best.lat && p.lng === best.lng)?.dir ?? null : null,
    best_alt_aqi: best?.aqi ?? null,
    delta: best && currentAqi != null && best.aqi != null ? currentAqi - best.aqi : null,
    alternatives,
    alternative_time_windows,
  }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
