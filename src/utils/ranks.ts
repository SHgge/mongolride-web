export interface RankInfo {
  name: string;
  nameMn: string;
  minKm: number;
  color: string;
}

export const RANKS: RankInfo[] = [
  { name: 'Beginner', nameMn: 'Эхлэгч', minKm: 0, color: '#9ca3af' },
  { name: 'Rider', nameMn: 'Унагч', minKm: 100, color: '#22c55e' },
  { name: 'Explorer', nameMn: 'Нээгч', minKm: 500, color: '#3b82f6' },
  { name: 'Adventurer', nameMn: 'Адалжагч', minKm: 1000, color: '#a855f7' },
  { name: 'Champion', nameMn: 'Аварга', minKm: 2500, color: '#f59e0b' },
  { name: 'Legend', nameMn: 'Домог', minKm: 5000, color: '#ef4444' },
];

export function getRank(totalKm: number): RankInfo {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (totalKm >= RANKS[i].minKm) return RANKS[i];
  }
  return RANKS[0];
}
