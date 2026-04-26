import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MapPin, Mountain, Bike, Award, Calendar, TrendingUp } from 'lucide-react';
import { RANK_LABELS, RANK_COLORS, RANK_MIN_KM, type UserRank } from '../types/user.types';
import { Loader, ImageUpload } from '../components/common';
import { supabase } from '../lib/supabase';
import KmLogger from '../components/profile/KmLogger';
import ActivityHistory from '../components/profile/ActivityHistory';

export default function ProfilePage() {
  const { profile, isLoading, refreshProfile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">Профайл олдсонгүй</p>
      </div>
    );
  }

  const rankColor = RANK_COLORS[profile.rank as UserRank] ?? '#9ca3af';
  const rankLabel = RANK_LABELS[profile.rank as UserRank] ?? profile.rank;

  // Rank progress bar
  const currentKm = Number(profile.total_km);
  const ranks: UserRank[] = ['unaga', 'daagan', 'shudlen', 'khuleg', 'avarga'];
  const currentRankIdx = ranks.indexOf(profile.rank as UserRank);
  const nextRank = currentRankIdx < ranks.length - 1 ? ranks[currentRankIdx + 1] : null;
  const nextRankKm = nextRank ? RANK_MIN_KM[nextRank] : null;
  const currentRankKm = RANK_MIN_KM[profile.rank as UserRank] ?? 0;
  const progressPercent = nextRankKm
    ? Math.min(100, ((currentKm - currentRankKm) / (nextRankKm - currentRankKm)) * 100)
    : 100;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Profile header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <ImageUpload
            bucket="avatars"
            folder={profile.id}
            currentUrl={profile.avatar_url}
            shape="circle"
            size="md"
            onUpload={async (url) => {
              await supabase.from('profiles').update({ avatar_url: url || null }).eq('id', profile.id);
              refreshProfile();
            }}
          />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{profile.full_name}</h1>
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: rankColor }}
              >
                <Award className="w-4 h-4" />
                {rankLabel}
              </span>
              <span className="text-sm text-gray-400 capitalize">{profile.role}</span>
            </div>
            {profile.bio && <p className="text-gray-500 text-sm mb-3">{profile.bio}</p>}
            <div className="flex items-center justify-center sm:justify-start gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(profile.created_at).toLocaleDateString('mn-MN')}-с нэгдсэн
              </span>
              {profile.phone && <span>{profile.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <MapPin className="w-6 h-6 text-primary-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{currentKm.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Нийт км</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <Bike className="w-6 h-6 text-primary-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{profile.total_rides}</div>
          <div className="text-sm text-gray-500">Нийт унаа</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <Mountain className="w-6 h-6 text-primary-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{profile.total_elevation.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Нийт өндөршил (м)</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <TrendingUp className="w-6 h-6 text-primary-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{(currentKm * 0.21).toFixed(1)}</div>
          <div className="text-sm text-gray-500">CO₂ хэмнэлт (кг)</div>
        </div>
      </div>

      {/* Rank progress */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Зэрэглэлийн явц</h2>
          {nextRank && (
            <span className="text-sm text-gray-500">
              Дараагийн: <span className="font-medium" style={{ color: RANK_COLORS[nextRank] }}>{RANK_LABELS[nextRank]}</span> ({nextRankKm} км)
            </span>
          )}
        </div>
        {nextRank && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{currentKm.toFixed(1)} км</span>
              <span>{nextRankKm} км</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%`, backgroundColor: rankColor }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {nextRankKm ? `${(nextRankKm - currentKm).toFixed(1)} км үлдсэн` : 'Хамгийн дээд зэрэглэл!'}
            </p>
          </div>
        )}
        <div className="flex gap-1">
          {ranks.map((rank) => {
            const isPassed = currentKm >= RANK_MIN_KM[rank];
            return (
              <div key={rank} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full h-1.5 rounded-full mb-1.5 ${isPassed ? '' : 'opacity-20'}`}
                  style={{ backgroundColor: RANK_COLORS[rank] }}
                />
                <span className={`text-[10px] font-medium ${profile.rank === rank ? 'text-gray-900' : 'text-gray-400'}`}>
                  {RANK_LABELS[rank]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Left: KmLogger */}
        <div className="md:col-span-2">
          <KmLogger onLogged={() => setRefreshKey((k) => k + 1)} />
        </div>

        {/* Right: Activity History */}
        <div className="md:col-span-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Унааны түүх</h2>
            <ActivityHistory refreshKey={refreshKey} />
          </div>
        </div>
      </div>
    </div>
  );
}
