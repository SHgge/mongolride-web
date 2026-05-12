// EP-09 P0-4: export-event-attendance
//
// POST { event_id: uuid, format?: 'csv', fields?: string[] }
//   Returns CSV (UTF-8 with BOM for Excel-MN compatibility) of all RSVPs
//   for the event. Authorisation: admin OR organizer/co-organizer.
//   Sorted by checked_in_at ASC NULLS LAST so no-shows surface at the bottom.
//
// XLSX deferred (CSV is enough for V1.0 per the spec).

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

interface RsvpRow {
  id: string;
  user_id: string;
  status: string;
  guest_count: number | null;
  waitlist_position: number | null;
  checked_in_at: string | null;
  checked_in_method: string | null;
  checked_in_late: boolean | null;
  checked_in_override: boolean | null;
  cancelled_at: string | null;
  notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  selected_route_id: string | null;
  created_at: string;
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

  let body: { event_id?: string; format?: string; fields?: string[] };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  const { event_id, format = 'csv', fields = [] } = body;
  if (!event_id) return new Response('Missing event_id', { status: 400, headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Authorisation: admin OR organizer / co-organizer of this event
  const { data: ev, error: evErr } = await admin
    .from('events')
    .select('id, title, meet_at, organizer_id, co_organizer_ids')
    .eq('id', event_id).single();
  if (evErr || !ev) return new Response('Event not found', { status: 404, headers: cors });

  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', user.id).single();

  const isAuthorised =
    callerProfile?.role === 'admin'
    || ev.organizer_id === user.id
    || (ev.co_organizer_ids ?? []).includes(user.id);
  if (!isAuthorised) return new Response('Forbidden', { status: 403, headers: cors });

  // Pull rows. Sort by checked_in_at ASC, NULLS last
  const { data: rsvps, error: rErr } = await admin
    .from('event_rsvps')
    .select(`
      id, user_id, status, guest_count, waitlist_position,
      checked_in_at, checked_in_method, checked_in_late, checked_in_override,
      cancelled_at, notes, emergency_contact_name, emergency_contact_phone,
      selected_route_id, created_at
    `)
    .eq('event_id', event_id)
    .order('checked_in_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (rErr) {
    return new Response(`Fetch failed: ${rErr.message}`, { status: 500, headers: cors });
  }

  const rows = (rsvps ?? []) as RsvpRow[];

  // Resolve names + emails
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const profileMap = new Map<string, { full_name: string; role: string | null }>();
  if (userIds.length > 0) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, full_name, role')
      .in('id', userIds);
    for (const p of profs ?? []) {
      profileMap.set(p.id as string, {
        full_name: (p.full_name as string) ?? '',
        role: (p.role as string | null) ?? null,
      });
    }
  }
  // Emails via auth admin (one-by-one — small lists in practice)
  const emailMap = new Map<string, string>();
  for (const uid of userIds) {
    try {
      const { data } = await admin.auth.admin.getUserById(uid);
      if (data?.user?.email) emailMap.set(uid, data.user.email);
    } catch {
      // ignore
    }
  }

  // Build CSV
  const header = [
    'No.', 'Name', 'Email', 'Role', 'RSVP Status',
    'Checked In At (UB)', 'Method', 'Late', 'Override', 'Guests',
    'Emergency Contact', 'Emergency Phone', 'Notes', 'Cancelled At',
  ];
  const lines: string[] = [header.map(csvEscape).join(',')];

  rows.forEach((r, i) => {
    const p = profileMap.get(r.user_id);
    lines.push([
      i + 1,
      p?.full_name ?? '',
      emailMap.get(r.user_id) ?? '',
      p?.role ?? '',
      r.status,
      fmtUbDate(r.checked_in_at),
      r.checked_in_method ?? '',
      r.checked_in_late ? 'yes' : '',
      r.checked_in_override ? 'yes' : '',
      r.guest_count ?? 0,
      r.emergency_contact_name ?? '',
      r.emergency_contact_phone ?? '',
      r.notes ?? '',
      fmtUbDate(r.cancelled_at),
    ].map(csvEscape).join(','));
  });

  // Audit
  await admin.from('audit_log').insert({
    actor_id: user.id,
    action: 'attendance.exported',
    target_id: event_id,
    details: { format, fields, row_count: rows.length },
  });

  const csv = BOM + lines.join('\n');
  const safeTitle = (ev.title ?? 'event').replace(/[^a-zа-яёөЀ-ӿ0-9-_]+/gi, '_').slice(0, 60);
  return new Response(csv, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance-${safeTitle}-${event_id}.csv"`,
    },
  });
});
