import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

interface EventRow {
  id: string;
  title: string;
  meet_at: string;
  roll_out_at: string;
  end_at: string | null;
  meet_location_name: string;
  discipline: string;
  distance_km: number | null;
  required_gear: string[];
}

function buildICS(event: EventRow): string {
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MongolRide//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@mongolride`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(new Date(event.meet_at))}`,
    `DTEND:${toICSDate(new Date(event.end_at ?? event.roll_out_at))}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:Meet ${event.meet_location_name}. Discipline: ${event.discipline}. Distance: ${event.distance_km ?? '—'}km.`,
    `LOCATION:${event.meet_location_name}`,
    'END:VEVENT','END:VCALENDAR',
  ].join('\r\n');
}

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

  let body: { rsvp_id?: string };
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  const { rsvp_id } = body;
  if (!rsvp_id) return new Response('Missing rsvp_id', { status: 400, headers: cors });

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: rsvp } = await adminClient
    .from('event_rsvps').select('*, events(*)')
    .eq('id', rsvp_id).single();
  if (!rsvp || rsvp.user_id !== user.id) {
    return new Response('Forbidden', { status: 403, headers: cors });
  }

  const event = rsvp.events as EventRow;
  const ics = buildICS(event);
  const meetDateStr = new Date(event.meet_at).toLocaleString('mn-MN');

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  let emailStatus = 0;
  if (RESEND_API_KEY && user.email) {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('FROM_EMAIL') ?? 'noreply@mongolride.mn',
        to: user.email,
        subject: `RSVP баталгаажлаа — ${event.title}`,
        html: `<p>Сайн байна уу,</p>
               <p><strong>${event.title}</strong> арга хэмжээнд таны бүртгэл амжилттай.</p>
               <p><strong>Уулзах цаг:</strong> ${meetDateStr}</p>
               <p><strong>Уулзах газар:</strong> ${event.meet_location_name}</p>
               <p><strong>Шаардагдах хэрэгсэл:</strong> ${event.required_gear.join(', ')}</p>`,
        attachments: [{
          filename: `${event.id}.ics`,
          content: btoa(ics),
          contentType: 'text/calendar',
        }],
      }),
    });
    emailStatus = emailRes.status;
  }

  // In-app notification
  await adminClient.from('notifications').insert({
    user_id: user.id,
    type: 'rsvp.confirmed',
    title: `RSVP баталгаажлаа: ${event.title}`,
    message: `${meetDateStr} — ${event.meet_location_name}`,
    link: `/events/${event.id}`,
  });

  return new Response(JSON.stringify({ ok: true, email_status: emailStatus, email_skipped: !RESEND_API_KEY }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
