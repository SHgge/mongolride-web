import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * km_logs-д шинэ бичлэг орох бүрт дуудагдана.
 *
 * Supabase Dashboard → Database → Webhooks:
 *   Table: km_logs, Event: INSERT
 *   URL: https://YOUR_PROJECT.supabase.co/functions/v1/rank-update
 *
 * Хийх зүйлс:
 *   1. Хэрэглэгчийн нийт км-г шалгаж badge олгох
 *   2. Тодорхой маршрут дуусгасан бол route badge олгох
 *   3. Шинэ badge олговол notification үүсгэх
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

    const { record } = await req.json();

    // record = km_logs-ын шинэ бичлэг (webhook payload)
    const userId: string = record.user_id;
    const routeId: string | null = record.route_id;

    // 1. Хэрэглэгчийн шинэчлэгдсэн профайл авах
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('total_km, total_rides, full_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error(`Profile not found: ${profileError?.message}`);
    }

    // 2. Хэрэглэгчийн одоо байгаа badge-уудыг авах
    const { data: existingBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    const ownedBadgeIds = new Set((existingBadges ?? []).map((b) => b.badge_id));

    // 3. Бүх badge-уудыг авах
    const { data: allBadges } = await supabase
      .from('badges')
      .select('*');

    if (!allBadges) {
      return new Response(
        JSON.stringify({ success: true, new_badges: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const newBadges: Array<{ badge_id: string; name: string }> = [];

    for (const badge of allBadges) {
      // Аль хэдийн авсан бол алгасах
      if (ownedBadgeIds.has(badge.id)) continue;

      let earned = false;

      switch (badge.requirement_type) {
        case 'km':
          // Нийт км шаардлага хангасан эсэх
          earned = Number(profile.total_km) >= (badge.requirement_value ?? 0);
          break;

        case 'rides':
          // Нийт унааны тоо шаардлага хангасан эсэх
          earned = Number(profile.total_rides) >= (badge.requirement_value ?? 0);
          break;

        case 'route':
          // Тодорхой маршрут дуусгасан эсэх
          if (routeId && badge.requirement_route_id === routeId) {
            earned = true;
          }
          break;

        case 'event':
          // Event badge-ийг тусад нь шалгана (event_participants-аас)
          if (badge.requirement_value) {
            const { count } = await supabase
              .from('event_participants')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('status', 'attended');

            earned = (count ?? 0) >= badge.requirement_value;
          }
          break;

        // 'special' badge-ийг admin гараар олгоно
        default:
          break;
      }

      if (earned) {
        // Badge олгох
        const { error: badgeError } = await supabase
          .from('user_badges')
          .insert({ user_id: userId, badge_id: badge.id });

        if (!badgeError) {
          newBadges.push({ badge_id: badge.id, name: badge.name });
        }
      }
    }

    // 4. Шинэ badge олговол notification үүсгэх
    if (newBadges.length > 0) {
      const notifications = newBadges.map((badge) => ({
        user_id: userId,
        type: 'achievement' as const,
        title: 'Шинэ badge авлаа! 🏆',
        message: `Та "${badge.name}" badge-ийг амжилттай авлаа!`,
        link: '/profile',
      }));

      await supabase.from('notifications').insert(notifications);

      // Realtime broadcast
      const channel = supabase.channel('badge-updates');
      await channel.send({
        type: 'broadcast',
        event: 'new-badge',
        payload: {
          user_id: userId,
          user_name: profile.full_name,
          badges: newBadges,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        total_km: profile.total_km,
        new_badges: newBadges,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Rank update error:', err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
