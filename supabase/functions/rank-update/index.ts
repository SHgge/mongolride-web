import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (_req) => {
  // TODO: Update user ranks based on total_km
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
