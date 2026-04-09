import { useEffect, useState } from 'react';
import { User, MapPin, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../../types/database.types';

type Profile = Tables<'profiles'>;

interface NearbyMembersProps {
  lat: number;
  lng: number;
  excludeUserId?: string;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NearbyMembers({ lat, lng, excludeUserId }: NearbyMembersProps) {
  const [members, setMembers] = useState<(Profile & { distance: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .not('last_known_lat', 'is', null)
      .not('last_known_lng', 'is', null)
      .then(({ data }) => {
        const nearby = (data ?? [])
          .filter((p) => p.id !== excludeUserId && p.last_known_lat && p.last_known_lng)
          .map((p) => ({
            ...p,
            distance: haversineDistance(lat, lng, p.last_known_lat!, p.last_known_lng!),
          }))
          .filter((p) => p.distance <= 10)
          .sort((a, b) => a.distance - b.distance);

        setMembers(nearby);
        setLoading(false);
      });
  }, [lat, lng, excludeUserId]);

  if (loading) {
    return <div className="text-sm text-gray-400">Ойролцоох гишүүдийг хайж байна...</div>;
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">10 км радиуст гишүүн олдсонгүй</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Ойролцоох гишүүд ({members.length})
      </h3>
      {members.map((member) => (
        <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
            {member.avatar_url ? (
              <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-primary-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{member.full_name}</div>
            <div className="text-xs text-gray-400">{member.phone ?? 'Утас байхгүй'}</div>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary-600 font-medium">
            <Navigation className="w-3 h-3" />
            {member.distance.toFixed(1)} км
          </div>
        </div>
      ))}
    </div>
  );
}
