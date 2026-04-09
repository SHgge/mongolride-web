import { Link } from 'react-router-dom';
import { MapPin, Mountain, Star, ArrowUpRight } from 'lucide-react';
import type { Tables } from '../../types/database.types';
import SurfaceRating from './SurfaceRating';

type Route = Tables<'routes'>;

const DIFFICULTY: Record<number, { label: string; color: string }> = {
  1: { label: 'Хялбар', color: 'bg-green-100 text-green-700' },
  2: { label: 'Хөнгөн', color: 'bg-blue-100 text-blue-700' },
  3: { label: 'Дунд', color: 'bg-yellow-100 text-yellow-700' },
  4: { label: 'Хэцүү', color: 'bg-orange-100 text-orange-700' },
  5: { label: 'Маш хэцүү', color: 'bg-red-100 text-red-700' },
};

export default function RouteCard({ route }: { route: Route }) {
  const diff = DIFFICULTY[route.difficulty] ?? DIFFICULTY[1];

  return (
    <Link
      to={`/routes/${route.id}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300"
    >
      {/* Image */}
      <div className="h-44 bg-gradient-to-br from-primary-100 to-primary-50 relative overflow-hidden">
        {route.images?.[0] ? (
          <img src={route.images[0]} alt={route.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <MapPin className="w-10 h-10 text-primary-300" />
          </div>
        )}
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-medium ${diff.color}`}>
          {diff.label}
        </span>
        <div className="absolute top-3 right-3 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight className="w-4 h-4 text-gray-700" />
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
          {route.title}
        </h3>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{route.description}</p>

        {/* Surface tags */}
        <div className="mb-3">
          <SurfaceRating surfaces={route.surface} />
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-gray-400">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" /> {route.distance_km} км
            </span>
            <span className="flex items-center gap-1">
              <Mountain className="w-4 h-4" /> {route.elevation_gain} м
            </span>
          </div>
          {route.avg_rating > 0 && (
            <span className="flex items-center gap-1 text-yellow-500 font-medium">
              <Star className="w-4 h-4 fill-current" /> {Number(route.avg_rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
