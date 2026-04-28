// EP-04 P0-7: classify-route-surface
// Input:  { route_id: uuid, sample_count?: number (default 60) }
// Steps:
//   1. Auth: caller must be admin
//   2. Load route path; extract evenly-spaced sample points along the line
//   3. Query Overpass API: nearest highway way to each sample, read its `surface=` tag
//      (no surface tag → derive from `highway=` class)
//   4. Aggregate to {asphalt%, gravel%, dirt%}
//   5. Update routes.surface_breakdown + surface_classified_at
//   6. Re-call compute_route_difficulty (surface affects difficulty)
//
// Notes:
//   - Overpass API is rate-limited; we batch all samples in one query and add user-agent.
//   - Fallback if Overpass fails: leave breakdown empty and respond ok:false with reason.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OVERPASS_URL = Deno.env.get('OVERPASS_URL') ?? 'https://overpass-api.de/api/interpreter';
const OVERPASS_RADIUS_M = 30; // search radius around each sample

// Map OSM `surface=` values onto our 3 buckets.
function bucketFromSurface(surface: string | undefined, highway: string | undefined): 'asphalt' | 'gravel' | 'dirt' {
  if (surface) {
    const s = surface.toLowerCase();
    if (['asphalt', 'paved', 'concrete', 'paving_stones', 'metal'].includes(s)) return 'asphalt';
    if (['gravel', 'fine_gravel', 'pebblestone', 'compacted', 'unpaved'].includes(s)) return 'gravel';
    if (['dirt', 'earth', 'mud', 'ground', 'grass', 'sand'].includes(s)) return 'dirt';
  }
  // Derive from highway class as fallback
  if (highway) {
    const h = highway.toLowerCase();
    if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service'].includes(h)) {
      return 'asphalt';
    }
    if (['track'].includes(h)) return 'gravel';
    if (['path', 'footway', 'bridleway', 'cycleway'].includes(h)) return 'dirt';
  }
  return 'asphalt'; // sensible default for unknown urban segments
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }

  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: cors });

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: cors });
  }

  let body: { route_id?: string; sample_count?: number };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }

  const { route_id, sample_count = 60 } = body;
  if (!route_id) {
    return new Response('Missing route_id', { status: 400, headers: cors });
  }

  // 1. Fetch route path as GeoJSON (admin RPC works for draft routes too)
  const { data: pathJson, error: pErr } = await adminClient
    .rpc('get_route_path_geojson', { p_route_id: route_id });
  if (pErr || !pathJson) {
    return new Response(`Route path fetch failed: ${pErr?.message ?? 'not found'}`, {
      status: 404, headers: cors,
    });
  }
  const coords = (pathJson as { coordinates?: Array<[number, number]> }).coordinates;
  if (!coords || coords.length < 2) {
    return new Response('Route path has fewer than 2 points', { status: 400, headers: cors });
  }

  const fractions = Array.from(
    { length: sample_count },
    (_, i) => i / Math.max(1, sample_count - 1),
  );

  // Compute cumulative distances and sample at evenly spaced fractions
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const d = 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(a)));
    cum.push(cum[cum.length - 1] + d);
  }
  const total = cum[cum.length - 1];
  if (total <= 0) {
    return new Response('Route has zero length', { status: 400, headers: cors });
  }

  const samples: Array<{ lat: number; lng: number }> = fractions.map((f) => {
    const target = f * total;
    // binary search
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const idx = Math.max(1, lo);
    const segLen = cum[idx] - cum[idx - 1];
    const t = segLen > 0 ? (target - cum[idx - 1]) / segLen : 0;
    const [lng1, lat1] = coords[idx - 1];
    const [lng2, lat2] = coords[idx];
    return {
      lat: lat1 + (lat2 - lat1) * t,
      lng: lng1 + (lng2 - lng1) * t,
    };
  });

  // 2. Build a single Overpass query with all `way(around:R, lat, lng)` clauses
  const aroundClauses = samples
    .map((s) => `way(around:${OVERPASS_RADIUS_M},${s.lat.toFixed(6)},${s.lng.toFixed(6)})[highway];`)
    .join('\n');
  const query = `[out:json][timeout:60];
(
${aroundClauses}
);
out tags geom;`;

  let elements: OverpassElement[] = [];
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'MongolRide/1.0 (contact: admin@mongolride.mn)',
      },
      body: 'data=' + encodeURIComponent(query),
    });
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({
        ok: false, reason: 'overpass_http', status: res.status, detail: txt.slice(0, 200),
      }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const json = await res.json() as { elements?: OverpassElement[] };
    elements = json.elements ?? [];
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false, reason: 'overpass_fetch_error', detail: (e as Error).message,
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  // 3. For each sample, find the closest returned way and read its surface/highway tags.
  //    We use a simple nearest-vertex distance over way.geometry.
  const counts: Record<'asphalt' | 'gravel' | 'dirt', number> = { asphalt: 0, gravel: 0, dirt: 0 };
  for (const s of samples) {
    let bestDist = Infinity;
    let bestEl: OverpassElement | null = null;
    for (const el of elements) {
      if (!el.geometry) continue;
      for (const g of el.geometry) {
        const dLat = (g.lat - s.lat) * Math.PI / 180;
        const dLng = (g.lon - s.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(s.lat * Math.PI / 180) * Math.cos(g.lat * Math.PI / 180) *
          Math.sin(dLng / 2) ** 2;
        const d = 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(a)));
        if (d < bestDist) { bestDist = d; bestEl = el; }
      }
    }
    if (!bestEl) continue;
    const bucket = bucketFromSurface(bestEl.tags?.surface, bestEl.tags?.highway);
    counts[bucket]++;
  }

  const total_classified = counts.asphalt + counts.gravel + counts.dirt;
  if (total_classified === 0) {
    return new Response(JSON.stringify({
      ok: false, reason: 'no_overpass_matches',
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const breakdown = {
    asphalt: Math.round((counts.asphalt / total_classified) * 100),
    gravel:  Math.round((counts.gravel  / total_classified) * 100),
    dirt:    Math.round((counts.dirt    / total_classified) * 100),
  };
  // Normalize rounding to sum 100
  const sum = breakdown.asphalt + breakdown.gravel + breakdown.dirt;
  if (sum !== 100) {
    const diff = 100 - sum;
    // adjust the largest bucket
    const largest = (Object.keys(breakdown) as Array<keyof typeof breakdown>)
      .reduce((a, b) => breakdown[a] >= breakdown[b] ? a : b);
    breakdown[largest] += diff;
  }

  // 4. Update route
  const { error: updErr } = await adminClient
    .from('routes')
    .update({
      surface_breakdown: breakdown,
      surface_classified_at: new Date().toISOString(),
    })
    .eq('id', route_id);
  if (updErr) {
    return new Response(`Update failed: ${updErr.message}`, { status: 500, headers: cors });
  }

  // 5. Re-compute difficulty
  await adminClient.rpc('compute_route_difficulty', { p_route_id: route_id });

  return new Response(JSON.stringify({
    ok: true,
    samples_total: samples.length,
    samples_classified: total_classified,
    breakdown,
  }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
