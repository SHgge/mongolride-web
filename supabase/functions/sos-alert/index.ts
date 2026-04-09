import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SOSRequest {
  sos_id: string;
  user_id: string;
  lat: number;
  lng: number;
  message?: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { sos_id, user_id, lat, lng, message } = (await req.json()) as SOSRequest;

    // 1. 10км радиуст байгаа идэвхтэй гишүүдийг PostGIS-ээр хайх
    const { data: nearbyMembers, error: geoError } = await supabase.rpc('find_nearby_members', {
      sos_lng: lng,
      sos_lat: lat,
      radius_meters: 10000,
      exclude_user_id: user_id,
    });

    // Хэрэв RPC function байхгүй бол SQL шууд ажиллуулна
    let members = nearbyMembers;
    if (geoError) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, last_known_lat, last_known_lng')
        .neq('id', user_id)
        .eq('is_active', true)
        .not('last_known_lat', 'is', null)
        .not('last_known_lng', 'is', null);

      if (error) throw error;

      // Клиент талд зай тооцоолох (PostGIS RPC-гүй үед fallback)
      members = (data ?? []).filter((m) => {
        if (!m.last_known_lat || !m.last_known_lng) return false;
        const distance = haversineDistance(
          lat, lng,
          m.last_known_lat, m.last_known_lng,
        );
        return distance <= 10000; // 10км
      });
    }

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          nearby_count: 0,
          message: 'Ойролцоо гишүүн олдсонгүй',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Олдсон гишүүд бүрт notification бичих
    const sosUserProfile = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user_id)
      .single();

    const senderName = sosUserProfile.data?.full_name ?? 'Гишүүн';

    const notifications = members.map((member: { id: string }) => ({
      user_id: member.id,
      type: 'sos' as const,
      title: 'SOS тусламжийн дуудлага!',
      message: `${senderName} тусламж хүсч байна${message ? `: ${message}` : ''}`,
      link: `/sos/${sos_id}`,
    }));

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifError) {
      console.error('Notification insert error:', notifError);
    }

    // 3. Supabase Realtime-аар шууд мэдэгдэл (channel broadcast)
    const channel = supabase.channel('sos-alerts');
    await channel.send({
      type: 'broadcast',
      event: 'new-sos',
      payload: {
        sos_id,
        user_id,
        sender_name: senderName,
        lat,
        lng,
        message,
        nearby_count: members.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        nearby_count: members.length,
        notified_members: members.map((m: { id: string; full_name: string }) => ({
          id: m.id,
          full_name: m.full_name,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('SOS Alert error:', err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * Haversine formula: хоёр GPS цэгийн хоорондох зайг метрээр тооцоолох
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000; // Дэлхийн радиус (метр)
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
