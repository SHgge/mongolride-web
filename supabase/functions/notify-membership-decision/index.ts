import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@mongolride.mn';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Verify caller is admin
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
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: cors });
  }
  const { user_id, decision, reason } = body;
  if (!user_id || !decision) return new Response('Missing fields', { status: 400, headers: cors });

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: target } = await adminClient.auth.admin.getUserById(user_id);
  const { data: club } = await adminClient.from('club_settings').select('name').eq('id', 1).single();
  if (!target?.user || !club) {
    return new Response('Target or club not found', { status: 404, headers: cors });
  }
  const targetEmail = target.user.email;

  const isApproved = decision === 'approved';
  const subject = isApproved
    ? `${club.name} клубт тавтай морил!`
    : `${club.name} клубын элсэлтийн хүсэлтийн хариу`;

  const html = isApproved
    ? `<p>Сайн байна уу,</p><p>Таны элсэх хүсэлтийг зөвшөөрлөө. Та одоо клубын гишүүн болсон тул дотоод арга хэмжээнд бүртгүүлэх боломжтой.</p>`
    : `<p>Сайн байна уу,</p><p>Таны элсэх хүсэлтийг хойшлуулсан байна.</p>${reason ? `<p>Шалтгаан: ${reason}</p>` : ''}<p>Та хүсэлтээ дахин явуулж болно.</p>`;

  // Email via Resend (хэрэв key байгаа бол)
  let emailStatus = 0;
  if (RESEND_API_KEY && targetEmail) {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: targetEmail, subject, html }),
    });
    emailStatus = emailRes.status;
  }

  // In-app notification
  await adminClient.from('notifications').insert({
    user_id,
    type: isApproved ? 'membership.approved' : 'membership.rejected',
    title: subject,
    message: isApproved ? 'Та клубын гишүүн болсон.' : (reason ?? 'Хүсэлтийг хойшлуулсан.'),
    link: '/profile',
  });

  return new Response(
    JSON.stringify({ ok: true, email_status: emailStatus, email_skipped: !RESEND_API_KEY }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
