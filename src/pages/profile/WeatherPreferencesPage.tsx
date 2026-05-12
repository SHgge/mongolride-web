import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, RotateCcw, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Tables } from '../../types/database.types';

type Prefs = Tables<'profile_weather_prefs'>;

const DEFAULTS: Omit<Prefs, 'user_id' | 'created_at' | 'updated_at'> = {
  notifications_enabled: true,
  cold_threshold_c: -25,
  wind_threshold_ms: 15,
  aqi_threshold: 100,
  notify_on_yellow: false,
  notify_on_orange: true,
  notify_on_red: true,
  notify_on_black: true,
  preferred_notification_channels: ['in_app', 'email'],
};

export default function WeatherPreferencesPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<typeof DEFAULTS>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profile_weather_prefs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setPrefs({
          notifications_enabled: data.notifications_enabled,
          cold_threshold_c: Number(data.cold_threshold_c),
          wind_threshold_ms: Number(data.wind_threshold_ms),
          aqi_threshold: data.aqi_threshold,
          notify_on_yellow: data.notify_on_yellow,
          notify_on_orange: data.notify_on_orange,
          notify_on_red: data.notify_on_red,
          notify_on_black: data.notify_on_black,
          preferred_notification_channels: data.preferred_notification_channels ?? ['in_app','email'],
        });
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profile_weather_prefs')
      .upsert({ user_id: user.id, ...prefs });
    setSaving(false);
    if (error) {
      toast.error(`Хадгалах алдаа: ${error.message}`);
    } else {
      toast.success('Тохиргоо хадгалагдлаа');
    }
  };

  const toggleChannel = (ch: string) => {
    const has = prefs.preferred_notification_channels.includes(ch);
    setPrefs({
      ...prefs,
      preferred_notification_channels: has
        ? prefs.preferred_notification_channels.filter((c) => c !== ch)
        : [...prefs.preferred_notification_channels, ch],
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Профайл
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Цаг агаарын тохиргоо</h1>
      <p className="text-sm text-gray-500 mb-8">
        Хүйтэн, салхи, агаарын чанар зэрэг анхааруулга хэзээ авахаа сонго.
      </p>

      <div className="space-y-5">
        {/* Master toggle */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-gray-900">Анхааруулга идэвхжүүлэх</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Унтраавал ямар ч цаг агаарын анхааруулга хүлээн авахгүй.
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.notifications_enabled}
              onChange={(e) => setPrefs({ ...prefs, notifications_enabled: e.target.checked })}
              className="w-5 h-5 text-primary-600 rounded"
            />
          </label>
        </div>

        {/* Severity levels */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="font-medium text-gray-900 mb-3">Ямар түвшний эрсдэлд анхааруулах вэ</div>
          <div className="space-y-2">
            {[
              { key: 'notify_on_yellow' as const, label: 'Шар (Анхааруулга) — бага зэрэг эрсдэл', color: 'bg-yellow-400' },
              { key: 'notify_on_orange' as const, label: 'Улбар шар (Эрсдэлтэй) — анхаарал шаардлагатай', color: 'bg-orange-500' },
              { key: 'notify_on_red' as const,    label: 'Улаан (Аюултай) — ноцтой эрсдэл', color: 'bg-red-500' },
              { key: 'notify_on_black' as const,  label: 'Хар (Цуцлахыг зөвлөж байна) — амь насанд аюултай', color: 'bg-gray-900' },
            ].map((row) => (
              <label key={row.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[row.key]}
                  onChange={(e) => setPrefs({ ...prefs, [row.key]: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className={`w-3 h-3 rounded-full ${row.color}`} />
                <span className="text-sm text-gray-700">{row.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Thresholds */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <div className="font-medium text-gray-900">Хувийн босго</div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Хүйтнээс анхаарах: <strong>{prefs.cold_threshold_c}°C</strong>-аас доош
            </label>
            <input
              type="range" min="-40" max="0" step="1"
              value={prefs.cold_threshold_c}
              onChange={(e) => setPrefs({ ...prefs, cold_threshold_c: Number(e.target.value) })}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>-40°C</span><span>0°C</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Салхинаас анхаарах: <strong>{prefs.wind_threshold_ms} м/с</strong>-ээс хүчтэй
            </label>
            <input
              type="range" min="5" max="30" step="1"
              value={prefs.wind_threshold_ms}
              onChange={(e) => setPrefs({ ...prefs, wind_threshold_ms: Number(e.target.value) })}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>5 м/с</span><span>30 м/с</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Агаарын чанарыг анхаарах: AQI <strong>{prefs.aqi_threshold}</strong>-аас өндөр
            </label>
            <input
              type="range" min="50" max="300" step="10"
              value={prefs.aqi_threshold}
              onChange={(e) => setPrefs({ ...prefs, aqi_threshold: Number(e.target.value) })}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>50</span><span>300</span>
            </div>
          </div>
        </div>

        {/* Channels */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="font-medium text-gray-900 mb-3">Хаашаа илгээх вэ</div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.preferred_notification_channels.includes('in_app')}
                onChange={() => toggleChannel('in_app')}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">Аппликейшн доторх мэдэгдэл</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.preferred_notification_channels.includes('email')}
                onChange={() => toggleChannel('email')}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">И-мэйл</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPrefs(DEFAULTS)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <RotateCcw className="w-4 h-4" /> Default утгууд руу буцаах
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}
