import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ImageUpload, GPXUpload } from '../components/common';
import type { GPXData } from '../components/common/GPXUpload';
import { useAuth } from '../hooks/useAuth';
import type { SurfaceType } from '../types/database.types';

interface RouteInput {
  title: string;
  description?: string;
  distance_km: number;
  elevation_gain?: number;
  difficulty: number;
}

const routeSchema = z.object({
  title: z.string().min(3, 'Гарчиг хамгийн багадаа 3 тэмдэгт'),
  description: z.string().optional(),
  distance_km: z.number().positive('Зай эерэг тоо байх ёстой'),
  elevation_gain: z.number().min(0).optional(),
  difficulty: z.number().min(1).max(5),
}) satisfies z.ZodType<RouteInput>;

const DIFFICULTIES = [
  { value: 1, label: 'Хялбар' },
  { value: 2, label: 'Хөнгөн' },
  { value: 3, label: 'Дунд' },
  { value: 4, label: 'Хэцүү' },
  { value: 5, label: 'Маш хэцүү' },
];

const SURFACES: { value: SurfaceType; label: string }[] = [
  { value: 'asphalt', label: 'Асфальт' },
  { value: 'dirt', label: 'Шороо' },
  { value: 'gravel', label: 'Хайрга' },
  { value: 'ice', label: 'Мөс' },
  { value: 'mixed', label: 'Холимог' },
];

export default function AddRoutePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedSurfaces, setSelectedSurfaces] = useState<SurfaceType[]>(['asphalt']);
  const [images, setImages] = useState<string[]>([]);
  const [gpxData, setGpxData] = useState<GPXData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RouteInput>({
    resolver: zodResolver(routeSchema) as never,
    defaultValues: { difficulty: 3, distance_km: 0, elevation_gain: 0 },
  });

  const toggleSurface = (s: SurfaceType) => {
    setSelectedSurfaces((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const onSubmit = async (data: RouteInput) => {
    setServerError(null);

    const { error } = await supabase.from('routes').insert({
      title: data.title,
      description: data.description || null,
      distance_km: data.distance_km,
      elevation_gain: data.elevation_gain || 0,
      difficulty: data.difficulty,
      surface: selectedSurfaces,
      images,
      gpx_url: gpxData?.gpx_url || null,
      created_by: user?.id || null,
    });

    if (error) {
      setServerError(error.message);
      toast.error('Маршрут нэмэхэд алдаа гарлаа');
    } else {
      navigate('/routes');
      toast.success('Маршрут амжилттай нэмэгдлээ!');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/routes" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Бүх маршрут
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Шинэ маршрут</h1>
            <p className="text-sm text-gray-500">Маршрутын мэдээллийг оруулна уу</p>
          </div>
        </div>

        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-6">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* GPX Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">GPS Track (GPX файл)</label>
            <GPXUpload
              folder="gpx"
              onParsed={(data) => {
                setGpxData(data);
                setValue('distance_km', data.distance_km);
                setValue('elevation_gain', data.elevation_gain);
              }}
            />
            <p className="text-xs text-gray-400 mt-1">GPX файл upload хийвэл зай, өндөршил автоматаар бөглөгдөнө</p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Нэр *</label>
            <input
              type="text"
              placeholder="Жишээ: Зайсан - Хустай"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${errors.title ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'}`}
              {...register('title')}
            />
            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Тайлбар</label>
            <textarea
              rows={3}
              placeholder="Маршрутын тайлбар..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
              {...register('description')}
            />
          </div>

          {/* Distance + Elevation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Зай (км) *</label>
              <input
                type="number"
                step="0.1"
                placeholder="45.5"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${errors.distance_km ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'}`}
                {...register('distance_km')}
              />
              {errors.distance_km && <p className="mt-1 text-sm text-red-500">{errors.distance_km.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Өндөршил (м)</label>
              <input
                type="number"
                placeholder="320"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                {...register('elevation_gain')}
              />
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Хэцүү байдал *</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <label key={d.value} className="flex-1">
                  <input type="radio" value={d.value} className="sr-only peer" {...register('difficulty')} />
                  <div className="text-center py-2.5 border border-gray-200 rounded-lg text-xs font-medium cursor-pointer peer-checked:border-primary-500 peer-checked:bg-primary-50 peer-checked:text-primary-700 hover:bg-gray-50 transition-colors">
                    {d.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Surface */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Гадаргуу</label>
            <div className="flex flex-wrap gap-2">
              {SURFACES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleSurface(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedSurfaces.includes(s.value)
                      ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Зурагнууд</label>
            <ImageUpload
              bucket="routes"
              folder="images"
              multiple
              onUpload={() => {}}
              onMultiUpload={(urls) => setImages(urls)}
              existingUrls={images}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Link to="/routes" className="flex-1 py-2.5 text-center border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              Цуцлах
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Хадгалж байна...</> : 'Маршрут нэмэх'}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Маршрут нэмсний дараа админ баталгаажуулна
          </p>
        </form>
      </div>
    </div>
  );
}
