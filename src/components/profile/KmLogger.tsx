import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, MapPin, Mountain, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Tables } from '../../types/database.types';

type RouteOption = Pick<Tables<'routes'>, 'id' | 'title' | 'distance_km' | 'elevation_gain'>;

interface KmInput {
  distance_km: number;
  elevation_gain: number;
  ride_date: string;
  notes: string;
}

const kmSchema = z.object({
  distance_km: z.number().positive('Зай эерэг тоо байх ёстой'),
  elevation_gain: z.number().min(0).default(0),
  ride_date: z.string().min(1, 'Огноо оруулна уу'),
  notes: z.string().default(''),
}) satisfies z.ZodType<KmInput>;

interface KmLoggerProps {
  onLogged?: () => void;
}

export default function KmLogger({ onLogged }: KmLoggerProps) {
  const { user, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<KmInput>({
    resolver: zodResolver(kmSchema) as never,
    defaultValues: {
      distance_km: 0,
      elevation_gain: 0,
      ride_date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  // Approved маршрутуудыг авах
  useEffect(() => {
    supabase
      .from('routes')
      .select('id, title, distance_km, elevation_gain')
      .eq('status', 'approved')
      .order('title')
      .then(({ data }) => setRoutes(data ?? []));
  }, []);

  // Маршрут сонгоход км, өндөршил автоматаар бөглөх
  const handleRouteSelect = (routeId: string) => {
    setSelectedRoute(routeId);
    if (routeId) {
      const route = routes.find((r) => r.id === routeId);
      if (route) {
        setValue('distance_km', route.distance_km);
        setValue('elevation_gain', route.elevation_gain);
      }
    }
  };

  const onSubmit = async (data: KmInput) => {
    if (!user) return;
    setServerError(null);

    const { error } = await supabase.from('km_logs').insert({
      user_id: user.id,
      distance_km: data.distance_km,
      elevation_gain: data.elevation_gain || 0,
      route_id: selectedRoute || null,
      ride_date: data.ride_date,
      notes: data.notes || null,
    });

    if (error) {
      setServerError(error.message);
      toast.error('Км бүртгэхэд алдаа гарлаа');
      return;
    }

    setSuccess(true);
    await refreshProfile();
    toast.success('Км амжилттай бүртгэгдлээ!');
    onLogged?.();

    // 2 секундын дараа хаах
    setTimeout(() => {
      setSuccess(false);
      setIsOpen(false);
      reset();
      setSelectedRoute('');
    }, 2000);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
      >
        <Plus className="w-5 h-5" /> Км бүртгэх
      </button>
    );
  }

  if (success) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-primary-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Амжилттай бүртгэгдлээ!</h3>
        <p className="text-sm text-gray-500">Таны км болон зэрэглэл шинэчлэгдлээ</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Км бүртгэх</h2>

      {serverError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">{serverError}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Route select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Маршрут (заавал биш)</label>
          <select
            value={selectedRoute}
            onChange={(e) => handleRouteSelect(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          >
            <option value="">Маршрутгүй (чөлөөт унаа)</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.title} ({r.distance_km} км)</option>
            ))}
          </select>
        </div>

        {/* Distance + Elevation */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />Зай (км) *
            </label>
            <input
              type="number"
              step="0.1"
              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.distance_km ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'}`}
              {...register('distance_km', { valueAsNumber: true })}
            />
            {errors.distance_km && <p className="mt-1 text-xs text-red-500">{errors.distance_km.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Mountain className="w-3.5 h-3.5 inline mr-1" />Өндөршил (м)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              {...register('elevation_gain', { valueAsNumber: true })}
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            <Calendar className="w-3.5 h-3.5 inline mr-1" />Огноо *
          </label>
          <input
            type="date"
            className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.ride_date ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'}`}
            {...register('ride_date')}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            <FileText className="w-3.5 h-3.5 inline mr-1" />Тэмдэглэл
          </label>
          <input
            type="text"
            placeholder="Жишээ: Сайхан цаг агаартай байсан..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            {...register('notes')}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button type="button" onClick={() => { setIsOpen(false); reset(); }}
            className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50">
            Цуцлах
          </button>
          <button type="submit" disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Хадгалж байна...</> : 'Бүртгэх'}
          </button>
        </div>
      </form>
    </div>
  );
}
