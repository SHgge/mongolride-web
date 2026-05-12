// EP-06 P0-4: resend-webhook
//
// Receives bounce / complaint events from Resend, marks email_health,
// future dispatches skip the email channel for that address.
//
// Verify webhook signature (svix) using RESEND_WEBHOOK_SECRET; if missing,
// log a warning and accept (best-effort; deploy-time TODO).
//
// verify_jwt = false (Resend can't carry JWTs).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/svix@1.27.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'svix-id, svix-timestamp, svix-signature, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ResendEvent {
  type: string;
  data?: {
    to?: string | string[];
    email_id?: string;
    reason?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  const raw = await req.text();
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');

  let payload: ResendEvent;
  if (secret) {
    try {
      const wh = new Webhook(secret);
      payload = wh.verify(raw, {
        'svix-id': req.headers.get('svix-id') ?? '',
        'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
        'svix-signature': req.headers.get('svix-signature') ?? '',
      }) as ResendEvent;
    } catch (e) {
      return new Response(`signature invalid: ${(e as Error).message}`, { status: 401, headers: cors });
    }
  } else {
    console.warn('[resend-webhook] RESEND_WEBHOOK_SECRET not set — skipping verification');
    try {
      payload = JSON.parse(raw) as ResendEvent;
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: cors });
    }
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const type = payload?.type ?? '';
  const to = payload?.data?.to;
  const emails: string[] = Array.isArray(to) ? to : (to ? [to] : []);
  if (emails.length === 0) {
    return new Response('ok', { status: 200, headers: cors });
  }

  for (const email of emails) {
    if (type === 'email.bounced' || type === 'email.complained' || type === 'email.delivery_delayed') {
      const status = type === 'email.complained' ? 'complained'
                   : type === 'email.bounced'    ? 'bounced'
                   : 'healthy'; // delivery_delayed isn't fatal

      if (status !== 'healthy') {
        await admin.from('notification_email_health').upsert({
          email,
          status,
          reason: payload.data?.reason ?? type,
          last_event_at: new Date().toISOString(),
          bounce_count: 1, // upsert will overwrite; we don't track running count strictly
        }, { onConflict: 'email' });

        // Increment bounce_count if already present
        await admin.rpc('increment_bounce_count' as never, { p_email: email } as never).catch(() => {});
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: emails.length }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
