import type { Tables } from '../../types/database.types';
import RouteCard from './RouteCard';
import { MapPin } from 'lucide-react';

type Route = Tables<'routes'>;

interface RouteListProps {
  routes: Route[];
  loading: boolean;
}

export default function RouteList({ routes, loading }: RouteListProps) {
  if (loading) {
    return (
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-80 animate-pulse" />
        ))}
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="text-center py-20">
        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Маршрут олдсонгүй</h3>
        <p className="text-gray-500 text-sm">Шүүлтүүрээ өөрчилж үзнэ үү</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
      {routes.map((route) => (
        <RouteCard key={route.id} route={route} />
      ))}
    </div>
  );
}
