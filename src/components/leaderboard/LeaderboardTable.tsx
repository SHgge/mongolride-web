import { Trophy, Mountain, Bike, User } from 'lucide-react';
import type { Tables } from '../../types/database.types';
import type { UserRank } from '../../types/user.types';
import RankBadge from './RankBadge';

type Profile = Tables<'profiles'>;

interface LeaderboardTableProps {
  profiles: Profile[];
  loading: boolean;
  currentUserId?: string;
}

function formatKm(km: number): string {
  return Number(km).toLocaleString('mn-MN', { maximumFractionDigits: 1 });
}

export default function LeaderboardTable({ profiles, loading, currentUserId }: LeaderboardTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-20">
        <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900">Тэргүүлэгч байхгүй</h3>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {profiles.map((profile, index) => {
        const position = index + 1;
        const isCurrentUser = currentUserId === profile.id;
        const isTop3 = position <= 3;

        return (
          <div
            key={profile.id}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${
              isCurrentUser
                ? 'bg-primary-50 border border-primary-200'
                : isTop3
                ? 'bg-white border border-gray-100 shadow-sm'
                : 'bg-white border border-gray-50 hover:border-gray-100'
            }`}
          >
            {/* Position */}
            <div className="flex-shrink-0 w-8 text-center">
              {position === 1 ? (
                <span className="text-2xl">🥇</span>
              ) : position === 2 ? (
                <span className="text-2xl">🥈</span>
              ) : position === 3 ? (
                <span className="text-2xl">🥉</span>
              ) : (
                <span className="text-sm font-bold text-gray-400">{position}</span>
              )}
            </div>

            {/* Avatar */}
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-gray-400" />
              )}
            </div>

            {/* Name + Rank */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-semibold truncate ${isCurrentUser ? 'text-primary-700' : 'text-gray-900'}`}>
                  {profile.full_name}
                </span>
                <RankBadge rank={profile.rank as UserRank} size="sm" />
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                <span className="flex items-center gap-0.5"><Bike className="w-3 h-3" /> {profile.total_rides} унаа</span>
                <span className="flex items-center gap-0.5"><Mountain className="w-3 h-3" /> {profile.total_elevation.toLocaleString()} м</span>
              </div>
            </div>

            {/* KM */}
            <div className="text-right flex-shrink-0">
              <div className={`text-lg font-bold ${isTop3 ? 'text-primary-700' : 'text-gray-900'}`}>
                {formatKm(profile.total_km)}
              </div>
              <div className="text-xs text-gray-400">км</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
