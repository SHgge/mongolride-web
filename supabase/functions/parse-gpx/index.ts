// EP-04 P0-6: parse-gpx
// Input:  { route_id: uuid, gpx_path: string }   (gpx_path = path inside route-assets bucket)
// Steps:
//   1. Auth: caller must be admin
//   2. Download GPX from storage (admin client)
//   3. Parse trackpoints (lat, lng, ele) from <trkpt> tags via regex (no XML deps in Deno edge)
//   4. Compute distance (haversine), elevation gain/loss/min/max, grade (avg + max),
//      and extract climbs (>=500m sustained, avg grade >=3%)
//   5. Build LineString WKT and update routes row (path + computed metrics)
//   6. Call compute_route_difficulty(route_id)
//
// Output: { ok, distance_km, elevation_gain_m, elevation_loss_m, climbs_count, points_count }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Trackpoint {
  lat: number;
  lng: number;
  ele: number; // meters; 0 if absent
}

interface Climb {
  start_km: number;
  end_km: number;
  length_km: number;
  gain_m: number;
  avg_grade: number;
  max_grade: number;
  category: string; // HC, 1, 2, 3, 4
}

type CueType =
  | 'start' | 'end'
  | 'left' | 'right'
  | 'sharp_left' | 'sharp_right'
  | 'slight_left' | 'slight_right'
  | 'u_turn';

interface CueEntry {
  km: number;
  type: CueType;
  segment_distance_m: number;
  bearing_change: number;
}

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(a: Trackpoint, b: Trackpoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function parseTrackpoints(gpxText: string): Trackpoint[] {
  // Matches: <trkpt lat="47.123" lon="106.456">...<ele>1234</ele>...</trkpt>
  // Tolerates self-closing trkpt with no ele.
  const points: Trackpoint[] = [];
  const trkptRe = /<trkpt\s+([^>]+?)\s*(?:\/>|>([\s\S]*?)<\/trkpt>)/gi;
  const attrRe = /(lat|lon)\s*=\s*"([^"]+)"/gi;
  const eleRe = /<ele>([-0-9.eE+]+)<\/ele>/i;

  let m: RegExpExecArray | null;
  while ((m = trkptRe.exec(gpxText)) !== null) {
    const attrsStr = m[1];
    const inner = m[2] ?? '';
    let lat = NaN;
    let lng = NaN;
    let am: RegExpExecArray | null;
    attrRe.lastIndex = 0;
    while ((am = attrRe.exec(attrsStr)) !== null) {
      if (am[1].toLowerCase() === 'lat') lat = parseFloat(am[2]);
      else if (am[1].toLowerCase() === 'lon') lng = parseFloat(am[2]);
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const eleMatch = inner ? eleRe.exec(inner) : null;
    const ele = eleMatch ? parseFloat(eleMatch[1]) : 0;
    points.push({ lat, lng, ele: Number.isFinite(ele) ? ele : 0 });
  }
  return points;
}

// Smooth elevation with simple moving average to reduce GPS noise.
function smoothElevation(points: Trackpoint[], window = 5): Trackpoint[] {
  if (points.length === 0) return points;
  const half = Math.floor(window / 2);
  return points.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      sum += points[j].ele;
      n++;
    }
    return { ...p, ele: sum / n };
  });
}

function categorizeClimb(c: Climb): string {
  // UCI-inspired heuristic on (length_km * avg_grade)
  const score = c.length_km * c.avg_grade;
  if (score >= 80) return 'HC';
  if (score >= 50) return '1';
  if (score >= 30) return '2';
  if (score >= 15) return '3';
  return '4';
}

interface Computed {
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  min_elevation_m: number;
  max_elevation_m: number;
  avg_grade_pct: number;
  max_grade_pct: number;
  loop_type: 'loop' | 'out_and_back' | 'point_to_point';
  climbs: Climb[];
  wkt: string;
  elevation_profile: Array<{ km: number; ele: number }>;
  cue_sheet: CueEntry[];
}

// Bearing in degrees (0..360, north = 0, east = 90)
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

