// EP-06 P1-4: /unsubscribe?token=...
//
// Token = idempotency_key from a recent outbox row. We resolve which user +
// which category, offer a one-click "stop {category} emails" and a "manage all".
// Auth-required: the token is not a secret bearer; it's a hint. We still
// authenticate the caller and gate by user_id match.

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Loader2, BellOff, Bell, ShieldAlert, ArrowRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { logAudit } from '../lib/audit';
import type { NotificationCategory, NotificationMatrix } from '../types/database.types';

interface OutboxLookup {
  category: NotificationCategory;
  template_key: string;
  recipient_user_id: string;
}

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  transactional:   'Transactional (заавал)',
  event_lifecycle: 'Эвентийн мэдэгдэл',
  weather:         'Цаг агаар',
  social:          'Нийгмийн',
  marketing:       'Маркетинг',
  system:          'Систем',
};

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<OutboxLookup | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    let active = true;
    (async () => {
      // The user has RLS-read access only to their own outbox rows.
      const { data, error } = await supabase
        .from('notification_outbox')
        .select('category, template_key, recipient_user_id')
        .eq('idempotency_key', token)
        .maybeSingle();
      if (!active) return;
      if (error) { setError(error.message); setLoading(false); return; }
      if (!data || (data as OutboxLookup).recipient_user_id !== user.id) {
        setError('Энэ token таных биш байж магадгүй. Профайлынхаа тохиргоог нээгээрэй.');
        setLoading(false);
        return;
      }
      setInfo(data as OutboxLookup);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token, user]);

  const stopThisCategory = async (channel: 'email' | 'in_app') => {
    if (!user || !info) return;
    if (info.category === 'transactional') {
      toast.error('Transactional ангилал заавал асаалттай байх ёстой.');
      return;
    }
    const { data: prefs } = await supabase
      .from('notification_preferences').select('matrix').eq('user_id', user.id).single();
    const matrix = ((prefs?.matrix ?? {}) as NotificationMatrix);
    const next: NotificationMatrix = { ...matrix };
    next[info.category] = { ...(next[info.category] ?? {}), [channel]: false };
    const { error } = await supabase
      .from('notification_preferences').update({ matrix: next }).eq('user_id', user.id);
    if (error) { toast.error(error.message); return; }
    await logAudit('preferences.updated', user.id, {
      reason: 'unsubscribe_link',
      category: info.category,
      channel,
      template_key: info.template_key,
    });
    setDone(true);
    toast.success('Тохиргоо шинэчлэгдлээ');
  };

  const stopAllMarketing = async () => {
    if (!user) return;
    const { data: prefs } = await supabase
      .from('notification_preferences').select('matrix').eq('user_id', user.id).single();
    const matrix = ((prefs?.matrix ?? {}) as NotificationMatrix);
    const next: NotificationMatrix = {
      ...matrix,
      marketing: { email: false, in_app: false },
    };
    await supabase.from('notification_preferences').update({ matrix: next }).eq('user_id', user.id);
    await logAudit('preferences.updated', user.id, { reason: 'unsubscribe_link', scope: 'marketing_all' });
    setDone(true);
    toast.success('Маркетинг бүгд унтраагдлаа');
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Нэвтэрсэн байх шаардлагатай</h1>
        <p className="text-sm text-gray-500 mb-4">Аккаунтаараа нэвтрээд дараа нь энэ холбоосыг дахин нээнэ үү.</p>
        <Link to={`/login?next=${encodeURIComponent('/unsubscribe?token=' + token)}`} className="text-primary-600 hover:underline text-sm">
          Нэвтрэх
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Token дутуу байна</h1>
        <Link to="/profile/notifications" className="text-primary-600 hover:underline text-sm">
          Бүх тохиргоог нээх
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh] text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (error || !info) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-gray-900 mb-1">{error ?? 'Токен олдсонгүй'}</h1>
        <Link to="/profile/notifications" className="inline-flex items-center gap-1 text-primary-600 hover:underline text-sm mt-2">
          Бүх тохиргоог нээх <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const isTransactional = info.category === 'transactional';

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
          <BellOff className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Мэдэгдэл унтраах</h1>
        <p className="text-sm text-gray-500 mb-1">
          Та <strong>{CATEGORY_LABEL[info.category]}</strong> ангилалын мэдэгдэл хүлээн авч байна.
        </p>
        <p className="text-xs text-gray-400 mb-6 font-mono">{info.template_key}</p>

        {done ? (
          <div className="bg-green-50 border border-green-100 text-sm text-green-800 rounded-lg px-3 py-2 mb-4">
            Шинэчлэгдлээ. Тохиргоог хүссэн үедээ <Link to="/profile/notifications" className="underline">эндээс</Link> өөрчилж болно.
          </div>
        ) : isTransactional ? (
          <div className="bg-amber-50 border border-amber-100 text-sm text-amber-900 rounded-lg px-3 py-2 mb-4">
            Энэ нь transactional ангилалд хамаарна (RSVP confirm, нууц үг сэргээх г.м). Унтраах боломжгүй —
            энэ нь хууль ёсны шаардлагатай.
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            <button
              onClick={() => stopThisCategory('email')}
              className="w-full inline-flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 text-red-800 rounded-lg text-sm font-medium"
            >
              <span>{CATEGORY_LABEL[info.category]} и-мэйлийг унтраах</span>
              <BellOff className="w-4 h-4" />
            </button>
            {info.category === 'marketing' && (
              <button
                onClick={stopAllMarketing}
                className="w-full inline-flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 text-red-800 rounded-lg text-sm font-medium"
              >
                <span>Бүх маркетинг (email + in-app) унтраах</span>
                <BellOff className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <Link
          to="/profile/notifications"
          className="w-full inline-flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
        >
          <span className="flex items-center gap-1.5"><Bell className="w-4 h-4" /> Бүх тохиргоог нарийвчлан удирдах</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        <p className="text-[10px] text-gray-400 mt-4 text-center">
          Token: <span className="font-mono">{token.slice(0, 24)}...</span>
        </p>
      </div>
    </div>
  );
}
