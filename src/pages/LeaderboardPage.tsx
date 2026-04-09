import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabasePublic as supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables } from '../types/database.types';
import { RANK_LABELS, RANK_COLORS, RANK_MIN_KM, type UserRank } from '../types/user.types';
import LeaderboardTable from '../components/leaderboard/LeaderboardTable';
import MonthlyTop from '../components/leaderboard/MonthlyTop';

type Profile = Tables<'profiles'>;

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('total_km', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.error('Leaderboard fetch error:', error.message);
        setProfiles(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary-600" />
          Тэргүүлэгчид
        </h1>
        <p className="text-gray-500 mt-1">Нийт км-ээр эрэмбэлсэн</p>
      </div>

      {/* Podium */}
      <MonthlyTop />

      {/* Rank guide */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Зэрэглэлийн систем</h3>
        <div className="flex flex-wrap gap-3">
          {(['unaga', 'daagan', 'shudlen', 'khuleg', 'avarga'] as UserRank[]).map((rank) => (
            <div key={rank} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: RANK_COLORS[rank] }} />
              <span className="text-sm font-medium text-gray-700">{RANK_LABELS[rank]}</span>
              <span className="text-xs text-gray-400">{RANK_MIN_KM[rank]}+ км</span>
            </div>
          ))}
        </div>
      </div>

      {/* Full table */}
      <LeaderboardTable profiles={profiles} loading={loading} currentUserId={user?.id} />
    </div>
  );
}
