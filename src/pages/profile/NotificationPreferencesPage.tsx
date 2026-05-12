// EP-06 P1-2: /profile/notifications — per-user notification preferences

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Loader2, Save, Lock, Bell, Mail, Globe, RotateCcw,
  Pause, Cloud,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logAudit } from '../../lib/audit';
import type {
  Tables, NotificationCategory, NotificationChannel, NotificationLocale, NotificationMatrix,
} from '../../types/database.types';

type Prefs = Tables<'notification_preferences'>;

const CATEGORY_META: Record<NotificationCategory, { label: string; description: string; locked?: boolean }> = {
  transactional:   { label: 'Гүйлгээний (transactional)', description: 'RSVP confirm, payment receipt, password reset — заавал авах', locked: true },
  event_lifecycle: { label: 'Эвентийн мэдэгдэл', description: 'Сануулга, өөрчлөлт, цуцлах' },
  weather:         { label: 'Цаг агаар',          description: 'Хүйтэн / салхи / AQI анхааруулга' },
  social:          { label: 'Нийгмийн',           description: 'Бусад гишүүний идэвхжил' },
  marketing:       { label: 'Маркетинг',          description: 'Шинэ функц, кампанит ажил' },
  system:          { label: 'Систем',             description: 'Аккаунт, аюулгүй байдал' },
};

const CHANNEL_META: Record<NotificationChannel, { label: string; icon: typeof Mail; supported: boolean }> = {
  email:    { label: 'И-мэйл',      icon: Mail,   supported: true },
  in_app:   { label: 'Аппликейшн',  icon: Bell,   supported: true },
  web_push: { label: 'Web push (V1.1)', icon: Globe, supported: false },
};

const PAUSE_OPTIONS = [
  { label: 'Идэвхтэй',         days: 0 },
  { label: '1 хоног',           days: 1 },
  { label: '7 хоног',           days: 7 },
  { label: '30 хоног',          days: 30 },
];

