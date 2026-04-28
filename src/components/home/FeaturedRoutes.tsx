import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Mountain, ArrowRight, Users } from 'lucide-react';
import { supabasePublic as supabase } from '../../lib/supabase';
import type { Tables, RouteDifficultyLabel } from '../../types/database.types';

type Route = Tables<'routes'>;

const DIFFICULTY_LABELS: Record<RouteDifficultyLabel, { label: string; color: string }> = {
  easy:     { label: 'Хялбар',    color: 'bg-green-100 text-green-700' },
  moderate: { label: 'Дунд',      color: 'bg-yellow-100 text-yellow-700' },
  hard:     { label: 'Хэцүү',     color: 'bg-orange-100 text-orange-700' },
  expert:   { label: 'Маш хэцүү', color: 'bg-red-100 text-red-700' },
};

export default function FeaturedRoutes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('routes')
      .select('*')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('completion_count', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setRoutes(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <section className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Онцлох маршрутууд</h2>
            <p className="text-gray-500">Хамгийн өндөр үнэлгээтэй маршрутууд</p>
          </div>
          <Link to="/routes" className="hidden sm:inline-flex items-center gap-1 text-primary-600 font-medium hover:text-primary-700 transition-colors">
            Бүгдийг үзэх <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Одоогоор маршрут байхгүй байна</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {routes.map((route) => {
              const diff = route.difficulty_label
                ? DIFFICULTY_LABELS[route.difficulty_label]
                : DIFFICULTY_LABELS.moderate;
              return (
                <Link
                  key={route.id}
                  to={`/routes/${route.id}`}
                  className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300"
                >
                  <div className="h-48 bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center relative">
                    {route.cover_photo_path ? (
                      <img src={route.cover_photo_path} alt={route.title} className="w-full h-full object-cover" />
                    ) : (
                      <MapPin className="w-12 h-12 text-primary-300" />
                    )}
                    <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-medium ${diff.color}`}>
                      {diff.label}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                      {route.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{route.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4 text-gray-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" /> {Number(route.distance_km).toFixed(1)} км
                        </span>
                        <span className="flex items-center gap-1">
                          <Mountain className="w-4 h-4" /> {route.elevation_gain_m} м
                        </span>
                      </div>
                      {route.completion_count > 0 && (
                        <span className="flex items-center gap-1 text-primary-600 font-medium">
                          <Users className="w-4 h-4" /> {route.completion_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="sm:hidden text-center mt-8">
          <Link to="/routes" className="inline-flex items-center gap-1 text-primary-600 font-medium">
            Бүгдийг үзэх <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
