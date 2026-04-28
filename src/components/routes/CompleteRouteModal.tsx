import { useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { X, Loader2, Star, Calendar, Clock, Gauge, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface CompleteRouteModalProps {
  routeId: string;
  routeTitle: string;
  routeDistanceKm: number;
  onClose: () => void;
  onLogged: () => void;
}

function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CompleteRouteModal({
  routeId, routeTitle, routeDistanceKm, onClose, onLogged,
}: CompleteRouteModalProps) {
  const { user } = useAuth();
  const [riddenAt, setRiddenAt] = useState<string>(todayLocalISO());
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [avgSpeed, setAvgSpeed] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Нэвтэрсэн байх шаардлагатай');
      return;
    }
    setSubmitting(true);

    const h = Number(hours) || 0;
    const m = Number(minutes) || 0;
    const duration_seconds = h > 0 || m > 0 ? h * 3600 + m * 60 : null;
    const avg_speed = avgSpeed
      ? Number(avgSpeed)
      : (duration_seconds && routeDistanceKm > 0
          ? +(routeDistanceKm / (duration_seconds / 3600)).toFixed(2)
          : null);

    const { error } = await supabase.from('route_completions').insert({
      route_id: routeId,
      user_id: user.id,
      ridden_at: new Date(`${riddenAt}T12:00:00`).toISOString(),
      duration_seconds,
      avg_speed_kmh: avg_speed,
      rating,
      notes: notes.trim() || null,
    });

    if (error) {
      toast.error(`Хадгалахад алдаа: ${error.message}`);
      setSubmitting(false);
      return;
    }

    toast.success('Маршрутыг туулсан гэж бүртгэгдлээ');
    setSubmitting(false);
    onLogged();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md my-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Би энэ маршрутыг туулсан</h2>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{routeTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />Огноо *
            </label>
            <input
              type="date"
              value={riddenAt}
              max={todayLocalISO()}
              onChange={(e) => setRiddenAt(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Clock className="w-3.5 h-3.5 inline mr-1" />Хугацаа
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Цаг"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              <span className="text-gray-400">:</span>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="Мин"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Gauge className="w-3.5 h-3.5 inline mr-1" />Дундаж хурд (км/ц)
              <span className="ml-1 text-gray-400">— заавал биш</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={avgSpeed}
              onChange={(e) => setAvgSpeed(e.target.value)}
              placeholder="Хугацааг бөглөвөл автоматаар тооцох"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              <Star className="w-3.5 h-3.5 inline mr-1" />Үнэлгээ
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? null : n)}
                  className="p-1"
                >
                  <Star
                    className={`w-7 h-7 ${
                      rating != null && n <= rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <FileText className="w-3.5 h-3.5 inline mr-1" />Тэмдэглэл
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Сэтгэгдлээ хуваалцана уу..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-1 text-right">{notes.length}/1000</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Бүртгэх
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
