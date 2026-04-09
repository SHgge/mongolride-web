import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Mountain, Star, Clock, User, ArrowLeft, Share2 } from 'lucide-react';
import { supabasePublic as supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';
import SurfaceRating from '../components/routes/SurfaceRating';
import RouteRating from '../components/routes/RouteRating';
import RouteMap from '../components/routes/RouteMap';

type Route = Tables<'routes'>;

const DIFFICULTY: Record<number, { label: string; color: string }> = {
  1: { label: 'Хялбар', color: 'bg-green-100 text-green-700' },
  2: { label: 'Хөнгөн', color: 'bg-blue-100 text-blue-700' },
  3: { label: 'Дунд', color: 'bg-yellow-100 text-yellow-700' },
  4: { label: 'Хэцүү', color: 'bg-orange-100 text-orange-700' },
  5: { label: 'Маш хэцүү', color: 'bg-red-100 text-red-700' },
};

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('routes')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setRoute(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
          <div className="h-40 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Маршрут олдсонгүй</h2>
        <Link to="/routes" className="text-primary-600 hover:text-primary-700 font-medium">Бүх маршрут руу буцах</Link>
      </div>
    );
  }

  const diff = DIFFICULTY[route.difficulty] ?? DIFFICULTY[1];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <Link to="/routes" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Бүх маршрут
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{route.title}</h1>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${diff.color}`}>{diff.label}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(route.created_at).toLocaleDateString('mn-MN')}</span>
            {route.avg_rating > 0 && (
              <span className="flex items-center gap-1 text-yellow-500 font-medium">
                <Star className="w-4 h-4 fill-current" /> {Number(route.avg_rating).toFixed(1)} ({route.rating_count})
              </span>
            )}
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <Share2 className="w-4 h-4" /> Хуваалцах
        </button>
      </div>

      {/* Map */}
      <div className="mb-8">
        <RouteMap routes={[route]} className="h-[400px]" />
      </div>

      {/* Info grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <MapPin className="w-6 h-6 text-primary-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{route.distance_km} км</div>
          <div className="text-sm text-gray-500">Нийт зай</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <Mountain className="w-6 h-6 text-primary-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{route.elevation_gain} м</div>
          <div className="text-sm text-gray-500">Өндөршил</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center">
          <User className="w-6 h-6 text-primary-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{route.rating_count}</div>
          <div className="text-sm text-gray-500">Үнэлгээ өгсөн</div>
        </div>
      </div>

      {/* Description + Surface */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Тайлбар</h2>
        <p className="text-gray-600 leading-relaxed mb-4">{route.description || 'Тайлбар байхгүй байна.'}</p>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Гадаргуу</h3>
          <SurfaceRating surfaces={route.surface} size="md" />
        </div>
      </div>

      {/* Rating & Comments */}
      <RouteRating routeId={route.id} />
    </div>
  );
}
