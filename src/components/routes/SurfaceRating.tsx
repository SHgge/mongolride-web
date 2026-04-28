import type { RouteSurfaceBreakdown } from '../../types/database.types';

const SURFACE_LABELS: Record<keyof RouteSurfaceBreakdown, { label: string; color: string }> = {
  asphalt: { label: 'Асфальт', color: 'bg-gray-100 text-gray-600' },
  gravel:  { label: 'Хайрга',  color: 'bg-stone-100 text-stone-600' },
  dirt:    { label: 'Шороо',   color: 'bg-amber-100 text-amber-700' },
};

interface SurfaceRatingProps {
  breakdown: RouteSurfaceBreakdown;
  size?: 'sm' | 'md';
  showPct?: boolean;
}

export default function SurfaceRating({ breakdown, size = 'sm', showPct = false }: SurfaceRatingProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  const entries = (Object.entries(breakdown) as Array<[keyof RouteSurfaceBreakdown, number | undefined]>)
    .filter(([, pct]) => (pct ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

  if (entries.length === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, pct]) => {
        const info = SURFACE_LABELS[key];
        return (
          <span key={key} className={`${padding} rounded-md ${textSize} font-medium ${info.color}`}>
            {info.label}{showPct ? ` ${pct}%` : ''}
          </span>
        );
      })}
    </div>
  );
}
