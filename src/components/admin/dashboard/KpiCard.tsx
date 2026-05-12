// EP-07 P1-1: KPI card with current value + delta vs prior period.

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface KpiCardProps {
  label: string;
  value: string;
  rawValue: number | null;
  prevValue: number | null;
  deltaUnit?: 'pct' | 'pp' | 'count';
  /** When true, lower is better (e.g. no-show rate) — flips color logic */
  inverse?: boolean;
  to?: string;
  loading?: boolean;
}

function fmtDelta(cur: number | null, prev: number | null, unit: 'pct' | 'pp' | 'count'): {
  text: string; sign: 'up' | 'down' | 'flat';
} {
  if (cur == null || prev == null || prev === 0) return { text: '—', sign: 'flat' };
  const diff = cur - prev;
  const sign: 'up' | 'down' | 'flat' = Math.abs(diff) < 0.0001 ? 'flat' : diff > 0 ? 'up' : 'down';
  if (unit === 'pp') {
    // percentage points (diff is already in 0..1 scale)
    return { text: `${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)} pp`, sign };
  }
  if (unit === 'pct') {
    const rel = (diff / prev) * 100;
    return { text: `${rel >= 0 ? '+' : ''}${rel.toFixed(1)}%`, sign };
  }
  return { text: `${diff >= 0 ? '+' : ''}${diff.toLocaleString('mn-MN')}`, sign };
}

export default function KpiCard({
  label, value, rawValue, prevValue, deltaUnit = 'pct', inverse = false, to, loading,
}: KpiCardProps) {
  const delta = fmtDelta(rawValue, prevValue, deltaUnit);
  // Color logic: positive delta is green unless inverse (then red)
  const goodGreen = !inverse;
  const cls = delta.sign === 'flat'
    ? 'text-gray-400'
    : (delta.sign === 'up') === goodGreen
      ? 'text-green-600'
      : 'text-red-600';
  const Icon = delta.sign === 'up' ? ArrowUp : delta.sign === 'down' ? ArrowDown : Minus;

  const inner = (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      {loading ? (
        <div className="h-7 w-16 bg-gray-100 rounded animate-pulse" />
      ) : (
        <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      )}
      <div className={`text-xs mt-1 inline-flex items-center gap-1 ${cls}`}>
        <Icon className="w-3 h-3" />
        <span>{delta.text}</span>
        <span className="text-gray-400">vs prev</span>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
