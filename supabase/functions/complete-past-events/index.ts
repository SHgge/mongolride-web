import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // events with meet_at + 24h < now and still 'published'
  const { data: events, error } = await admin
    .from('events')
    .select('id, meet_at')
    .eq('status', 'published')
    .lt('meet_at', new Date(Date.now() - 24 * 3600_000).toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let processed = 0;
  let noShows = 0;
  for (const event of events ?? []) {
    await admin.from('events').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', event.id);

    // Flip un-checked-in confirmed RSVPs to no_show
    const { data: noShowRsvps } = await admin
      .from('event_rsvps')
      .update({ status: 'no_show', updated_at: new Date().toISOString() })
      .eq('event_id', event.id)
      .eq('status', 'confirmed')
      .is('checked_in_at', null)
      .select('id');

    noShows += noShowRsvps?.length ?? 0;
    processed++;
  }

  return new Response(JSON.stringify({ processed, noShows }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
