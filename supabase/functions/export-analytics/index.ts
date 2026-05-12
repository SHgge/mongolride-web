// EP-07 P0-5: export-analytics
//
// POST { view, filters }
//   view = 'event_list' | 'member_reliability' | 'cohort' | 'weather_scatter'
//
// Streams CSV with UTF-8 BOM. Admin-only. Audit-logs every export.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BOM = '﻿';

function csvEscape(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtUbDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtPct(v: number | null): string {
  return v != null ? (v * 100).toFixed(1) : '';
}

interface Filters {
  from?: string;
  to?: string;
  discipline?: string;
  organizer?: string;
  metric?: 'aqi' | 'temp' | 'wind';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

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
  if (profile?.role !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: cors });
  }

  let body: { view?: string; filters?: Filters };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  const { view, filters = {} } = body;
  if (!view) return new Response('Missing view', { status: 400, headers: cors });

  let header: string[] = [];
  let rows: string[][] = [];

  if (view === 'event_list') {
    const { data, error } = await admin.rpc('event_analytics_list', {
      p_from: filters.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString(),
      p_to:   filters.to   ?? new Date().toISOString(),
      p_discipline: filters.discipline ?? null,
      p_organizer:  filters.organizer  ?? null,
      p_limit: 10000,
      p_offset: 0,
    });
    if (error) {
      return new Response(`RPC failed: ${error.message}`, { status: 500, headers: cors });
    }
    header = [
      'Title','Meet at (UB)','Discipline','Capacity','RSVPs',
      'Attended','No-show','Late','Fill %','Attendance %','On-time %','AQI','Temp °C',
    ];
    rows = (data ?? []).map((r: Record<string, unknown>) => [
      String(r.title ?? ''),
      fmtUbDate(r.meet_at as string),
      String(r.discipline ?? ''),
      String(r.capacity ?? ''),
      String(r.rsvps_total ?? 0),
      String(r.attended_count ?? 0),
      String(r.no_show_count ?? 0),
      String(r.late_arrival_count ?? 0),
      fmtPct(r.fill_rate as number | null),
      fmtPct(r.attendance_rate as number | null),
      fmtPct(r.on_time_rate as number | null),
      String(r.weather_aqi ?? ''),
      String(r.weather_temp_c ?? ''),
    ]);
  } else if (view === 'member_reliability') {
    const { data, error } = await admin.rpc('at_risk_members', { p_limit: 1000 });
    if (error) return new Response(`RPC failed: ${error.message}`, { status: 500, headers: cors });
    header = [
      'User ID','Name','Role','Attended (90d)','No-show (90d)','Cancelled (90d)',
      'Last event (UB)','Reliability','Reason',
    ];
    rows = (data ?? []).map((r: Record<string, unknown>) => [
      String(r.user_id ?? ''),
      String(r.full_name ?? ''),
      String(r.role ?? ''),
      String(r.attended_90d ?? 0),
      String(r.no_show_90d ?? 0),
      String(r.cancelled_90d ?? 0),
      fmtUbDate(r.last_event_at as string | null),
      String(r.reliability_label ?? ''),
      String(r.reason ?? ''),
    ]);
  } else if (view === 'cohort') {
    const { data, error } = await admin.rpc('cohort_retention_grid', {
      p_from: filters.from ?? new Date(Date.now() - 365 * 86_400_000).toISOString(),
    });
    if (error) return new Response(`RPC failed: ${error.message}`, { status: 500, headers: cors });
    header = ['Cohort month','Months since','Retention %','Cohort size'];
    rows = (data ?? []).map((r: Record<string, unknown>) => [
      String(r.cohort_month ?? ''),
      String(r.months_since ?? ''),
      String(r.retention_pct ?? ''),
      String(r.cohort_size ?? ''),
    ]);
  } else if (view === 'weather_scatter') {
    const { data, error } = await admin.rpc('weather_impact_scatter', {
      p_metric: filters.metric ?? 'aqi',
    });
    if (error) return new Response(`RPC failed: ${error.message}`, { status: 500, headers: cors });
    header = ['Event ID','Title','Meet at (UB)','X (metric)','Y (attendance %)'];
    rows = (data ?? []).map((r: Record<string, unknown>) => [
      String(r.event_id ?? ''),
      String(r.label ?? ''),
      fmtUbDate(r.meet_at as string),
      String(r.x ?? ''),
      r.y != null ? ((r.y as number) * 100).toFixed(1) : '',
    ]);
  } else {
    return new Response(`Unknown view: ${view}`, { status: 400, headers: cors });
  }

  // Audit
  await admin.from('audit_log').insert({
    actor_id: user.id,
    action: 'analytics.exported',
    details: { view, filters, row_count: rows.length },
  });

  const csv = BOM + [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="analytics-${view}-${Date.now()}.csv"`,
    },
  });
});
