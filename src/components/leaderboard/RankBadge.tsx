import { Award } from 'lucide-react';
import { RANK_LABELS, RANK_COLORS, type UserRank } from '../../types/user.types';

interface RankBadgeProps {
  rank: UserRank;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const SIZES = {
  sm: { badge: 'px-2 py-0.5 text-xs', icon: 'w-3 h-3' },
  md: { badge: 'px-2.5 py-1 text-sm', icon: 'w-4 h-4' },
  lg: { badge: 'px-3 py-1.5 text-base', icon: 'w-5 h-5' },
};

export default function RankBadge({ rank, size = 'sm', showLabel = true }: RankBadgeProps) {
  const color = RANK_COLORS[rank] ?? '#9ca3af';
  const label = RANK_LABELS[rank] ?? rank;
  const s = SIZES[size];

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full text-white ${s.badge}`}
      style={{ backgroundColor: color }}
    >
      <Award className={s.icon} />
      {showLabel && label}
    </span>
  );
}
