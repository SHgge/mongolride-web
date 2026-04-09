import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  const { user_id, location, message } = await req.json();

  // TODO: Send push notifications to nearby members
  // TODO: Send SMS to emergency contacts

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
