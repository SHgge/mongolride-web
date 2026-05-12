import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_URL = Deno.env.get('APP_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ubriders-club.vercel.app';

interface ReminderWindow {
  label: 't_minus_24h' | 't_minus_3h' | 't_minus_30m';
  hours: number;
  tolerance: number;
  templateKey: string;
}

const WINDOWS: ReminderWindow[] = [
  { label: 't_minus_24h', hours: 24,  tolerance: 7.5, templateKey: 'event.reminder.t_24h' },
  { label: 't_minus_3h',  hours: 3,   tolerance: 7.5, templateKey: 'event.reminder.t_3h'  },
  { label: 't_minus_30m', hours: 0.5, tolerance: 7.5, templateKey: 'event.reminder.t_30m' },
];

// EP-05: pull the freshest weather snapshot for an event's meet location.
// Uses the same coarse 0.05° grid as the cache. Returns null on miss.
async function loadWeatherForEvent(
  admin: SupabaseClient,
  meetLat: number | null,
  meetLng: number | null,
  meetAt: string,
): Promise<Record<string, unknown> | null> {
  if (meetLat == null || meetLng == null) return null;
  const lat_grid    = Math.round(meetLat * 20) / 20;
  const lng_grid    = Math.round(meetLng * 20) / 20;
  const at = new Date(meetAt);
  at.setUTCMinutes(0, 0, 0);
  const hour_bucket = at.toISOString();
  const { data } = await admin
    .from('weather_snapshots')
    .select('temp_c, feels_like_c, wind_speed_ms, aqi_us, pm10_ugm3, precip_amount_mm, uv_index, sunrise_at, sunset_at, fetched_at, is_stale, provider')
    .eq('lat_grid', lat_grid)
    .eq('lng_grid', lng_grid)
    .eq('hour_bucket', hour_bucket)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

// EP-05: classify and decide whether to add a "weather warning" line.
async function classifyRisk(
  admin: SupabaseClient,
  w: Record<string, unknown>,
): Promise<string | null> {
  const { data } = await admin.rpc('classify_weather_risk', {
    p_temp_c:       w.temp_c,
    p_feels_like_c: w.feels_like_c,
    p_wind_ms:      w.wind_speed_ms,
    p_aqi:          w.aqi_us,
    p_pm10_ugm3:    w.pm10_ugm3,
    p_precip_mm:    w.precip_amount_mm,
    p_thunder_prob: null,
    p_uv:           w.uv_index,
  });
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.overall as string | undefined) ?? null;
}

function buildWeatherSection(w: Record<string, unknown> | null, overall: string | null, windowLabel: string): string {
  if (!w) return '';
  const lines: string[] = [];
  if (typeof w.temp_c === 'number') {
    lines.push(`Температур: ${w.temp_c.toFixed(0)}°C` + (typeof w.feels_like_c === 'number' && w.feels_like_c !== w.temp_c ? ` (мэдрэмж ${(w.feels_like_c as number).toFixed(0)}°C)` : ''));
  }
  if (typeof w.wind_speed_ms === 'number') {
    lines.push(`Салхи: ${w.wind_speed_ms.toFixed(1)} м/с`);
  }
  if (typeof w.aqi_us === 'number') {
    lines.push(`Агаарын чанар (AQI): ${w.aqi_us}`);
  }
  if (typeof w.precip_amount_mm === 'number' && w.precip_amount_mm > 0) {
    lines.push(`Хур тунадас: ${w.precip_amount_mm.toFixed(1)} мм`);
  }
  if (typeof w.uv_index === 'number' && w.uv_index >= 6) {
    lines.push(`UV: ${w.uv_index.toFixed(0)}`);
  }
  if (lines.length === 0) return '';

  const banner = (overall === 'orange' || overall === 'red' || overall === 'black')
    ? `<p style="background:#fef3c7;border-left:3px solid #f59e0b;padding:8px 10px;font-size:13px;color:#92400e">⚠️ Цаг агаарын эрсдэл өндөр — заавал хэрэглэлээ нягтлана уу.</p>`
    : '';
  // T-30m specifically: AQI mask reminder
  let extra = '';
  if (windowLabel === 't_minus_30m' && typeof w.aqi_us === 'number' && w.aqi_us >= 100) {
    extra = `<p style="font-size:12px;color:#b45309">PM2.5 маск (KN95/N95) хэрэглэхээ мартуузай.</p>`;
  }
  return `
    ${banner}
    <p style="margin-top:10px"><strong>Цаг агаар:</strong></p>
    <ul style="font-size:13px;color:#374151;padding-left:18px">
      ${lines.map((l) => `<li>${l}</li>`).join('')}
    </ul>
    ${extra}
  `;
}

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  // EP-06: email + in_app delivery handled by dispatch_notification → outbox → process-notification-outbox.
  // We just orchestrate which RSVPs get which reminder window.

  let sent = 0;
  for (const w of WINDOWS) {
    const targetTime = Date.now() + w.hours * 3600_000;
    const start = new Date(targetTime - w.tolerance * 60_000).toISOString();
    const end   = new Date(targetTime + w.tolerance * 60_000).toISOString();

    const { data: events } = await admin
      .from('events')
      .select('id, title, meet_at, meet_location_name, required_gear, meet_lat, meet_lng')
      .eq('status', 'published')
      .gte('meet_at', start)
      .lte('meet_at', end);

    for (const event of events ?? []) {
      // EP-05: load weather + classify risk once per event (not per RSVP)
      const weather = await loadWeatherForEvent(admin, event.meet_lat, event.meet_lng, event.meet_at);
      const overall = weather ? await classifyRisk(admin, weather) : null;
      const weatherSection = buildWeatherSection(weather, overall, w.label);
      const { data: rsvps } = await admin
        .from('event_rsvps')
        .select('id, user_id, reminders_sent')
        .eq('event_id', event.id)
        .eq('status', 'confirmed');

      const meetAtLocal = new Date(event.meet_at).toLocaleString('mn-MN', {
        timeZone: 'Asia/Ulaanbaatar',
        dateStyle: 'long',
        timeStyle: 'short',
      });
      const isAqiHigh = weather && typeof (weather as { aqi_us?: number }).aqi_us === 'number'
        && (weather as { aqi_us: number }).aqi_us >= 100;

      for (const rsvp of rsvps ?? []) {
        const remindersSent = (rsvp.reminders_sent ?? []) as string[];
        if (remindersSent.includes(w.label)) continue;

        // EP-06 dispatcher: handles email + in_app per user prefs.
        // Idempotent via reminders_sent[] + idempotency_key.
        const { error: dErr } = await admin.rpc('dispatch_notification' as never, {
          p_template_key: w.templateKey,
          p_recipient_user_id: rsvp.user_id,
          p_variables: {
            event_title: event.title,
            meet_at_local: meetAtLocal,
            meet_location: event.meet_location_name,
            required_gear: (event.required_gear ?? []).join(', '),
            weather_section: weatherSection,
            event_url: `${APP_URL}/events/${event.id}`,
            link: `/events/${event.id}`,
            // T-30m specific: AQI mask reminder
            aqi_warning: w.label === 't_minus_30m' && isAqiHigh ? 'true' : '',
            aqi_us: (weather as { aqi_us?: number } | null)?.aqi_us ?? null,
          },
          // event_lifecycle severity is normal; severe weather reminders go via notify-weather-alert
          p_severity: overall === 'red' || overall === 'black' ? 'high' : 'normal',
          p_bypass_dnd: false,
          p_idempotency_key: `event.reminder:${event.id}:${rsvp.user_id}:${w.label}`,
          p_source_epic: 'EP-03',
          p_source_event: `event.reminder.${w.label}`,
          p_source_target_id: event.id,
          p_force_channels: null,
        } as never);

        if (dErr) {
          console.error('[reminders] dispatch failed:', dErr.message);
          continue;
        }

        await admin
          .from('event_rsvps')
          .update({ reminders_sent: [...remindersSent, w.label] })
          .eq('id', rsvp.id);

        sent++;
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
