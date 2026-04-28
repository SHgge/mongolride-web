import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin, Mountain, ArrowLeft, Users, Activity,
  CheckCircle2, Star, Download, Image as ImageIcon, TrendingUp,
} from 'lucide-react';
import { supabase, supabasePublic } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables, RouteDifficultyLabel } from '../types/database.types';
import SurfaceRating from '../components/routes/SurfaceRating';
import RouteDetailMap from '../components/routes/RouteDetailMap';
import RouteElevationChart from '../components/routes/RouteElevationChart';
import CueSheet from '../components/routes/CueSheet';
import CompleteRouteModal from '../components/routes/CompleteRouteModal';
import { RouteHoverProvider } from '../hooks/useRouteHover';

type Route = Tables<'routes'>;
type RoutePhoto = Tables<'route_photos'>;

interface CompletionWithProfile {
  id: string;
  ridden_at: string;
  notes: string | null;
  rating: number | null;
  duration_seconds: number | null;
  avg_speed_kmh: number | null;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
}

const DIFFICULTY: Record<RouteDifficultyLabel, { label: string; color: string }> = {
  easy:     { label: 'Хялбар',    color: 'bg-green-100 text-green-700' },
  moderate: { label: 'Дунд',      color: 'bg-yellow-100 text-yellow-700' },
  hard:     { label: 'Хэцүү',     color: 'bg-orange-100 text-orange-700' },
  expert:   { label: 'Маш хэцүү', color: 'bg-red-100 text-red-700' },
};

const LOOP_LABEL: Record<string, string> = {
  loop:           'Тойрог',
  out_and_back:   'Очоод буцах',
  point_to_point: 'А → B',
};

