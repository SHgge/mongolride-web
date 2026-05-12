import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  let body: { event_id?: string; reason?: string };
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  const { event_id, reason } = body;
  if (!event_id) return new Response('Missing event_id', { status: 400, headers: cors });

  // Verify caller is admin or organizer
  const { data: profile } = await userClient.from('profiles').select('role').eq('id', user.id).single();
  const { data: event } = await userClient.from('events').select('organizer_id, co_organizer_ids, title').eq('id', event_id).single();
  if (!event) return new Response('Event not found', { status: 404, headers: cors });

  const isAuthorized = profile?.role === 'admin'
    || event.organizer_id === user.id
    || (event.co_organizer_ids ?? []).includes(user.id);
  if (!isAuthorized) return new Response('Forbidden', { status: 403, headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Set status to cancelled
  await admin.from('events')
    .update({ status: 'cancelled', cancellation_reason: reason ?? null, updated_at: new Date().toISOString() })
    .eq('id', event_id);

  // Cancel all active RSVPs + notify
  const { data: rsvps } = await admin.from('event_rsvps')
    .select('id, user_id').eq('event_id', event_id).in('status', ['confirmed', 'waitlist', 'pending_payment']);

  const APP_URL = Deno.env.get('APP_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ubriders-club.vercel.app';

  for (const rsvp of rsvps ?? []) {
    await admin.from('event_rsvps')
      .update({ status: 'cancelled', cancellation_reason: reason ?? 'Event cancelled by admin', updated_at: new Date().toISOString() })
      .eq('id', rsvp.id);

    // EP-06: dispatcher fans email + in_app per user prefs
    await admin.rpc('dispatch_notification' as never, {
      p_template_key: 'event.cancelled',
      p_recipient_user_id: rsvp.user_id,
      p_variables: {
        event_title: event.title,
        reason: reason ?? '',
        events_url: `${APP_URL}/events`,
        link: `/events/${event_id}`,
      },
      p_severity: 'normal',
      p_bypass_dnd: false,
      p_idempotency_key: `event.cancelled:${event_id}:${rsvp.user_id}`,
      p_source_epic: 'EP-03',
      p_source_event: 'event.cancelled',
      p_source_target_id: event_id,
      p_force_channels: null,
    } as never);
  }

  return new Response(JSON.stringify({ ok: true, cancelled_rsvps: rsvps?.length ?? 0 }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
