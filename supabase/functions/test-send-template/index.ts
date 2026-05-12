// EP-06 P1-1: test-send-template
// POST { template_key, locale, channel, variables } — admin-only.
// Renders the template against the given variables and emails the caller
// directly (bypasses outbox + preferences + throttle). Used by the
// admin Templates editor "Test send" button.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Mustache from 'https://esm.sh/mustache@4.2.0';
import { marked } from 'https://esm.sh/marked@12.0.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'noreply@mongolride.mn';
const TEST_MODE      = Deno.env.get('NOTIFY_TEST_MODE') === 'true';
const TEST_INBOX     = Deno.env.get('NOTIFY_TEST_INBOX') ?? '';

function deriveText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user || !user.email) {
    return new Response('Unauthorized', { status: 401, headers: cors });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: cors });
  }

  let body: {
    template_key?: string;
    locale?: string;
    channel?: string;
    variables?: Record<string, unknown>;
  };
  try { body = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }

  const { template_key, locale = 'mn', channel = 'email', variables = {} } = body;
  if (!template_key) return new Response('Missing template_key', { status: 400, headers: cors });

  const { data: tpl, error: tErr } = await admin
    .from('notification_templates')
    .select('subject_md, body_md, plaintext_md')
    .eq('key', template_key)
    .eq('channel', channel)
    .eq('locale', locale)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tErr || !tpl) {
    return new Response(`Template not found: ${tErr?.message ?? `${template_key}/${locale}/${channel}`}`,
      { status: 404, headers: cors });
  }

  const subject = tpl.subject_md ? Mustache.render(tpl.subject_md, variables) : '';
  const bodyMd  = Mustache.render(tpl.body_md, variables);
  const html    = await Promise.resolve(marked.parse(bodyMd));
  const text    = tpl.plaintext_md
    ? Mustache.render(tpl.plaintext_md, variables)
    : deriveText(html);

  if (channel === 'email') {
    if (!RESEND_API_KEY) {
      return new Response('RESEND_API_KEY missing', { status: 503, headers: cors });
    }
    // In test mode, route everything to NOTIFY_TEST_INBOX (which must be the
    // Resend-account email when using the resend.dev sandbox sender).
    const recipient = TEST_MODE && TEST_INBOX ? TEST_INBOX : user.email;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipient,
        subject: `[ТЕСТ] ${subject}`,
        html: `<div style="background:#fef3c7;padding:8px;text-align:center;font-size:12px;color:#92400e">
                 ⚠️ Энэ нь тест и-мэйл — зөвхөн админуудад илгээгдсэн.
                 ${TEST_MODE ? '<br>NOTIFY_TEST_MODE асаалттай — анхны хүлээн авагч ' + user.email + ' байсан.' : ''}
               </div>` + html,
        text: `[TEST] ${subject}\n\n${text}`,
      }),
    });
    if (!res.ok) {
      return new Response(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`,
        { status: 502, headers: cors });
    }
    return new Response(JSON.stringify({
      ok: true, channel: 'email', to: recipient, subject,
      test_mode: TEST_MODE, original_recipient: user.email,
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  // in_app preview: insert as a notification to the admin
  if (channel === 'in_app') {
    await admin.from('notifications').insert({
      user_id: user.id,
      type: `${template_key}.test`,
      title: `[ТЕСТ] ${subject || template_key}`,
      message: deriveText(html),
      link: (variables as { link?: string })?.link ?? null,
    });
    return new Response(JSON.stringify({ ok: true, channel: 'in_app' }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  return new Response('Unsupported channel', { status: 400, headers: cors });
});
