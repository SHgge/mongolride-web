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

  let body: { event_id?: string; changed_fields?: string[] };
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  const { event_id, changed_fields } = body;
  if (!event_id) return new Response('Missing event_id', { status: 400, headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: event } = await admin.from('events').select('*').eq('id', event_id).single();
  if (!event) return new Response('Event not found', { status: 404, headers: cors });

  // Get all confirmed RSVPs
  const { data: rsvps } = await admin.from('event_rsvps')
    .select('user_id').eq('event_id', event_id).eq('status', 'confirmed');

  let notified = 0;
  for (const rsvp of rsvps ?? []) {
    await admin.from('notifications').insert({
      user_id: rsvp.user_id,
      type: 'event',
      title: `Эвент шинэчлэгдлээ: ${event.title}`,
      message: `Өөрчлөгдсөн талбарууд: ${(changed_fields ?? []).join(', ')}`,
      link: `/events/${event_id}`,
    });
    notified++;
  }

  return new Response(JSON.stringify({ ok: true, notified }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
