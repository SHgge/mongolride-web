// EP-06 P1-1: admin templates list — /admin/notifications/templates

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Mail, Bell, Globe, Loader2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { Tables, NotificationCategory, NotificationLocale } from '../../../types/database.types';

type Template = Tables<'notification_templates'>;

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  transactional:   'Transactional',
  event_lifecycle: 'Event lifecycle',
  weather:         'Weather',
  social:          'Social',
  marketing:       'Marketing',
  system:          'System',
};

const CHANNEL_ICON = {
  email:    Mail,
  in_app:   Bell,
  web_push: Globe,
};

export default function TemplatesListPage() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [localeFilter, setLocaleFilter] = useState<NotificationLocale | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('notification_templates')
        .select('*')
        .order('key', { ascending: true })
        .order('locale')
        .order('channel')
        .order('version', { ascending: false });
      if (active) {
        setRows((data ?? []) as Template[]);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Group by key. Within a key, the active row drives the headline.
  const grouped = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (search && !r.key.toLowerCase().includes(search.toLowerCase())) return false;
      if (localeFilter !== 'all' && r.locale !== localeFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      return true;
    });
    const map = new Map<string, Template[]>();
    for (const r of filtered) {
      const list = map.get(r.key) ?? [];
      list.push(r);
      map.set(r.key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, search, localeFilter, categoryFilter]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notification template-ууд</h1>
        <p className="text-sm text-gray-500 mt-1">
          Бүх и-мэйл болон in-app мэдэгдлийн агуулгыг энд засна. Мустах + Марк-даун.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Key-ээр хайх (event.rsvp_confirmed...)"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <select
          value={localeFilter}
          onChange={(e) => setLocaleFilter(e.target.value as NotificationLocale | 'all')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">Бүх locale</option>
          <option value="mn">MN</option>
          <option value="en">EN</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as NotificationCategory | 'all')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">Бүх ангилал</option>
          {(Object.keys(CATEGORY_LABEL) as NotificationCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Template олдсонгүй.</div>
      ) : (
        <div className="space-y-2">
          {grouped.map(([key, versions]) => {
            const head = versions[0];
            return (
              <div key={key} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-mono text-sm font-semibold text-gray-900">{key}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] uppercase tracking-wide text-gray-500">
                          {CATEGORY_LABEL[head.category]}
                        </span>
                        {head.description && (
                          <span className="text-xs text-gray-400 truncate max-w-md">{head.description}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{versions.length} хувилбар</div>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {versions.map((v) => {
                    const Icon = CHANNEL_ICON[v.channel];
                    return (
                      <Link
                        key={v.id}
                        to={`/admin/notifications/templates/${v.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm"
                      >
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-700 w-12">{v.locale.toUpperCase()}</span>
                        <span className="w-16 text-gray-500">{v.channel}</span>
                        <span className="w-14 text-gray-400">v{v.version}</span>
                        {v.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Идэвхтэй
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-[10px] font-medium">
                            <XCircle className="w-3 h-3" /> Архив
                          </span>
                        )}
                        <span className="text-gray-400 text-xs truncate flex-1 ml-2">
                          {v.subject_md ?? v.body_md.slice(0, 80)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