function formatDuration(s: number | null): string {
  if (!s || s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}ц ${m}м` : `${m}м`;
}

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();

  const [route, setRoute] = useState<Route | null>(null);
  const [coords, setCoords] = useState<Array<[number, number]>>([]);
  const [photos, setPhotos] = useState<RoutePhoto[]>([]);
  const [completions, setCompletions] = useState<CompletionWithProfile[]>([]);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const reloadCompletions = async (routeId: string) => {
    // Step 1: fetch completions (no embed — route_completions.user_id FK
    // points to auth.users, not profiles, so PostgREST can't auto-join)
    const { data: rows, error: rErr } = await supabasePublic
      .from('route_completions')
      .select('id, ridden_at, notes, rating, duration_seconds, avg_speed_kmh, user_id')
      .eq('route_id', routeId)
      .order('ridden_at', { ascending: false })
      .limit(20);

    if (rErr) {
      console.error('[completions]', rErr.message);
      setCompletions([]);
      return;
    }
    if (!rows || rows.length === 0) {
      setCompletions([]);
      return;
    }

    // Step 2: enrich with profile names/avatars
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await supabasePublic
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p as { id: string; full_name: string; avatar_url: string | null }]),
    );

    setCompletions(rows.map((r) => {
      const p = profileMap.get(r.user_id);
      return {
        id: r.id,
        ridden_at: r.ridden_at,
        notes: r.notes,
        rating: r.rating,
        duration_seconds: r.duration_seconds,
        avg_speed_kmh: r.avg_speed_kmh != null ? Number(r.avg_speed_kmh) : null,
        user_id: r.user_id,
        user_name: p?.full_name ?? 'Гишүүн',
        avatar_url: p?.avatar_url ?? null,
      };
    }));
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);

    (async () => {
      const [{ data: routeData }, pathRes, { data: photoData }] = await Promise.all([
        supabasePublic.from('routes').select('*').eq('id', id).single(),
        supabasePublic.rpc('get_route_path_geojson' as never, { p_route_id: id } as never),
        supabasePublic.from('route_photos').select('*').eq('route_id', id).order('km_marker', { ascending: true }),
      ]);
      const pathData = pathRes.data as unknown;
      if (!active) return;

      setRoute(routeData as Route | null);
      const c = (pathData as { coordinates?: Array<[number, number]> } | null)?.coordinates ?? [];
      setCoords(c);
      setPhotos((photoData ?? []) as RoutePhoto[]);

      await reloadCompletions(id);

      if (user) {
        const { data: own } = await supabase
          .from('route_completions')
          .select('id', { head: true, count: 'exact' })
          .eq('route_id', id)
          .eq('user_id', user.id)
          .limit(1);
        if (active && own !== null) setHasCompleted(true);
      }

      setLoading(false);
    })();

    return () => { active = false; };
  }, [id, user]);

  const downloadGpxUrl = useMemo(() => {
    if (!id) return '';
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-clean-gpx?route_id=${id}`;
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-[420px] bg-gray-100 rounded-2xl" />
          <div className="grid grid-cols-4 gap-4">
            {[0,1,2,3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Маршрут олдсонгүй</h1>
        <Link to="/routes" className="text-primary-600 hover:underline text-sm mt-2 inline-block">
          ← Маршрутууд руу буцах
        </Link>
      </div>
    );
  }

  const diff = route.difficulty_label ? DIFFICULTY[route.difficulty_label] : DIFFICULTY.moderate;

  return (
    <RouteHoverProvider>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/routes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Маршрутууд
        </Link>

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${diff.color}`}>
                {diff.label}
              </span>
              {route.loop_type && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                  {LOOP_LABEL[route.loop_type] ?? route.loop_type}
                </span>
              )}
              {route.region && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {route.region}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{route.title}</h1>
            {route.description && (
              <p className="text-gray-500 mt-2 max-w-2xl">{route.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={downloadGpxUrl}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" /> GPX
            </a>
            {isAuthenticated && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                {hasCompleted ? 'Дахин бүртгэх' : 'Би туулсан'}
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard icon={MapPin}    label="Зай"        value={`${Number(route.distance_km).toFixed(1)} км`} />
          <StatCard icon={Mountain}  label="Өндөршил"   value={`${route.elevation_gain_m} м`} />
          <StatCard icon={Activity}  label="Хамгийн их налуу" value={route.max_grade_pct != null ? `${Number(route.max_grade_pct).toFixed(1)}%` : '—'} />
          <StatCard icon={TrendingUp} label="Авирах"    value={`${route.climbs.length}`} />
          <StatCard icon={Users}     label="Туулсан"    value={`${route.completion_count}`} />
        </div>

        {/* Hero map */}
        {coords.length >= 2 ? (
          <div className="mb-6">
            <RouteDetailMap coords={coords} totalKm={Number(route.distance_km)} climbs={route.climbs} className="shadow-sm" />
          </div>
        ) : (
          <div className="mb-6 h-[420px] bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 text-sm">
            Маршрутын геометр бэлэн биш байна
          </div>
        )}

        {/* Surface */}
        {Object.keys(route.surface_breakdown).length > 0 && (
          <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Гадаргуу</h2>
            <SurfaceRating breakdown={route.surface_breakdown} size="md" showPct />
          </div>
        )}

        {/* Elevation chart */}
        {route.elevation_profile.length > 1 && (
          <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">Өндөршлийн профайл</h2>
              <p className="text-xs text-gray-400">
                {route.min_elevation_m}–{route.max_elevation_m} м
              </p>
            </div>
            <RouteElevationChart profile={route.elevation_profile} climbs={route.climbs} />
          </div>
        )}

        {/* Climbs */}
        {route.climbs.length > 0 && (
          <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Авирах сегментүүд</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {route.climbs.map((c, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <span className="w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 text-xs">
                    <div className="font-medium text-gray-900 mb-0.5">
                      {c.start_km}–{c.end_km}км
                      <span className="ml-2 inline-block px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] font-bold">
                        {c.category === 'HC' ? 'HC' : `Cat ${c.category}`}
                      </span>
                    </div>
                    <div className="text-gray-600">
                      {c.length_km}км · {c.gain_m}м · дундаж {c.avg_grade}% · хамгийн {c.max_grade}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cue sheet */}
        {route.cue_sheet.length > 0 && (
          <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Эргэлтийн жагсаалт</h2>
            <CueSheet cues={route.cue_sheet} routeTitle={route.title} />
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" /> Зургууд ({photos.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                  <img src={p.photo_path} alt={p.caption ?? ''} className="w-full h-full object-cover" />
                  {p.km_marker != null && (
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded font-medium">
                      км {p.km_marker}
                    </span>
                  )}
                  {p.caption && (
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-white text-xs line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completions */}
        <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Сүүлийн туулалтууд ({completions.length})
          </h2>
          {completions.length === 0 ? (
            <p className="text-xs text-gray-400">
              Энэ маршрутыг хэн ч туулаагүй байна. Туулсан бол дээрх товчийг дарна уу.
            </p>
          ) : (
            <div className="space-y-3">
              {completions.map((c) => (
                <div key={c.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0 overflow-hidden">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      c.user_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{c.user_name}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.ridden_at).toLocaleDateString('mn-MN')}
                      </span>
                      {c.rating != null && (
                        <span className="flex items-center gap-0.5 text-xs text-yellow-600">
                          <Star className="w-3 h-3 fill-current" /> {c.rating}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {c.duration_seconds && <span>{formatDuration(c.duration_seconds)}</span>}
                      {c.avg_speed_kmh != null && <span>{c.avg_speed_kmh} км/ц</span>}
                    </div>
                    {c.notes && (
                      <p className="text-xs text-gray-600 mt-1.5">{c.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showModal && id && (
          <CompleteRouteModal
            routeId={id}
            routeTitle={route.title}
            routeDistanceKm={Number(route.distance_km)}
            onClose={() => setShowModal(false)}
            onLogged={() => {
              setShowModal(false);
              setHasCompleted(true);
              if (id) reloadCompletions(id);
            }}
          />
        )}
      </div>
    </RouteHoverProvider>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}
