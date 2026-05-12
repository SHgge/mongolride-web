// EP-02 → migrated to EP-06 dispatcher.
// Thin orchestrator: gather variables, call dispatch_notification.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APP_URL = Deno.env.get('APP_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ubriders-club.vercel.app';

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

  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return new Response('Forbidden', { status: 403, headers: cors });

  let body: { user_id?: string; decision?: 'approved' | 'rejected'; reason?: string };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }

  const { user_id, decision, reason } = body;
  if (!user_id || !decision) return new Response('Missing fields', { status: 400, headers: cors });

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: target } = await adminClient.auth.admin.getUserById(user_id);
  const { data: club } = await adminClient.from('club_settings').select('name').eq('id', 1).single();
  if (!target?.user) return new Response('Target not found', { status: 404, headers: cors });

  const { data: targetProfile } = await adminClient
    .from('profiles').select('full_name').eq('id', user_id).single();

  const templateKey = decision === 'approved' ? 'membership.approved' : 'membership.rejected';

  const { data: dispatchResult, error: dispatchErr } = await adminClient.rpc(
    'dispatch_notification' as never,
    {
      p_template_key: templateKey,
      p_recipient_user_id: user_id,
      p_variables: {
        club_name: club?.name ?? 'MongolRide',
        member_name: targetProfile?.full_name ?? '',
        events_url: `${APP_URL}/events`,
        reason: reason ?? '',
        link: '/profile',
      },
      p_severity: 'normal',
      p_bypass_dnd: false,
      p_idempotency_key: `membership.${decision}:${user_id}:${Date.now()}`,
      p_source_epic: 'EP-02',
      p_source_event: `membership.${decision}`,
      p_source_target_id: user_id,
      p_force_channels: null,
    } as never,
  );

  if (dispatchErr) {
    return new Response(`Dispatch failed: ${dispatchErr.message}`, { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ ok: true, dispatch: dispatchResult }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
