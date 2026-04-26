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

  for (const rsvp of rsvps ?? []) {
    await admin.from('event_rsvps')
      .update({ status: 'cancelled', cancellation_reason: reason ?? 'Event cancelled by admin', updated_at: new Date().toISOString() })
      .eq('id', rsvp.id);
    await admin.from('notifications').insert({
      user_id: rsvp.user_id,
      type: 'event.cancelled',
      title: `Эвент цуцлагдлаа: ${event.title}`,
      message: reason ?? 'Зохион байгуулагч эвентийг цуцалсан байна.',
      link: `/events/${event_id}`,
    });
  }

  return new Response(JSON.stringify({ ok: true, cancelled_rsvps: rsvps?.length ?? 0 }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
