import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WINDOWS = [
  { label: 't_minus_24h', hours: 24,    tolerance: 7.5 },
  { label: 't_minus_3h',  hours: 3,     tolerance: 7.5 },
  { label: 't_minus_30m', hours: 0.5,   tolerance: 7.5 },
];

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@mongolride.mn';

  let sent = 0;
  for (const w of WINDOWS) {
    const targetTime = Date.now() + w.hours * 3600_000;
    const start = new Date(targetTime - w.tolerance * 60_000).toISOString();
    const end   = new Date(targetTime + w.tolerance * 60_000).toISOString();

    const { data: events } = await admin
      .from('events')
      .select('id, title, meet_at, meet_location_name, required_gear')
      .eq('status', 'published')
      .gte('meet_at', start)
      .lte('meet_at', end);

    for (const event of events ?? []) {
      const { data: rsvps } = await admin
        .from('event_rsvps')
        .select('id, user_id, reminders_sent')
        .eq('event_id', event.id)
        .eq('status', 'confirmed');

      for (const rsvp of rsvps ?? []) {
        const remindersSent = (rsvp.reminders_sent ?? []) as string[];
        if (remindersSent.includes(w.label)) continue;

        const { data: userResult } = await admin.auth.admin.getUserById(rsvp.user_id);
        const email = userResult?.user?.email;

        if (RESEND_API_KEY && email) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: email,
              subject: `Сануулга: ${event.title} удахгүй эхэлнэ`,
              html: `<p>${new Date(event.meet_at).toLocaleString('mn-MN')}-д уулзана.</p>
                     <p><strong>Уулзах газар:</strong> ${event.meet_location_name}</p>
                     <p><strong>Шаардагдах хэрэглэл:</strong> ${(event.required_gear ?? []).join(', ')}</p>`,
            }),
          });
        }

        await admin.from('notifications').insert({
          user_id: rsvp.user_id,
          type: `event.reminder.${w.label}`,
          title: `Сануулга: ${event.title}`,
          message: `${new Date(event.meet_at).toLocaleString('mn-MN')} — ${event.meet_location_name}`,
          link: `/events/${event.id}`,
        });

        await admin
          .from('event_rsvps')
          .update({ reminders_sent: [...remindersSent, w.label] })
          .eq('id', rsvp.id);

        sent++;
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
