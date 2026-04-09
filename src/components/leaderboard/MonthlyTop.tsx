import { useEffect, useState } from 'react';
import { Trophy, User } from 'lucide-react';
import { supabasePublic as supabase } from '../../lib/supabase';
import type { Tables } from '../../types/database.types';
import type { UserRank } from '../../types/user.types';
import RankBadge from './RankBadge';

type Profile = Tables<'profiles'>;

export default function MonthlyTop() {
  const [top3, setTop3] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Энэ сарын шилдэг 3 (total_km-ээр)
    supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .gt('total_km', 0)
      .order('total_km', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setTop3(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center gap-6">
        {[1, 2, 3].map((i) => <div key={i} className="w-32 h-44 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (top3.length === 0) return null;

  // Reorder: [2nd, 1st, 3rd] for podium effect
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights = ['h-24', 'h-32', 'h-20'];
  const medals = ['🥈', '🥇', '🥉'];

  return (
    <div className="bg-gradient-to-br from-primary-600 to-primary-500 rounded-2xl p-6 md:p-8 mb-8">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6" /> Шилдэг дугуйчид
        </h2>
        <p className="text-primary-100 text-sm mt-1">Нийт км-ээр тэргүүлэгчид</p>
      </div>

      <div className="flex items-end justify-center gap-4 md:gap-6">
        {podiumOrder.map((profile, i) => {
          if (!profile) return null;
          const medalIndex = top3.length >= 3 ? [1, 0, 2][i] : i;
          return (
            <div key={profile.id} className="flex flex-col items-center">
              {/* Avatar */}
              <div className={`relative mb-2 ${i === 1 ? 'scale-110' : ''}`}>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center overflow-hidden border-2 border-white/50">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-white/70" />
                  )}
                </div>
                <span className="absolute -bottom-1 -right-1 text-xl">{medals[medalIndex]}</span>
              </div>
              {/* Name */}
              <span className="text-white font-semibold text-sm text-center truncate max-w-[100px]">{profile.full_name}</span>
              <RankBadge rank={profile.rank as UserRank} size="sm" />
              {/* Podium bar */}
              <div className={`${heights[i]} w-20 bg-white/20 rounded-t-lg mt-2 flex items-center justify-center`}>
                <span className="text-white font-bold text-sm">{Number(profile.total_km).toLocaleString()} км</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
