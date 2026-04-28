import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Map, LayoutGrid, Navigation, Loader2, MapPin, Mountain, Users } from 'lucide-react';
import { supabasePublic } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables, RouteDifficultyLabel, RouteDiscipline, RouteSurfaceBreakdown } from '../types/database.types';
import RouteFilter, { type FilterState } from '../components/routes/RouteFilter';
import RouteList from '../components/routes/RouteList';
import RouteBrowseMap from '../components/routes/RouteBrowseMap';

type Route = Tables<'routes'>;

type View = 'grid' | 'map' | 'near';

interface NearbyRouteRow {
  id: string;
  title: string;
  distance_km: number;
  elevation_gain_m: number;
  difficulty_label: RouteDifficultyLabel | null;
  difficulty_score: number | null;
  discipline: RouteDiscipline;
  loop_type: string | null;
  region: string | null;
  cover_photo_path: string | null;
  start_lat: number;
  start_lng: number;
  distance_from_query_m: number;
  completion_count: number;
  surface_breakdown: RouteSurfaceBreakdown;
}

const DIFFICULTY_LABEL: Record<RouteDifficultyLabel, string> = {
  easy: 'Хялбар', moderate: 'Дунд', hard: 'Хэцүү', expert: 'Маш хэцүү',
};

export default function RoutesPage() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<View>('grid');

  // Grid mode data
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    search: '', difficulty: null, surface: null, sortBy: 'newest',
  });

  // Near-me mode data
  const [nearby, setNearby] = useState<NearbyRouteRow[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState(50);

  // ----------------------------------------------------------
  // Grid mode: load all published+visible routes (filter client-side)
  // ----------------------------------------------------------
  useEffect(() => {
    if (view !== 'grid') return;
    setLoading(true);
    supabasePublic
      .from('routes')
      .select('*')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) console.error('Routes fetch error:', error.message);
        setRoutes(data ?? []);
        setLoading(false);
      });
  }, [view]);

  const filteredRoutes = useMemo(() => {
    let result = [...routes];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
      );
    }
    if (filters.difficulty !== null) {
      result = result.filter((r) => r.difficulty_label === filters.difficulty);
    }
    if (filters.surface) {
      result = result.filter((r) => (r.surface_breakdown[filters.surface!] ?? 0) > 0);
    }

    switch (filters.sortBy) {
      case 'distance':
        result.sort((a, b) => Number(b.distance_km) - Number(a.distance_km));
        break;
      case 'completions':
        result.sort((a, b) => b.completion_count - a.completion_count);
        break;
      case 'elevation':
        result.sort((a, b) => b.elevation_gain_m - a.elevation_gain_m);
        break;
      default:
        break;
    }
    return result;
  }, [routes, filters]);

  // ----------------------------------------------------------
  // Near me mode
  // ----------------------------------------------------------
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Энэ хөтөч байршил тогтоож чадахгүй');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message || 'Байршил авч чадсангүй');
        setGeoLoading(false);
        toast.error('Байршил зөвшөөрлөө шалгана уу');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (view !== 'near' || !userPos) return;
    setGeoLoading(true);
    supabasePublic.rpc('routes_near' as never, {
      p_lat: userPos.lat,
      p_lng: userPos.lng,
      p_radius_km: searchRadiusKm,
      p_discipline: null,
      p_difficulty: filters.difficulty,
      p_min_distance: null,
      p_max_distance: null,
      p_limit: 50,
    } as never).then(({ data, error }) => {
      if (error) {
        toast.error(`Маршрут авч чадсангүй: ${error.message}`);
        setNearby([]);
      } else {
        setNearby((data as unknown as NearbyRouteRow[]) ?? []);
      }
      setGeoLoading(false);
    });
  }, [view, userPos, searchRadiusKm, filters.difficulty]);

  // ----------------------------------------------------------
  // View switching
  // ----------------------------------------------------------
  const switchView = (next: View) => {
    setView(next);
    if (next === 'near' && !userPos && !geoLoading) {
      requestGeolocation();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Маршрутууд</h1>
          <p className="text-gray-500 mt-1">
            {view === 'grid' && (
              <>{filteredRoutes.length} маршрут{filteredRoutes.length !== routes.length && ` (нийт ${routes.length})`}</>
            )}
            {view === 'map' && 'Газрын зурган дээр харагдаж буй маршрут'}
            {view === 'near' && (userPos ? `${nearby.length} маршрут ${searchRadiusKm}км дотор` : 'Байршил тогтоож байна...')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <ViewButton active={view === 'grid'} onClick={() => switchView('grid')} icon={LayoutGrid} label="Жагсаалт" />
            <ViewButton active={view === 'map'}  onClick={() => switchView('map')}  icon={Map}        label="Газрын зураг" />
            <ViewButton active={view === 'near'} onClick={() => switchView('near')} icon={Navigation} label="Ойролцоо" />
          </div>
          {isAuthenticated && (
            <Link to="/routes/new" className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              <Plus className="w-4 h-4" /> Нэмэх
            </Link>
          )}
        </div>
      </div>

      {/* Filter — applies to grid and near */}
      {view !== 'map' && (
        <div className="mb-6">
          <RouteFilter onFilterChange={setFilters} />
        </div>
      )}

      {/* GRID */}
      {view === 'grid' && <RouteList routes={filteredRoutes} loading={loading} />}

      {/* MAP — viewport-bounded */}
      {view === 'map' && (
        <div className="rounded-2xl overflow-hidden">
          <RouteBrowseMap className="h-[600px]" />
        </div>
      )}

      {/* NEAR ME */}
      {view === 'near' && (
        <NearbyView
          nearby={nearby}
          loading={geoLoading}
          error={geoError}
          userPos={userPos}
          radiusKm={searchRadiusKm}
          onRetry={requestGeolocation}
          onRadiusChange={setSearchRadiusKm}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

interface ViewButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}
function ViewButton({ active, onClick, icon: Icon, label }: ViewButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

interface NearbyViewProps {
  nearby: NearbyRouteRow[];
  loading: boolean;
  error: string | null;
  userPos: { lat: number; lng: number } | null;
  radiusKm: number;
  onRetry: () => void;
  onRadiusChange: (km: number) => void;
}

function NearbyView({ nearby, loading, error, userPos, radiusKm, onRetry, onRadiusChange }: NearbyViewProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
        <Navigation className="w-10 h-10 text-red-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Байршил авч чадсангүй</h3>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <button onClick={onRetry} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
          Дахин оролдох
        </button>
      </div>
    );
  }

  if (loading && !userPos) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary-500" />
        <p className="text-sm">Байршил тогтоож байна...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Radius slider */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <label className="text-sm text-gray-600 flex-shrink-0">Хайх радиус: <strong className="text-gray-900">{radiusKm} км</strong></label>
        <input
          type="range"
          min={5}
          max={200}
          step={5}
          value={radiusKm}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="flex-1 accent-primary-600"
        />
        <button onClick={onRetry} className="text-xs text-primary-600 font-medium hover:text-primary-700">
          Байршил шинэчлэх
        </button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map((i) => <div key={i} className="bg-gray-100 rounded-2xl h-32 animate-pulse" />)}
        </div>
      ) : nearby.length === 0 ? (
        <div className="text-center py-20">
          <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Энэ радиуст маршрут алга</h3>
          <p className="text-gray-500 text-sm">Радиусаа томруулж үзнэ үү</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {nearby.map((r) => (
            <Link
              key={r.id}
              to={`/routes/${r.id}`}
              className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all"
            >
              <div className="flex items-stretch h-full">
                <div className="w-28 flex-shrink-0 bg-gradient-to-br from-primary-100 to-primary-50 relative">
                  {r.cover_photo_path ? (
                    <img src={r.cover_photo_path} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <MapPin className="w-7 h-7 text-primary-300" />
                    </div>
                  )}
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-white/90 text-[10px] font-bold text-gray-900 rounded">
                    {(r.distance_from_query_m / 1000).toFixed(1)} км
                  </span>
                </div>
                <div className="flex-1 p-3 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 line-clamp-1 mb-1">{r.title}</h3>
                  {r.region && <p className="text-[11px] text-gray-400 mb-1.5">{r.region}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {Number(r.distance_km).toFixed(1)}км</span>
                    <span className="flex items-center gap-0.5"><Mountain className="w-3 h-3" /> {r.elevation_gain_m}м</span>
                    {r.completion_count > 0 && (
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {r.completion_count}</span>
                    )}
                  </div>
                  {r.difficulty_label && (
                    <span className="inline-block mt-1.5 text-[10px] font-medium text-gray-600">
                      {DIFFICULTY_LABEL[r.difficulty_label]}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
