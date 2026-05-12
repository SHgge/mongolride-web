// EP-06 P1-3: in-app notifications feed — /notifications

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, CheckCircle2, Calendar, Cloud, Trophy, AlertTriangle, Loader2, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables } from '../types/database.types';

type Notification = Tables<'notifications'>;

const PAGE_SIZE = 30;

const TYPE_ICON = (type: string) => {
  if (type.startsWith('weather.')) return Cloud;
  if (type.startsWith('event.') || type.startsWith('rsvp.')) return Calendar;
  if (type.startsWith('membership.')) return CheckCircle2;
  if (type.startsWith('system.')) return AlertTriangle;
  if (type.startsWith('badge.') || type.startsWith('leaderboard.')) return Trophy;
  return Bell;
};

const FILTERS = [
  { key: 'all',     label: 'Бүгд' },
  { key: 'unread',  label: 'Уншаагүй' },
  { key: 'event',   label: 'Эвент' },
  { key: 'weather', label: 'Цаг агаар' },
  { key: 'system',  label: 'Систем' },
] as const;

type Filter = typeof FILTERS[number]['key'];

export default function NotificationsFeedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);

    let q = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filter === 'unread') q = q.eq('is_read', false);
    if (filter === 'event')   q = q.like('type', 'event.%');
    if (filter === 'weather') q = q.like('type', 'weather.%');
    if (filter === 'system')  q = q.like('type', 'system.%');

    q.then(({ data, count }) => {
      if (!active) return;
      setItems((data ?? []) as Notification[]);
      setTotal(count ?? 0);
      setLoading(false);
    });

    return () => { active = false; };
  }, [user, filter, page]);

  // Realtime: prepend new rows
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notifications:${user.id}:feed`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, ({ new: row }) => {
        setItems((prev) => [row as Notification, ...prev].slice(0, PAGE_SIZE));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    setMarking(true);
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setMarking(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const headerCounts = useMemo(() => {
    return {
      total: items.length,
      unread: items.filter((n) => !n.is_read).length,
    };
  }, [items]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary-600" /> Мэдэгдлүүд
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} нийт · {headerCounts.unread} уншаагүй</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/profile/notifications"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Тохиргоо
          </Link>
          <button
            onClick={markAllRead}
            disabled={marking || headerCounts.unread === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md disabled:opacity-50"
          >
            {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Бүгдийг уншсан
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(0); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === f.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Мэдэгдэл байхгүй</div>
        ) : (
          items.map((n) => {
            const Icon = TYPE_ICON(n.type);
            const inner = (
              <div className={`flex items-start gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors ${
                !n.is_read ? 'bg-primary-50/30' : ''
              }`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  !n.is_read ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{n.title}</span>
                    {!n.is_read && <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />}
                  </div>
                  {n.message && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}
                    <span className="ml-2 font-mono opacity-60">{n.type}</span>
                  </p>
                </div>
                {n.link && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />}
              </div>
            );
            const handleClick = () => { if (!n.is_read) markOneRead(n.id); };
            return n.link ? (
              <Link key={n.id} to={n.link} onClick={handleClick} className="block">{inner}</Link>
            ) : (
              <button key={n.id} type="button" onClick={handleClick} className="w-full text-left">{inner}</button>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs">
          <button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
          >
            ← Өмнөх
          </button>
          <span className="text-gray-500">{page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
          >
            Дараах →
          </button>
        </div>
      )}
    </div>
  );
}
