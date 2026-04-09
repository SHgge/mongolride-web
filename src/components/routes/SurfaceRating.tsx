import type { SurfaceType } from '../../types/database.types';

const SURFACE_LABELS: Record<SurfaceType, { label: string; color: string }> = {
  asphalt: { label: 'Асфальт', color: 'bg-gray-100 text-gray-600' },
  dirt: { label: 'Шороо', color: 'bg-amber-100 text-amber-700' },
  gravel: { label: 'Хайрга', color: 'bg-stone-100 text-stone-600' },
  ice: { label: 'Мөс', color: 'bg-cyan-100 text-cyan-700' },
  mixed: { label: 'Холимог', color: 'bg-purple-100 text-purple-700' },
};

interface SurfaceRatingProps {
  surfaces: SurfaceType[];
  size?: 'sm' | 'md';
}

export default function SurfaceRating({ surfaces, size = 'sm' }: SurfaceRatingProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  return (
    <div className="flex flex-wrap gap-1.5">
      {surfaces.map((s) => {
        const info = SURFACE_LABELS[s] ?? SURFACE_LABELS.mixed;
        return (
          <span key={s} className={`${padding} rounded-md ${textSize} font-medium ${info.color}`}>
            {info.label}
          </span>
        );
      })}
    </div>
  );
}
