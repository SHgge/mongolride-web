import { useEffect, useState } from 'react';
import { Check, X, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../../types/database.types';

type Route = Tables<'routes'>;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function RouteManagement() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    const query = supabase.from('routes').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query.eq('status', filter);
    query.then(({ data }) => { setRoutes(data ?? []); setLoading(false); });
  }, [filter]);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('routes').update({ status }).eq('id', id);
    if (!error) {
      setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Маршрутууд</h1>
          <p className="text-gray-500 text-sm mt-1">{routes.length} маршрут</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <button key={f} onClick={() => { setLoading(true); setFilter(f); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            {f === 'all' ? 'Бүгд' : f === 'pending' ? 'Хүлээгдэж буй' : f === 'approved' ? 'Батлагдсан' : 'Цуцлагдсан'}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Маршрут</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Зай</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Хэцүү</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Төлөв</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td colSpan={5} className="px-4 py-4"><div className="h-6 bg-gray-100 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : routes.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Маршрут олдсонгүй</td></tr>
            ) : (
              routes.map((route) => (
                <tr key={route.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{route.title}</div>
                    <div className="text-xs text-gray-400 line-clamp-1">{route.description}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{route.distance_km} км</td>
                  <td className="px-4 py-3 text-gray-600">{route.difficulty}/5</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[route.status]}`}>
                      {route.status === 'pending' ? 'Хүлээгдэж буй' : route.status === 'approved' ? 'Батлагдсан' : 'Цуцлагдсан'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {route.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => updateStatus(route.id, 'approved')}
                          className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors" title="Батлах">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => updateStatus(route.id, 'rejected')}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Цуцлах">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <a href={`/routes/${route.id}`} className="inline-flex p-1.5 text-gray-400 hover:text-gray-600" title="Харах">
                      <Eye className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
