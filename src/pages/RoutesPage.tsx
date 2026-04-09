import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Map, LayoutGrid } from 'lucide-react';
import { supabasePublic } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables } from '../types/database.types';
import RouteFilter, { type FilterState } from '../components/routes/RouteFilter';
import RouteList from '../components/routes/RouteList';
import RouteMap from '../components/routes/RouteMap';

type Route = Tables<'routes'>;

export default function RoutesPage() {
  const { isAuthenticated } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'map'>('grid');

  useEffect(() => {
    supabasePublic
      .from('routes')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Routes fetch error:', error.message);
        setRoutes(data ?? []);
        setFilteredRoutes(data ?? []);
        setLoading(false);
      });
  }, []);

  const handleFilterChange = useCallback(
    (filters: FilterState) => {
      let result = [...routes];

      if (filters.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            (r.description?.toLowerCase().includes(q) ?? false),
        );
      }

      if (filters.difficulty !== null) {
        result = result.filter((r) => r.difficulty === filters.difficulty);
      }

      if (filters.surface) {
        result = result.filter((r) => r.surface.includes(filters.surface as Route['surface'][number]));
      }

      switch (filters.sortBy) {
        case 'distance':
          result.sort((a, b) => b.distance_km - a.distance_km);
          break;
        case 'rating':
          result.sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating));
          break;
        case 'elevation':
          result.sort((a, b) => b.elevation_gain - a.elevation_gain);
          break;
        default:
          break;
      }

      setFilteredRoutes(result);
    },
    [routes],
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Маршрутууд</h1>
          <p className="text-gray-500 mt-1">
            {filteredRoutes.length} маршрут{' '}
            {filteredRoutes.length !== routes.length && `(нийт ${routes.length})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('grid')}
              className={`p-2 rounded-md transition-colors ${view === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('map')}
              className={`p-2 rounded-md transition-colors ${view === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Map className="w-4 h-4" />
            </button>
          </div>
          {isAuthenticated && (
            <Link to="/routes/new" className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              <Plus className="w-4 h-4" /> Маршрут нэмэх
            </Link>
          )}
        </div>
      </div>

      <div className="mb-8">
        <RouteFilter onFilterChange={handleFilterChange} />
      </div>

      {view === 'map' ? (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <RouteMap routes={filteredRoutes} className="h-[500px] lg:h-[600px]" />
          </div>
          <div className="lg:col-span-2 space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {filteredRoutes.map((route) => (
              <Link key={route.id} to={`/routes/${route.id}`} className="block p-4 bg-white border border-gray-100 rounded-xl hover:border-primary-200 hover:shadow-sm transition-all">
                <h3 className="font-semibold text-gray-900 mb-1">{route.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-1 mb-2">{route.description}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{route.distance_km} км</span>
                  <span>{route.elevation_gain} м</span>
                  <span>★ {Number(route.avg_rating).toFixed(1)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <RouteList routes={filteredRoutes} loading={loading} />
      )}
    </div>
  );
}
