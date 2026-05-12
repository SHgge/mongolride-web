// EP-07 P1-2: period selector (7d / 30d / 90d / season / custom).
// Uses URL search params so dashboard state is shareable.

import { useSearchParams } from 'react-router-dom';

export type PeriodKey = '7d' | '30d' | '90d' | 'season' | 'custom';

interface Props {
  // When custom is active, the parent owns from/to; otherwise we compute it.
}

const PRESETS: Array<{ key: PeriodKey; label: string }> = [
  { key: '7d',     label: '7 хоног' },
  { key: '30d',    label: '30 хоног' },
  { key: '90d',    label: '90 хоног' },
  { key: 'season', label: 'Энэ улирал' },
  { key: 'custom', label: 'Бусад' },
];

export function periodToRange(key: PeriodKey, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  switch (key) {
    case '7d':  from.setDate(to.getDate() - 7); break;
    case '30d': from.setDate(to.getDate() - 30); break;
    case '90d': from.setDate(to.getDate() - 90); break;
    case 'season': {
      // Mongolian-relevant season buckets: Mar-May (хавар), Jun-Aug (зун), Sep-Nov (намар), Dec-Feb (өвөл).
      const m = to.getMonth();
      let sm: number;
      if (m >= 2 && m <= 4) sm = 2;        // Mar
      else if (m >= 5 && m <= 7) sm = 5;   // Jun
      else if (m >= 8 && m <= 10) sm = 8;  // Sep
      else sm = m === 11 ? 11 : -1;        // Dec or Jan/Feb (handled below)
      const y = to.getFullYear();
      if (sm === -1) {
        // Jan/Feb → previous year December
        from.setFullYear(y - 1, 11, 1);
      } else {
        from.setFullYear(y, sm, 1);
      }
      from.setHours(0, 0, 0, 0);
      break;
    }
    case 'custom':
      if (customFrom) from.setTime(new Date(customFrom).getTime());
      if (customTo)   to.setTime(new Date(customTo).getTime());
      break;
  }
  return { from, to };
}

export default function PeriodSelector({ }: Props) {
  const [params, setParams] = useSearchParams();
  const current = (params.get('period') as PeriodKey) ?? '30d';
  const customFrom = params.get('from') ?? '';
  const customTo   = params.get('to')   ?? '';
  const compare = params.get('compare') === '1';

  const setPeriod = (k: PeriodKey) => {
    const next = new URLSearchParams(params);
    next.set('period', k);
    if (k !== 'custom') { next.delete('from'); next.delete('to'); }
    setParams(next, { replace: true });
  };

  const setCustom = (from: string, to: string) => {
    const next = new URLSearchParams(params);
    next.set('period', 'custom');
    next.set('from', from);
    next.set('to', to);
    setParams(next, { replace: true });
  };

  const setCompare = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set('compare', '1'); else next.delete('compare');
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex bg-gray-100 rounded-lg p-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              current === p.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {current === 'custom' && (
        <div className="flex items-center gap-1 text-xs">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustom(e.target.value, customTo)}
            className="px-2 py-1 border border-gray-200 rounded"
          />
          <span className="text-gray-400">—</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustom(customFrom, e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded"
          />
        </div>
      )}
      <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
        <input
          type="checkbox"
          checked={compare}
          onChange={(e) => setCompare(e.target.checked)}
          className="w-3.5 h-3.5 text-primary-600 rounded"
        />
        <span className="text-gray-600">Өмнөх үетэй харьцуулах</span>
      </label>
    </div>
  );
}

export function useCurrentPeriod() {
  const [params] = useSearchParams();
  const key = (params.get('period') as PeriodKey) ?? '30d';
  const customFrom = params.get('from') ?? undefined;
  const customTo   = params.get('to')   ?? undefined;
  const compare    = params.get('compare') === '1';
  const { from, to } = periodToRange(key, customFrom, customTo);
  return { key, from, to, fromIso: from.toISOString(), toIso: to.toISOString(), compare };
}
