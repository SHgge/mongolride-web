// EP-07 P1-1: per-event analytics table with sortable columns + drill-down + export.

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { logDrilldown, type EventListRow } from '../../../hooks/analytics/queries';

type SortKey = keyof Pick<EventListRow,
  'meet_at' | 'rsvps_total' | 'attended_count' | 'no_show_count' |
  'late_arrival_count' | 'fill_rate' | 'attendance_rate' | 'on_time_rate'>;

interface Props {
  rows: EventListRow[];
  loading?: boolean;
  exportFilters: { from: string; to: string; discipline?: string | null; organizer?: string | null };
}

function pct(v: number | null) {
  return v != null ? `${(v * 100).toFixed(1)}%` : '—';
}

export default function EventTable({ rows, loading, exportFilters }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('meet_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = a[sortKey] as number | string | null;
      const vb = b[sortKey] as number | string | null;
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const handleDrilldown = async (eventId: string) => {
    await logDrilldown('event_detail', eventId, exportFilters as Record<string, unknown>);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Session байхгүй'); return; }
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-analytics`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ view: 'event_list', filters: exportFilters }),
        },
      );
      if (!r.ok) {
        toast.error(`Export алдаа: ${r.status} ${(await r.text()).slice(0, 100)}`);
        return;
      }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `analytics-events-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('CSV татаж эхэлсэн');
    } finally {
      setExporting(false);
    }
  };

  const ColHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      onClick={() => setSort(k)}
      className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none"
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortKey === k && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </span>
    </th>
  );

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Эвентүүд ({rows.length})</h3>
        <button
          onClick={handleExport}
          disabled={exporting || rows.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50/60">
            <tr>
              <ColHeader label="Огноо" k="meet_at" />
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Гарчиг</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Чиглэл</th>
              <ColHeader label="RSVPs" k="rsvps_total" />
              <ColHeader label="Ирсэн" k="attended_count" />
              <ColHeader label="Ирээгүй" k="no_show_count" />
              <ColHeader label="Хоцорсон" k="late_arrival_count" />
              <ColHeader label="Багтаамж %" k="fill_rate" />
              <ColHeader label="Ирц %" k="attendance_rate" />
              <ColHeader label="Цагтаа %" k="on_time_rate" />
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Цаг агаар</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td colSpan={12} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr><td colSpan={12} className="px-3 py-12 text-center text-gray-400">Эвент байхгүй</td></tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.event_id} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {new Date(r.meet_at).toLocaleDateString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[220px] truncate">{r.title}</td>
                  <td className="px-3 py-2 text-gray-500">{r.discipline}</td>
                  <td className="px-3 py-2 tabular-nums">{r.rsvps_total}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{r.attended_count}</td>
                  <td className="px-3 py-2 tabular-nums text-red-600">{r.no_show_count}</td>
                  <td className="px-3 py-2 tabular-nums text-amber-600">{r.late_arrival_count}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.fill_rate)}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.attendance_rate)}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.on_time_rate)}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {r.weather_aqi != null && <span className="mr-1">AQI {r.weather_aqi}</span>}
                    {r.weather_temp_c != null && <span>{Number(r.weather_temp_c).toFixed(0)}°C</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/events/${r.event_id}`}
                      onClick={() => handleDrilldown(r.event_id)}
                      title="Дэлгэрэнгүй (drill-down audit-логд бичигдэнэ)"
                      className="text-gray-400 hover:text-primary-600"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
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
