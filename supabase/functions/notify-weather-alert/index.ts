// EP-05 → migrated to EP-06 dispatcher.
// Translates an event_alerts row into a template_key + variables and fans
// it out to organisers + co-organisers + sweep_rider + active RSVPs.
// EP-06 dispatcher applies user prefs, throttle, quiet hours, etc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APP_URL = Deno.env.get('APP_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ubriders-club.vercel.app';

interface Alert {
  id: string;
  event_id: string;
  alert_type: string;       // cold | wind | aqi | dust | thunderstorm | etc.
  severity: string;         // info | warning | severe | hazardous | cancel_recommended
  forecast_window: string;
  values_snapshot: Record<string, number | null>;
}

interface Event {
  id: string;
  title: string;
  meet_at: string;
  meet_location_name: string;
  organizer_id: string;
  co_organizer_ids: string[];
  sweep_rider_id: string | null;
}

// Map alert_type → template_key. Not every type has a dedicated template;
// fall back to 'weather.cold' family if specific one missing (dispatcher
// will then skip with template_not_found, which is fine).
const TEMPLATE_KEY: Record<string, string> = {
  cold: 'weather.cold',
  heat: 'weather.cold',          // reuse copy; thresholds handled upstream
  wind: 'weather.wind',
  aqi:  'weather.aqi',
  dust: 'weather.dust',
  thunderstorm: 'weather.thunderstorm',
  rain: 'weather.thunderstorm',  // reuse — rain alerts surface as thunderstorm prep
  snow: 'weather.cold',
  uv:   'weather.cold',
};

// Severity in event_alerts → dispatcher severity (severe bypasses DND).
const SEV_MAP: Record<string, 'normal' | 'high' | 'severe'> = {
  info: 'normal',
  warning: 'normal',
  severe: 'severe',
  hazardous: 'severe',
  cancel_recommended: 'severe',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  let body: { alert_id?: string };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  const alertId = body.alert_id;
  if (!alertId) return new Response('Missing alert_id', { status: 400, headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: alertRow, error: aErr } = await admin
    .from('event_alerts').select('*').eq('id', alertId).single();
  if (aErr || !alertRow) {
    return new Response(`Alert not found: ${aErr?.message}`, { status: 404, headers: cors });
  }
  const alert = alertRow as unknown as Alert;

  const { data: ev, error: eErr } = await admin
    .from('events')
    .select('id, title, meet_at, meet_location_name, organizer_id, co_organizer_ids, sweep_rider_id')
    .eq('id', alert.event_id).single();
  if (eErr || !ev) {
    return new Response(`Event not found: ${eErr?.message}`, { status: 404, headers: cors });
  }
  const event = ev as unknown as Event;

  // Recipients
  const recipients = new Set<string>();
  recipients.add(event.organizer_id);
  for (const co of event.co_organizer_ids ?? []) recipients.add(co);
  if (event.sweep_rider_id) recipients.add(event.sweep_rider_id);
  const { data: rsvps } = await admin
    .from('event_rsvps').select('user_id')
    .eq('event_id', event.id)
    .in('status', ['confirmed', 'pending_payment', 'attended']);
  for (const r of rsvps ?? []) recipients.add(r.user_id as string);

  const userIds = Array.from(recipients);
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, recipients: 0 }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const templateKey = TEMPLATE_KEY[alert.alert_type] ?? 'weather.cold';
  const severity    = SEV_MAP[alert.severity] ?? 'normal';
  const v           = alert.values_snapshot ?? {};

  let totalQueued = 0, totalSuppressed = 0;

  for (const userId of userIds) {
    const { data, error } = await admin.rpc('dispatch_notification' as never, {
      p_template_key: templateKey,
      p_recipient_user_id: userId,
      p_variables: {
        event_title: event.title,
        temp_c: v.temp_c,
        feels_like_c: v.feels_like_c,
        wind_speed_ms: v.wind_speed_ms,
        aqi_us: v.aqi_us,
        pm10_ugm3: v.pm10_ugm3,
        precip_amount_mm: v.precip_amount_mm,
        uv_index: v.uv_index,
        event_url: `${APP_URL}/events/${event.id}`,
        link: `/events/${event.id}`,
      },
      p_severity: severity,
      // severe weather bypasses DND if user opted in (allow_severe_during_dnd default true)
      p_bypass_dnd: severity === 'severe',
      p_idempotency_key: `weather:${alert.id}:${userId}`,
      p_source_epic: 'EP-05',
      p_source_event: `weather.${alert.alert_type}`,
      p_source_target_id: alert.id,
      p_force_channels: null,
    } as never);
    if (error) continue;
    const row = (Array.isArray(data) ? data[0] : data) as { queued?: number; suppressed?: number } | undefined;
    totalQueued += row?.queued ?? 0;
    totalSuppressed += row?.suppressed ?? 0;
  }

  return new Response(JSON.stringify({
    ok: true,
    recipients: userIds.length,
    queued: totalQueued,
    suppressed: totalSuppressed,
  }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
