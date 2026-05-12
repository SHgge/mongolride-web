// EP-03 → migrated to EP-06 dispatcher.
// Caller passes rsvp_id; we look up RSVP + event, gather variables,
// then call dispatch_notification. ICS attachment dropped for V1.0 —
// the ticket page (EP-09) is the canonical calendar source.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APP_URL = Deno.env.get('APP_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ubriders-club.vercel.app';

interface EventRow {
  id: string;
  title: string;
  meet_at: string;
  meet_location_name: string;
  required_gear: string[];
  fee_amount: number;
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
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  if (!body.rsvp_id) return new Response('Missing rsvp_id', { status: 400, headers: cors });

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: rsvp } = await adminClient
    .from('event_rsvps').select('*, events(*)')
    .eq('id', body.rsvp_id).single();
  if (!rsvp || rsvp.user_id !== user.id) {
    return new Response('Forbidden', { status: 403, headers: cors });
  }
  const event = rsvp.events as EventRow;

  // Pick the right template based on RSVP status
  const status = (rsvp as { status: string }).status;
  let templateKey = 'event.rsvp_confirmed';
  if (status === 'waitlist') {
    templateKey = 'event.rsvp_promoted_from_waitlist'; // not actually for waitlist; the promoted variant fires from cancel_rsvp
  }
  if (status === 'cancelled') {
    return new Response('Skipping cancelled RSVP', { status: 200, headers: cors });
  }

  const meetAtLocal = new Date(event.meet_at).toLocaleString('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const { data: dispatch, error } = await adminClient.rpc('dispatch_notification' as never, {
    p_template_key: templateKey,
    p_recipient_user_id: user.id,
    p_variables: {
      event_title: event.title,
      meet_at_local: meetAtLocal,
      meet_location: event.meet_location_name,
      required_gear: (event.required_gear ?? []).join(', '),
      ticket_url: `${APP_URL}/events/${event.id}/ticket`,
      link: `/events/${event.id}/ticket`,
    },
    p_severity: 'normal',
    p_bypass_dnd: false,
    p_idempotency_key: `rsvp.confirmed:${body.rsvp_id}`,
    p_source_epic: 'EP-03',
    p_source_event: 'rsvp.confirmed',
    p_source_target_id: body.rsvp_id,
    p_force_channels: null,
  } as never);

  if (error) {
    return new Response(`Dispatch failed: ${error.message}`, { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ ok: true, dispatch }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