// Normalize a bearing diff into -180..180 (positive = right turn, negative = left)
function normalizeTurn(diff: number): number {
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

function classifyTurn(absDeg: number, signed: number): CueType {
  if (absDeg >= 160) return 'u_turn';
  if (absDeg >= 100) return signed > 0 ? 'sharp_right' : 'sharp_left';
  if (absDeg >= 35)  return signed > 0 ? 'right'       : 'left';
  return signed > 0 ? 'slight_right' : 'slight_left';
}

// Build cue sheet from smoothed track + cumulative segment distances.
// Resample to ~50m segments to suppress GPS jitter, then detect turns.
function computeCueSheet(
  points: Trackpoint[],
  segDists: number[],
  totalDistM: number,
): CueEntry[] {
  if (points.length < 3) return [];

  const SAMPLE_DIST_M = 50;
  const TURN_THRESHOLD_DEG = 15; // ignore anything below this — GPS noise

  // 1. Resample (keep first, then any point that is ≥ SAMPLE_DIST from the last kept)
  const sampled: Array<{ idx: number; lat: number; lng: number; dist: number }> = [
    { idx: 0, lat: points[0].lat, lng: points[0].lng, dist: 0 },
  ];
  let lastKeptDist = 0;
  for (let i = 1; i < points.length; i++) {
    if (segDists[i] - lastKeptDist >= SAMPLE_DIST_M) {
      sampled.push({ idx: i, lat: points[i].lat, lng: points[i].lng, dist: segDists[i] });
      lastKeptDist = segDists[i];
    }
  }
  const lastIdx = points.length - 1;
  if (sampled[sampled.length - 1].idx !== lastIdx) {
    sampled.push({ idx: lastIdx, lat: points[lastIdx].lat, lng: points[lastIdx].lng, dist: totalDistM });
  }
  if (sampled.length < 3) return [];

  // 2. Compute per-segment bearings between consecutive sampled points
  const bearings: number[] = [];
  for (let i = 0; i < sampled.length - 1; i++) {
    bearings.push(bearingDeg(sampled[i].lat, sampled[i].lng, sampled[i + 1].lat, sampled[i + 1].lng));
  }

  // 3. Walk through bearing changes and emit cues
  const cues: CueEntry[] = [{
    km: 0,
    type: 'start',
    segment_distance_m: 0,
    bearing_change: 0,
  }];
  let lastCueDist = 0;

  for (let i = 1; i < bearings.length; i++) {
    const change = normalizeTurn(bearings[i] - bearings[i - 1]);
    const abs = Math.abs(change);
    if (abs < TURN_THRESHOLD_DEG) continue;

    const pos = sampled[i].dist;
    cues.push({
      km: +(pos / 1000).toFixed(2),
      type: classifyTurn(abs, change),
      segment_distance_m: Math.round(pos - lastCueDist),
      bearing_change: +change.toFixed(1),
    });
    lastCueDist = pos;
  }

  cues.push({
    km: +(totalDistM / 1000).toFixed(2),
    type: 'end',
    segment_distance_m: Math.round(totalDistM - lastCueDist),
    bearing_change: 0,
  });

  return cues;
}

function compute(points: Trackpoint[]): Computed {
  if (points.length < 2) {
    throw new Error('GPX must contain at least 2 trackpoints');
  }

  const smoothed = smoothElevation(points);

  let totalDist = 0;
  let gain = 0;
  let loss = 0;
  let minEle = smoothed[0].ele;
  let maxEle = smoothed[0].ele;
  let maxGrade = 0;

  // Climb extraction state
  const minClimbLen = 500;   // meters
  const minAvgGrade = 3;     // %
  const climbs: Climb[] = [];
  let climbStartIdx: number | null = null;
  let climbStartDist = 0;
  let climbStartEle = 0;
  let climbMaxGrade = 0;
  let consecutiveDescent = 0; // meters of descent that ends a climb

  // Per-segment iteration
  const segDists: number[] = [0];
  for (let i = 1; i < smoothed.length; i++) {
    const a = smoothed[i - 1];
    const b = smoothed[i];
    const dist = haversineMeters(a, b);
    if (dist <= 0) {
      segDists.push(totalDist);
      continue;
    }
    totalDist += dist;
    segDists.push(totalDist);

    const dEle = b.ele - a.ele;
    if (dEle > 0) gain += dEle;
    else loss += -dEle;

    if (b.ele < minEle) minEle = b.ele;
    if (b.ele > maxEle) maxEle = b.ele;

    const grade = (dEle / dist) * 100;
    if (grade > maxGrade) maxGrade = grade;

    // Climb tracking on smoothed-segment grade
    if (grade >= 1) {
      // climbing or rolling-up
      if (climbStartIdx === null) {
        climbStartIdx = i - 1;
        climbStartDist = totalDist - dist;
        climbStartEle = a.ele;
        climbMaxGrade = grade;
      } else {
        if (grade > climbMaxGrade) climbMaxGrade = grade;
      }
      consecutiveDescent = 0;
    } else if (grade < 0) {
      consecutiveDescent += -dEle;
      // If sustained descent > 30m, close any open climb
      if (climbStartIdx !== null && consecutiveDescent > 30) {
        const climbEndDist = totalDist - dist; // before this descent began affecting
        const lengthM = climbEndDist - climbStartDist;
        const climbGain = smoothed[i - 1].ele - climbStartEle;
        if (lengthM >= minClimbLen) {
          const avgGrade = (climbGain / lengthM) * 100;
          if (avgGrade >= minAvgGrade) {
            const c: Climb = {
              start_km: +(climbStartDist / 1000).toFixed(2),
              end_km: +(climbEndDist / 1000).toFixed(2),
              length_km: +(lengthM / 1000).toFixed(2),
              gain_m: Math.round(climbGain),
              avg_grade: +avgGrade.toFixed(2),
              max_grade: +climbMaxGrade.toFixed(2),
              category: '4',
            };
            c.category = categorizeClimb(c);
            climbs.push(c);
          }
        }
        climbStartIdx = null;
        consecutiveDescent = 0;
        climbMaxGrade = 0;
      }
    }
  }

  // Close any trailing climb at end of route
  if (climbStartIdx !== null) {
    const lengthM = totalDist - climbStartDist;
    const climbGain = smoothed[smoothed.length - 1].ele - climbStartEle;
    if (lengthM >= minClimbLen) {
      const avgGrade = (climbGain / lengthM) * 100;
      if (avgGrade >= minAvgGrade) {
        const c: Climb = {
          start_km: +(climbStartDist / 1000).toFixed(2),
          end_km: +(totalDist / 1000).toFixed(2),
          length_km: +(lengthM / 1000).toFixed(2),
          gain_m: Math.round(climbGain),
          avg_grade: +avgGrade.toFixed(2),
          max_grade: +climbMaxGrade.toFixed(2),
          category: '4',
        };
        c.category = categorizeClimb(c);
        climbs.push(c);
      }
    }
  }

  const avgGrade = totalDist > 0 ? (gain / totalDist) * 100 : 0;

  // Loop detection
  const startEnd = haversineMeters(smoothed[0], smoothed[smoothed.length - 1]);
  let loopType: 'loop' | 'out_and_back' | 'point_to_point';
  if (startEnd < 200) loopType = 'loop';
  else {
    // Out-and-back if midpoint of path is far from start/end midline — heuristic:
    // check if reverse half overlaps forward half within 100m bbox
    const mid = smoothed[Math.floor(smoothed.length / 2)];
    const midToStart = haversineMeters(mid, smoothed[0]);
    const midToEnd = haversineMeters(mid, smoothed[smoothed.length - 1]);
    loopType = startEnd < 1000 && Math.abs(midToStart - midToEnd) > totalDist * 0.3
      ? 'out_and_back'
      : 'point_to_point';
  }

  // Build LineString WKT — trim to <= 5000 points to keep payload sane
  let pts = smoothed;
  if (pts.length > 5000) {
    const stride = Math.ceil(pts.length / 5000);
    pts = pts.filter((_, i) => i % stride === 0 || i === pts.length - 1);
  }
  const wkt =
    'SRID=4326;LINESTRING(' +
    pts.map((p) => `${p.lng.toFixed(6)} ${p.lat.toFixed(6)}`).join(',') +
    ')';

  // Elevation profile — downsample full segDists/smoothed to ~500 (km, ele) pairs
  const TARGET_POINTS = 500;
  const elevation_profile: Array<{ km: number; ele: number }> = [];
  const stride = Math.max(1, Math.ceil(smoothed.length / TARGET_POINTS));
  for (let i = 0; i < smoothed.length; i += stride) {
    elevation_profile.push({
      km: +(segDists[i] / 1000).toFixed(3),
      ele: Math.round(smoothed[i].ele),
    });
  }
  // Always include the last point exactly
  if (elevation_profile.length === 0 ||
      elevation_profile[elevation_profile.length - 1].km !== +(totalDist / 1000).toFixed(3)) {
    elevation_profile.push({
      km: +(totalDist / 1000).toFixed(3),
      ele: Math.round(smoothed[smoothed.length - 1].ele),
    });
  }

  // Cue sheet (turn-by-turn)
  const cue_sheet = computeCueSheet(smoothed, segDists, totalDist);

  return {
    distance_km: +(totalDist / 1000).toFixed(2),
    elevation_gain_m: Math.round(gain),
    elevation_loss_m: Math.round(loss),
    min_elevation_m: Math.round(minEle),
    max_elevation_m: Math.round(maxEle),
    avg_grade_pct: +avgGrade.toFixed(2),
    max_grade_pct: +maxGrade.toFixed(2),
    loop_type: loopType,
    climbs,
    wkt,
    elevation_profile,
    cue_sheet,
  };
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

  // Admin guard
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: cors });
  }

  let body: { route_id?: string; gpx_path?: string };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }

  const { route_id, gpx_path } = body;
  if (!route_id || !gpx_path) {
    return new Response('Missing route_id or gpx_path', { status: 400, headers: cors });
  }

  // 1. Download GPX
  const { data: file, error: dlErr } = await adminClient.storage
    .from('route-assets').download(gpx_path);
  if (dlErr || !file) {
    return new Response(`GPX download failed: ${dlErr?.message ?? 'unknown'}`, {
      status: 400, headers: cors,
    });
  }
  const gpxText = await file.text();

  // 2. Parse + compute
  let result: Computed;
  let pointsCount = 0;
  try {
    const points = parseTrackpoints(gpxText);
    pointsCount = points.length;
    if (points.length < 2) {
      return new Response('GPX has fewer than 2 trackpoints', { status: 400, headers: cors });
    }
    result = compute(points);
  } catch (e) {
    return new Response(`Parse failed: ${(e as Error).message}`, { status: 400, headers: cors });
  }

  // 3. Update route — note: bbox/start/end auto-filled by trigger from `path`
  const { error: updErr } = await adminClient
    .from('routes')
    .update({
      path: result.wkt,
      gpx_path,
      distance_km: result.distance_km,
      elevation_gain_m: result.elevation_gain_m,
      elevation_loss_m: result.elevation_loss_m,
      min_elevation_m: result.min_elevation_m,
      max_elevation_m: result.max_elevation_m,
      avg_grade_pct: result.avg_grade_pct,
      max_grade_pct: result.max_grade_pct,
      loop_type: result.loop_type,
      climbs: result.climbs,
      elevation_profile: result.elevation_profile,
      cue_sheet: result.cue_sheet,
      updated_at: new Date().toISOString(),
    })
    .eq('id', route_id);

  if (updErr) {
    return new Response(`Update failed: ${updErr.message}`, { status: 500, headers: cors });
  }

  // 4. Re-compute difficulty
  await adminClient.rpc('compute_route_difficulty', { p_route_id: route_id });

  return new Response(JSON.stringify({
    ok: true,
    points_count: pointsCount,
    distance_km: result.distance_km,
    elevation_gain_m: result.elevation_gain_m,
    elevation_loss_m: result.elevation_loss_m,
    max_grade_pct: result.max_grade_pct,
    climbs_count: result.climbs.length,
    loop_type: result.loop_type,
    cue_count: result.cue_sheet.length,
  }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
