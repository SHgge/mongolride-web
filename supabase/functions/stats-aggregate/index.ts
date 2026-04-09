import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Сайтын ерөнхий статистик тооцоолох Edge Function
 * Cron: өдөр бүр 00:00 UTC-д ажиллана
 *
 * Supabase Dashboard → Database → Extensions → pg_cron:
 *   SELECT cron.schedule(
 *     'daily-stats',
 *     '0 0 * * *',
 *     $$SELECT net.http_post(
 *       'https://YOUR_PROJECT.supabase.co/functions/v1/stats-aggregate',
 *       '{}',
 *       'application/json',
 *       ARRAY[http_header('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')]
 *     )$$
 *   );
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Нийт идэвхтэй гишүүдийн тоо
    const { count: totalMembers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // 2. Нийт км, нийт унаа
    const { data: kmTotals } = await supabase
      .from('profiles')
      .select('total_km, total_rides')
      .eq('is_active', true);

    const totalKm = (kmTotals ?? []).reduce(
      (sum, p) => sum + Number(p.total_km ?? 0), 0,
    );
    const totalRides = (kmTotals ?? []).reduce(
      (sum, p) => sum + Number(p.total_rides ?? 0), 0,
    );

    // 3. Идэвхтэй (approved) маршрутын тоо
    const { count: totalRoutes } = await supabase
      .from('routes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    // 4. Энэ сарын км болон унаа
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: monthlyLogs } = await supabase
      .from('km_logs')
      .select('distance_km')
      .gte('ride_date', monthStart.toISOString().split('T')[0]);

    const monthlyKm = (monthlyLogs ?? []).reduce(
      (sum, log) => sum + Number(log.distance_km ?? 0), 0,
    );
    const monthlyRides = (monthlyLogs ?? []).length;

    // 5. Ногоон CO₂ хэмнэлт: 1 км дугуйгаар = 0.21 кг CO₂ хэмнэлт
    //    (дундаж машины 210г CO₂/км ялгаруулалтыг орлосон)
    const greenCo2SavedKg = totalKm * 0.21;

    // 6. site_stats хүснэгтэд бичих (хуучин бичлэг устгаж шинээр)
    await supabase.from('site_stats').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: insertError } = await supabase
      .from('site_stats')
      .insert({
        total_members: totalMembers ?? 0,
        total_km: totalKm,
        total_rides: totalRides,
        total_routes: totalRoutes ?? 0,
        monthly_km: monthlyKm,
        monthly_rides: monthlyRides,
        green_co2_saved_kg: greenCo2SavedKg,
        calculated_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;

    const stats = {
      total_members: totalMembers ?? 0,
      total_km: Math.round(totalKm * 100) / 100,
      total_rides: totalRides,
      total_routes: totalRoutes ?? 0,
      monthly_km: Math.round(monthlyKm * 100) / 100,
      monthly_rides: monthlyRides,
      green_co2_saved_kg: Math.round(greenCo2SavedKg * 100) / 100,
      calculated_at: new Date().toISOString(),
    };

    console.log('Stats aggregated:', stats);

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Stats aggregate error:', err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
