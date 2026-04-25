import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  let body: { action?: string; target_id?: string; details?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const { action, target_id, details } = body;
  if (!action) {
    return new Response('Missing action', { status: 400, headers: corsHeaders });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = req.headers.get('user-agent') ?? null;

  // Service role bypasses RLS for inserts
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action,
    target_id: target_id ?? null,
    details: details ?? {},
    ip_address: ip,
    user_agent: ua,
  });

  if (error) {
    return new Response(error.message, { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
