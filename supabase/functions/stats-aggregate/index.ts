import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (_req) => {
  // TODO: Aggregate ride stats into monthly_stats table
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