export default function NotificationPreferencesPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSnapshot, setOriginalSnapshot] = useState<Prefs | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      let row = data as Prefs | null;
      if (!row) {
        // Backfill defensive insert (the trigger should already have created one)
        const { data: created } = await supabase
          .from('notification_preferences').insert({ user_id: user.id }).select().single();
        row = created as Prefs;
      }
      setPrefs(row);
      setOriginalSnapshot(row);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  const setMatrix = (cat: NotificationCategory, ch: NotificationChannel, val: boolean) => {
    if (!prefs) return;
    const next: NotificationMatrix = { ...(prefs.matrix as NotificationMatrix) };
    next[cat] = { ...(next[cat] ?? {}), [ch]: val };
    setPrefs({ ...prefs, matrix: next });
  };

  const setPauseDays = (days: number) => {
    if (!prefs) return;
    if (days === 0) {
      setPrefs({ ...prefs, paused_until: null });
    } else {
      const until = new Date(Date.now() + days * 86_400_000).toISOString();
      setPrefs({ ...prefs, paused_until: until });
    }
  };

  const save = async () => {
    if (!prefs || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from('notification_preferences')
      .update({
        preferred_locale: prefs.preferred_locale,
        timezone: prefs.timezone,
        quiet_hours_start: prefs.quiet_hours_start,
        quiet_hours_end: prefs.quiet_hours_end,
        allow_severe_during_dnd: prefs.allow_severe_during_dnd,
        paused_until: prefs.paused_until,
        matrix: prefs.matrix,
      })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast.error(`Хадгалах алдаа: ${error.message}`);
      return;
    }
    // Diff vs original for audit
    if (originalSnapshot) {
      const diff: Record<string, unknown> = {};
      (['preferred_locale','timezone','quiet_hours_start','quiet_hours_end','allow_severe_during_dnd','paused_until'] as const).forEach((k) => {
        if (originalSnapshot[k] !== prefs[k]) diff[k] = { from: originalSnapshot[k], to: prefs[k] };
      });
      if (JSON.stringify(originalSnapshot.matrix) !== JSON.stringify(prefs.matrix)) {
        diff.matrix = { from: originalSnapshot.matrix, to: prefs.matrix };
      }
      if (Object.keys(diff).length > 0) {
        await logAudit('preferences.updated', user.id, diff);
      }
    }
    setOriginalSnapshot(prefs);
    toast.success('Тохиргоо хадгалагдлаа');
  };

  const resetDefaults = () => {
    if (!prefs) return;
    if (!confirm('Default утгууд руу буцаах уу?')) return;
    setPrefs({
      ...prefs,
      preferred_locale: 'mn',
      quiet_hours_start: null,
      quiet_hours_end: null,
      allow_severe_during_dnd: true,
      paused_until: null,
      matrix: {
        transactional:   { email: true,  in_app: true },
        event_lifecycle: { email: true,  in_app: true },
        weather:         { email: true,  in_app: true },
        social:          { email: false, in_app: true },
        marketing:       { email: false, in_app: false },
        system:          { email: true,  in_app: true },
      },
    });
  };

  if (loading || !prefs) {
    return <div className="flex items-center justify-center min-h-[40vh] text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const matrix = prefs.matrix as NotificationMatrix;
  const isPaused = prefs.paused_until && new Date(prefs.paused_until) > new Date();
  const pauseRemaining = isPaused
    ? Math.ceil((new Date(prefs.paused_until!).getTime() - Date.now()) / 86_400_000)
    : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Профайл
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Мэдэгдлийн тохиргоо</h1>
      <p className="text-sm text-gray-500 mb-8">
        Аль ангилалын мэдэгдлийг аль сувгаар авахаа сонго. Гүйлгээний ангилал заавал асаалттай (хууль ёсны шаардлага).
      </p>

      <div className="space-y-5">
        {/* Pause-all */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Pause className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-900">Түр зогсоох</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Чухал бус мэдэгдлийг хэдэн өдрийн турш үл хүлээн авна. Severe анхааруулга + transactional хэвээр явна.
          </p>
          <div className="flex flex-wrap gap-2">
            {PAUSE_OPTIONS.map((o) => {
              const active = (o.days === 0 && !isPaused) || (o.days > 0 && isPaused && Math.abs(pauseRemaining - o.days) < 1);
              return (
                <button
                  key={o.days}
                  onClick={() => setPauseDays(o.days)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                    active ? 'bg-primary-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {isPaused && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mt-3">
              {pauseRemaining} хоногийн дотор мэдэгдэл хүлээн авахгүй ({new Date(prefs.paused_until!).toLocaleDateString('mn-MN')}-н хүртэл).
            </p>
          )}
        </div>

        {/* Locale */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-2">Хэл</h3>
          <div className="flex gap-2">
            {(['mn','en'] as NotificationLocale[]).map((l) => (
              <button
                key={l}
                onClick={() => setPrefs({ ...prefs, preferred_locale: l })}
                className={`px-4 py-1.5 text-sm font-medium rounded-md ${
                  prefs.preferred_locale === l ? 'bg-primary-600 text-white' : 'bg-gray-50 text-gray-700'
                }`}
              >
                {l === 'mn' ? 'Монгол' : 'English'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Зарим template-ийн EN хувилбар үгүй бол MN-ээр буцна.</p>
        </div>

        {/* Quiet hours */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-2">Чимээгүй цаг</h3>
          <p className="text-xs text-gray-500 mb-3">
            Энэ хооронд чухал бус мэдэгдэл хойшилно. Цагийн бүс: <strong>{prefs.timezone}</strong>.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Эхлэх</label>
              <input
                type="time"
                value={prefs.quiet_hours_start ?? ''}
                onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Дуусах</label>
              <input
                type="time"
                value={prefs.quiet_hours_end ?? ''}
                onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.allow_severe_during_dnd}
              onChange={(e) => setPrefs({ ...prefs, allow_severe_during_dnd: e.target.checked })}
              className="w-3.5 h-3.5 text-primary-600 rounded"
            />
            <span className="text-gray-700">Severe цаг агаар + SOS-г чимээгүй цагт ч хүлээж авна</span>
          </label>
        </div>

        {/* Matrix */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-3">Ангилал × суваг</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4">Ангилал</th>
                  {(Object.keys(CHANNEL_META) as NotificationChannel[]).map((ch) => {
                    const Icon = CHANNEL_META[ch].icon;
                    return (
                      <th key={ch} className="py-2 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <Icon className="w-3.5 h-3.5" /> {CHANNEL_META[ch].label}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(CATEGORY_META) as NotificationCategory[]).map((cat) => {
                  const meta = CATEGORY_META[cat];
                  return (
                    <tr key={cat} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4">
                        <div className="font-medium text-gray-900 flex items-center gap-1.5">
                          {meta.label}
                          {meta.locked && (
                            <span title="Заавал — нийтлэг шаардлага" className="text-amber-600">
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400">{meta.description}</div>
                      </td>
                      {(Object.keys(CHANNEL_META) as NotificationChannel[]).map((ch) => {
                        const supported = CHANNEL_META[ch].supported;
                        const enabled = matrix[cat]?.[ch] ?? false;
                        const disabled = meta.locked || !supported;
                        return (
                          <td key={ch} className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={meta.locked ? true : enabled}
                              disabled={disabled}
                              onChange={(e) => setMatrix(cat, ch, e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded disabled:opacity-50"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cross-link to weather page */}
        <Link
          to="/profile/weather"
          className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-primary-600" />
            <div>
              <div className="font-medium text-gray-900 text-sm">Цаг агаарын босгууд</div>
              <div className="text-xs text-gray-500">Хүйтэн / салхи / AQI хувийн босго</div>
            </div>
          </div>
          <span className="text-xs text-primary-600 font-medium">Засах →</span>
        </Link>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <RotateCcw className="w-4 h-4" /> Default-руу буцаах
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
