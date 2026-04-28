import { useEffect, useState } from 'react';
import { Pencil, Trash2, Eye, Mountain, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Tables, RouteStatus, RouteDifficultyLabel } from '../../types/database.types';

type Route = Tables<'routes'>;

const STATUS_COLORS: Record<RouteStatus, string> = {
  draft:     'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  archived:  'bg-amber-100 text-amber-700',
};

const STATUS_LABELS: Record<RouteStatus, string> = {
  draft:     'Ноорог',
  published: 'Нийтлэгдсэн',
  archived:  'Архив',
};

const DIFFICULTY_LABELS: Record<RouteDifficultyLabel, string> = {
  easy:     'Хялбар',
  moderate: 'Дунд',
  hard:     'Хэцүү',
  expert:   'Маш хэцүү',
};

interface RouteManagementProps {
  onEdit?: (routeId: string) => void;
}

export default function RouteManagement({ onEdit }: RouteManagementProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | RouteStatus>('all');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = supabase.from('routes').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query.eq('status', filter);
    query.then(({ data }) => {
      if (!active) return;
      setRoutes(data ?? []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [filter]);

  const updateStatus = async (id: string, status: RouteStatus) => {
    const { error } = await supabase.from('routes').update({ status }).eq('id', id);
    if (error) {
      toast.error('Төлөв солиход алдаа гарлаа');
      return;
    }
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success('Төлөв шинэчлэгдлээ');
  };

  const deleteRoute = async (id: string) => {
    if (!confirm('Энэ маршрутыг устгах уу? GPX файлууд хадгалагдсан хэвээр үлдэнэ.')) return;
    const { error } = await supabase.from('routes').delete().eq('id', id);
    if (error) {
      toast.error('Устгахад алдаа гарлаа');
      return;
    }
    setRoutes((prev) => prev.filter((r) => r.id !== id));
    toast.success('Маршрут устгагдлаа');
  };

  return (
    <div>
      <p className="text-gray-500 text-sm mb-4">{routes.length} маршрут</p>

      <div className="flex gap-2 mb-6">
        {(['all', 'draft', 'published', 'archived'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f === 'all' ? 'Бүгд' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Маршрут</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Зай</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Өндөршил</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Хэцүү</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Төлөв</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-6 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : routes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  Маршрут олдсонгүй
                </td>
              </tr>
            ) : (
              routes.map((route) => (
                <tr key={route.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{route.title}</div>
                    {route.region && (
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {route.region}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{Number(route.distance_km).toFixed(1)} км</td>
                  <td className="px-4 py-3 text-gray-600 flex items-center gap-1">
                    <Mountain className="w-3.5 h-3.5 text-gray-400" />
                    {route.elevation_gain_m} м
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {route.difficulty_label ? DIFFICULTY_LABELS[route.difficulty_label] : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={route.status}
                      onChange={(e) => updateStatus(route.id, e.target.value as RouteStatus)}
                      className={`px-2 py-1 rounded-md text-xs font-medium border-0 cursor-pointer outline-none ${STATUS_COLORS[route.status]}`}
                    >
                      {(Object.keys(STATUS_LABELS) as RouteStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/routes/${route.id}`} className="inline-flex p-1.5 text-gray-400 hover:text-gray-600" title="Харах">
                      <Eye className="w-4 h-4" />
                    </a>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(route.id)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg ml-1"
                        title="Засах"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteRoute(route.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg ml-1"
                      title="Устгах"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
