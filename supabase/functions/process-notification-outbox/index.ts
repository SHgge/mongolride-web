// EP-06 P0-3: process-notification-outbox
//
// Cron-driven (every 1 min). Pulls due rows from notification_outbox,
// renders Mustache + Markdown, sends via Resend (email) or inserts into
// notifications table (in_app). Race-safe: marks 'sending' before work,
// uses retry_count + exponential backoff on failure.
//
// verify_jwt = false; cron triggers via service-role bearer.

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
const APP_URL        = Deno.env.get('APP_URL') ?? Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ubriders-club.vercel.app';
const TEST_MODE      = Deno.env.get('NOTIFY_TEST_MODE') === 'true';
const TEST_INBOX     = Deno.env.get('NOTIFY_TEST_INBOX') ?? '';

const BACKOFF_MIN: Record<number, number> = { 1: 1, 2: 5, 3: 30 };
const BATCH_SIZE = 50;

interface OutboxRow {
  id: string;
  idempotency_key: string;
  template_key: string;
  category: string;
  channel: 'email' | 'in_app' | 'web_push';
  recipient_user_id: string | null;
  recipient_email: string | null;
  recipient_locale: string;
  variables: Record<string, unknown>;
  severity: string;
  bypass_dnd: boolean;
  status: string;
  scheduled_for: string;
  retry_count: number;
  last_error: string | null;
  source_epic: string | null;
  source_event: string | null;
  source_target_id: string | null;
}

function deriveText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function footerHtml(row: OutboxRow): string {
  return `
  <hr style="margin:24px 0;border:0;border-top:1px solid #e5e7eb"/>
  <p style="color:#6b7280;font-size:12px;line-height:1.5">
    Та энэ имэйлийг <strong>${row.category}</strong> ангилалд хүлээн авч байна.
    <a href="${APP_URL}/profile/notifications" style="color:#16a34a">Тохиргоог өөрчлөх</a>
    · <a href="${APP_URL}/unsubscribe?token=${encodeURIComponent(row.idempotency_key)}" style="color:#16a34a">Унтраах</a>
  </p>`;
}

function footerText(): string {
  return `\n\n--\nТохиргоог өөрчлөх: ${APP_URL}/profile/notifications`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: due, error: dueErr } = await admin
    .from('notification_outbox')
    .select('*')
    .in('status', ['queued', 'scheduled'])
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE);

  if (dueErr) {
    return new Response(`select failed: ${dueErr.message}`, { status: 500, headers: cors });
  }

  let sent = 0, failed = 0, skipped = 0;
  const dead: string[] = [];

  for (const r of (due ?? []) as OutboxRow[]) {
    // Race-safe lock
    const { count } = await admin
      .from('notification_outbox')
      .update({ status: 'sending', attempted_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', r.id)
      .in('status', ['queued', 'scheduled']);
    if ((count ?? 0) === 0) { skipped++; continue; }

    try {
      // Lookup active template (prefer recipient locale, fallback to mn)
      let { data: tpl } = await admin
        .from('notification_templates')
        .select('subject_md, body_md, plaintext_md, locale')
        .eq('key', r.template_key)
        .eq('channel', r.channel)
        .eq('is_active', true)
        .eq('locale', r.recipient_locale)
        .maybeSingle();
      if (!tpl) {
        const fb = await admin
          .from('notification_templates')
          .select('subject_md, body_md, plaintext_md, locale')
          .eq('key', r.template_key)
          .eq('channel', r.channel)
          .eq('is_active', true)
          .eq('locale', 'mn')
          .maybeSingle();
        tpl = fb.data;
      }
      if (!tpl) throw new Error(`Template not found: ${r.template_key}/${r.channel}`);

      const vars = r.variables ?? {};
      const subject = tpl.subject_md ? Mustache.render(tpl.subject_md, vars) : '';
      const bodyMd  = Mustache.render(tpl.body_md, vars);

      if (r.channel === 'email') {
        if (!r.recipient_email) throw new Error('No recipient_email');
        const html = await Promise.resolve(marked.parse(bodyMd));
        const text = tpl.plaintext_md
          ? Mustache.render(tpl.plaintext_md, vars)
          : deriveText(html);

        const to = TEST_MODE && TEST_INBOX ? TEST_INBOX : r.recipient_email;

        if (!RESEND_API_KEY) {
          // No provider configured: mark suppressed (avoid retry storm)
          await admin
            .from('notification_outbox')
            .update({ status: 'suppressed', last_error: 'RESEND_API_KEY missing' })
            .eq('id', r.id);
          skipped++;
          continue;
        }

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to,
            subject,
            html: html + footerHtml(r),
            text: text + footerText(),
          }),
        });

        if (!res.ok) {
          throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
        const j = await res.json();
        await admin
          .from('notification_outbox')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: j?.id ?? null,
          })
          .eq('id', r.id);
        sent++;
      } else if (r.channel === 'in_app') {
        const html = await Promise.resolve(marked.parse(bodyMd));
        const message = deriveText(html);
        const link = (vars as { link?: string })?.link ?? null;

        await admin.from('notifications').insert({
          user_id: r.recipient_user_id,
          type: r.template_key,
          title: subject || r.template_key,
          message,
          link,
        });

        await admin
          .from('notification_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', r.id);
        sent++;
      } else {
        // web_push placeholder
        await admin
          .from('notification_outbox')
          .update({ status: 'suppressed', last_error: 'web_push not implemented (V1.1)' })
          .eq('id', r.id);
        skipped++;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const next = r.retry_count + 1;
      if (next > 3) {
        await admin
          .from('notification_outbox')
          .update({ status: 'dead', last_error: errMsg })
          .eq('id', r.id);
        dead.push(r.id);
        failed++;
      } else {
        const delayMin = BACKOFF_MIN[next] ?? 30;
        await admin
          .from('notification_outbox')
          .update({
            status: 'queued',
            retry_count: next,
            last_error: errMsg,
            scheduled_for: new Date(Date.now() + delayMin * 60_000).toISOString(),
          })
          .eq('id', r.id);
        failed++;
      }
    }
  }

  // Provider-down hint: if many failures in a row, fan an admin alert (rate-limited).
  if (dead.length > 0) {
    try {
      const { data: admins } = await admin
        .from('profiles').select('id').eq('role', 'admin');
      const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
      const { count: recent } = await admin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'system.notification_provider_down')
        .gte('created_at', oneHourAgo);
      if ((recent ?? 0) === 0) {
        for (const a of admins ?? []) {
          await admin.rpc('dispatch_notification' as never, {
            p_template_key: 'system.notification_provider_down',
            p_recipient_user_id: a.id,
            p_variables: {},
            p_severity: 'high',
            p_bypass_dnd: false,
            p_idempotency_key: `system.notif_provider_down:${oneHourAgo}`,
            p_source_epic: 'EP-06',
            p_source_event: 'provider.dead_letters',
            p_source_target_id: null,
            p_force_channels: ['in_app'],
          } as never);
        }
      }
    } catch (e) {
      console.error('[outbox] provider-down alert failed:', e);
    }
  }

  return new Response(
    JSON.stringify({
      processed: due?.length ?? 0,
      sent, failed, skipped, dead: dead.length,
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
