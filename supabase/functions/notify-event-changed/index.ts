// EP-03 → migrated to EP-06 dispatcher.
// Fan out 'event.changed' to all confirmed/pending_payment RSVPs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APP_URL = Deno.env.get('APP_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ubriders-club.vercel.app';

const FIELD_LABEL: Record<string, string> = {
  meet_at: 'Уулзах цаг',
  roll_out_at: 'Хөдлөх цаг',
  end_at: 'Дуусах цаг',
  meet_location_name: 'Уулзах газар',
  meet_lat: 'Координат',
  meet_lng: 'Координат',
  route_id: 'Маршрут',
  required_gear: 'Шаардагдах хэрэглэл',
  capacity: 'Хүчин чадал',
  drop_policy: 'Бодлого',
  fee_amount: 'Төлбөр',
  description: 'Тайлбар',
  title: 'Гарчиг',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401, headers: cors });

  let body: { event_id?: string; changed_fields?: string[] };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  const { event_id, changed_fields = [] } = body;
  if (!event_id) return new Response('Missing event_id', { status: 400, headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: event } = await admin.from('events').select('id, title').eq('id', event_id).single();
  if (!event) return new Response('Event not found', { status: 404, headers: cors });

  const { data: rsvps } = await admin
    .from('event_rsvps')
    .select('user_id')
    .eq('event_id', event_id)
    .in('status', ['confirmed', 'pending_payment']);

  const changes = (changed_fields ?? []).map((f) => FIELD_LABEL[f] ?? f);

  let queued = 0, suppressed = 0;
  for (const rsvp of rsvps ?? []) {
    const { data, error } = await admin.rpc('dispatch_notification' as never, {
      p_template_key: 'event.changed',
      p_recipient_user_id: rsvp.user_id,
      p_variables: {
        event_title: event.title,
        changes,
        event_url: `${APP_URL}/events/${event_id}`,
        link: `/events/${event_id}`,
      },
      p_severity: 'normal',
      p_bypass_dnd: false,
      p_idempotency_key: `event.changed:${event_id}:${rsvp.user_id}:${(changed_fields ?? []).join(',')}`,
      p_source_epic: 'EP-03',
      p_source_event: 'event.changed',
      p_source_target_id: event_id,
      p_force_channels: null,
    } as never);
    if (error) continue;
    const row = (Array.isArray(data) ? data[0] : data) as { queued?: number; suppressed?: number } | undefined;
    queued += row?.queued ?? 0;
    suppressed += row?.suppressed ?? 0;
  }

  return new Response(JSON.stringify({ ok: true, recipients: rsvps?.length ?? 0, queued, suppressed }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
