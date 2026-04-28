// EP-04 P0-8: download-clean-gpx
// Input:  GET ?route_id=<uuid>
// Output: clean GPX file (Content-Type: application/gpx+xml)
//
// Generates a normalized GPX from the route's stored path + climbs metadata.
// Strips author/timestamps for privacy; uses route title; includes elevations
// from path Z if present (else 0). Caches the cleaned file in storage at
// <route_id>/gpx/cleaned.gpx for next time, then redirects to a public URL.
//
// Visibility: respects routes RLS (anyone can fetch a public route's clean GPX).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildGpx(opts: {
  title: string;
  description: string;
  coords: Array<[number, number]>;
}): string {
  const trkpts = opts.coords
    .map(([lng, lat]) =>
      `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MongolRide" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(opts.title)}</name>
    <desc>${escapeXml(opts.description)}</desc>
  </metadata>
  <trk>
    <name>${escapeXml(opts.title)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }

  const url = new URL(req.url);
  const route_id = url.searchParams.get('route_id');
  if (!route_id) {
    return new Response('Missing route_id', { status: 400, headers: cors });
  }

  // Public endpoint: anonymous browsers download via plain <a href>.
  // verify_jwt is disabled in supabase/config.toml; RLS is still honored on
  // the data layer because we use the user client (auth header if present,
  // anon otherwise) for every read.
  const auth = req.headers.get('Authorization');
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    auth ? { global: { headers: { Authorization: auth } } } : undefined,
  );

  // RLS-respecting fetch: only published+visible routes are returned for non-owner/non-admin.
  const { data: route, error: rErr } = await userClient
    .from('routes')
    .select('id, title, description, distance_km, status, visibility')
    .eq('id', route_id)
    .single();
  if (rErr || !route) {
    return new Response('Not found', { status: 404, headers: cors });
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const cleanedPath = `${route_id}/gpx/cleaned.gpx`;

  // Try cache first
  const { data: cached } = await adminClient.storage
    .from('route-assets').download(cleanedPath);
  if (cached) {
    const text = await cached.text();
    return new Response(text, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/gpx+xml',
        'Content-Disposition': `attachment; filename="${route_id}.gpx"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // Build fresh — userClient RPC respects visibility rules
  const { data: pathJson, error: pErr } = await userClient
    .rpc('get_route_path_geojson', { p_route_id: route_id });
  if (pErr || !pathJson) {
    return new Response(`Route geometry unavailable: ${pErr?.message ?? 'no data'}`, {
      status: 500, headers: cors,
    });
  }
  const coords = (pathJson as { coordinates?: Array<[number, number]> }).coordinates;
  if (!coords || coords.length < 2) {
    return new Response('Route geometry unavailable', { status: 500, headers: cors });
  }

  const gpxText = buildGpx({
    title: route.title,
    description: route.description ?? '',
    coords,
  });

  // Cache it (best-effort)
  try {
    await adminClient.storage.from('route-assets').upload(
      cleanedPath,
      new Blob([gpxText], { type: 'application/gpx+xml' }),
      { upsert: true, contentType: 'application/gpx+xml' },
    );
    await adminClient.from('routes')
      .update({ cleaned_gpx_path: cleanedPath })
      .eq('id', route_id);
  } catch {
    // Cache miss is non-fatal — still return the body
  }

  return new Response(gpxText, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="${route_id}.gpx"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
