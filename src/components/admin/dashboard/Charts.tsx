// EP-07 P1-3: dashboard charts (member growth, weather scatter, day-of-week heatmap, cohort).
// Each chart loads its own data via the analytics hooks.

import { useMemo, useState } from 'react';
import {
  Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine,
  ComposedChart, Legend,
} from 'recharts';
import { Loader2, AlertTriangle, TrendingUp, Users, Cloud, Calendar } from 'lucide-react';
import {
  useMemberGrowth, useCohortRetention, useWeatherScatter, useDowHeatmap,
  type CohortRow,
} from '../../../hooks/analytics/queries';

const DOW_LABELS = ['Ня','Да','Мя','Лх','Пү','Ба','Бя'];

interface RangeProps {
  fromIso: string;
  toIso: string;
}

// ============================================================
// Member growth (line + bar combo)
// ============================================================
export function MemberGrowthChart({ fromIso, toIso }: RangeProps) {
  const { data, isLoading, error } = useMemberGrowth({ fromIso, toIso });

  const chartData = (data ?? []).map((r) => ({
    week: new Date(r.week_start).toLocaleDateString('mn-MN', {
      month: '2-digit', day: '2-digit', timeZone: 'Asia/Ulaanbaatar',
    }),
    new_members: r.new_members,
    active_members: r.active_members,
  }));

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-primary-600" />
        <h3 className="font-semibold text-gray-900 text-sm">Гишүүний өсөлт</h3>
      </div>
      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-sm text-red-600">{(error as Error).message}</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="week" stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={11} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="new_members" name="Шинэ" fill="#86efac" />
            <Line type="monotone" dataKey="active_members" name="Идэвхтэй" stroke="#16a34a" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ============================================================
// Weather impact scatter (X = metric, Y = attendance %)
// ============================================================
export function WeatherScatterChart() {
  const [metric, setMetric] = useState<'aqi' | 'temp' | 'wind'>('aqi');
  const { data, isLoading, error } = useWeatherScatter(metric);

  const chartData = (data ?? []).map((r) => ({
    x: Number(r.x),
    y: Number(r.y) * 100,
    label: r.label,
  }));

  const xLabel = metric === 'aqi' ? 'AQI' : metric === 'temp' ? 'Температур (°C)' : 'Салхи (м/с)';
  const xRefs = metric === 'aqi' ? [100, 150]
              : metric === 'temp' ? [-25, 32]
              : [12, 18];

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Цаг агаарын нөлөө</h3>
        </div>
        <div className="inline-flex bg-gray-100 rounded-md p-0.5">
          {(['aqi','temp','wind'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                metric === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              {m === 'aqi' ? 'AQI' : m === 'temp' ? 'Темп' : 'Салхи'}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-sm text-red-600">{(error as Error).message}</div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">
          Хангалттай data байхгүй (өнгөрсөн эвентэд цаг агаарын snapshot хэрэгтэй)
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" dataKey="x" name={xLabel} stroke="#9ca3af" fontSize={11}
                   label={{ value: xLabel, position: 'insideBottom', offset: -5, style: { fontSize: 11 } }} />
            <YAxis type="number" dataKey="y" stroke="#9ca3af" fontSize={11}
                   label={{ value: 'Ирц %', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} domain={[0, 100]} />
            {xRefs.map((v) => <ReferenceLine key={v} x={v} stroke="#f59e0b" strokeDasharray="3 3" />)}
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(v, name) => {
                const num = typeof v === 'number' ? v : Number(v);
                return name === 'y' ? `${num.toFixed(1)}%` : String(v);
              }}
              labelFormatter={() => ''}
            />
            <Scatter data={chartData} fill="#16a34a" />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ============================================================
// Day-of-week heatmap (rows = dow, cols = hour)
// ============================================================
export function DayOfWeekHeatmap({ fromIso }: { fromIso: string }) {
  const { data, isLoading } = useDowHeatmap(fromIso);

  // Build a [7 dows × 24 hours] grid; default to null
  const grid = useMemo(() => {
    const g: Array<Array<{ rate: number; count: number } | null>> =
      Array.from({ length: 7 }, () => Array(24).fill(null));
    for (const r of data ?? []) {
      if (r.dow >= 0 && r.dow < 7 && r.hour >= 0 && r.hour < 24) {
        g[r.dow][r.hour] = { rate: Number(r.attendance_rate_avg) || 0, count: r.event_count };
      }
    }
    return g;
  }, [data]);

  // Color scale 0..1 → green
  const colorFor = (rate: number) => {
    const a = Math.max(0, Math.min(1, rate));
    return `rgba(22,163,74,${0.15 + a * 0.75})`;
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-primary-600" />
        <h3 className="font-semibold text-gray-900 text-sm">Өдөр × цагийн ирц</h3>
      </div>
      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-[10px] border-separate" style={{ borderSpacing: 1 }}>
            <thead>
              <tr>
                <th className="w-8" />
                {Array.from({ length: 24 }).map((_, h) => (
                  <th key={h} className="w-5 text-center text-gray-400 font-normal">{h % 4 === 0 ? h : ''}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, dow) => (
                <tr key={dow}>
                  <td className="text-gray-500 pr-1">{DOW_LABELS[dow]}</td>
                  {row.map((cell, h) => (
                    <td
                      key={h}
                      className="w-5 h-5 rounded-sm"
                      style={{ background: cell ? colorFor(cell.rate) : '#f3f4f6' }}
                      title={cell
                        ? `${DOW_LABELS[dow]} ${h}:00 — ${(cell.rate * 100).toFixed(1)}% (${cell.count} эвент)`
                        : `${DOW_LABELS[dow]} ${h}:00 — data байхгүй`}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
            <span>0%</span>
            <div className="flex-1 h-1.5 rounded" style={{
              background: 'linear-gradient(to right, rgba(22,163,74,0.15), rgba(22,163,74,0.9))'
            }} />
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Cohort retention heatmap (rows = signup month, cols = M0..M11)
// ============================================================
export function CohortHeatmap({ fromIso }: { fromIso: string }) {
  const { data, isLoading } = useCohortRetention(fromIso);

  const { months, cohorts } = useMemo(() => {
    const cohortMap = new Map<string, Map<number, CohortRow>>();
    for (const r of data ?? []) {
      const key = r.cohort_month;
      if (!cohortMap.has(key)) cohortMap.set(key, new Map());
      cohortMap.get(key)!.set(r.months_since, r);
    }
    const cohorts = Array.from(cohortMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12);
    const monthsSet = new Set<number>();
    for (const [, m] of cohorts) for (const k of m.keys()) monthsSet.add(k);
    const months = Array.from(monthsSet).sort((a, b) => a - b).slice(0, 12);
    return { months, cohorts };
  }, [data]);

  const colorFor = (pct: number) => `rgba(22,163,74,${0.1 + (pct / 100) * 0.8})`;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-primary-600" />
        <h3 className="font-semibold text-gray-900 text-sm">Cohort retention</h3>
      </div>
      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : cohorts.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Cohort өгөгдөл байхгүй</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-[10px] border-separate" style={{ borderSpacing: 1 }}>
            <thead>
              <tr>
                <th className="text-left text-gray-500 pr-2">Cohort</th>
                <th className="text-right text-gray-400 font-normal pr-2">N</th>
                {months.map((m) => (
                  <th key={m} className="w-10 text-center text-gray-400 font-normal">M{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map(([cohortMonth, monthMap]) => {
                const size = monthMap.values().next().value?.cohort_size ?? 0;
                return (
                  <tr key={cohortMonth}>
                    <td className="text-gray-700 pr-2">
                      {new Date(cohortMonth).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short' })}
                    </td>
                    <td className="text-right text-gray-400 pr-2">{size}</td>
                    {months.map((m) => {
                      const cell = monthMap.get(m);
                      return (
                        <td
                          key={m}
                          className="w-10 h-6 rounded-sm text-center text-gray-900"
                          style={{ background: cell ? colorFor(Number(cell.retention_pct)) : '#f3f4f6' }}
                          title={cell
                            ? `${cell.retention_pct}% (${Math.round(Number(cell.retention_pct) * Number(cell.cohort_size) / 100)}/${cell.cohort_size})`
                            : ''}
                        >
                          {cell ? `${Math.round(Number(cell.retention_pct))}` : ''}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Funnel (RSVPs → confirmed → attended → on-time)
// ============================================================
interface FunnelProps {
  rsvps: number;
  confirmed: number;
  attended: number;
  onTime: number;
}
export function FunnelChart({ rsvps, confirmed, attended, onTime }: FunnelProps) {
  const data = [
    { stage: 'RSVPs',     value: rsvps },
    { stage: 'Confirmed', value: confirmed },
    { stage: 'Attended',  value: attended },
    { stage: 'On-time',   value: onTime },
  ];
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-primary-600" />
        <h3 className="font-semibold text-gray-900 text-sm">Funnel</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" stroke="#9ca3af" fontSize={11} />
          <YAxis type="category" dataKey="stage" stroke="#9ca3af" fontSize={11} />
          <Tooltip />
          <Bar dataKey="value" fill="#16a34a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
