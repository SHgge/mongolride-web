import type { Tables, UserRole, UserRank } from './database.types';

export type Profile = Tables<'profiles'>;

export type { UserRole, UserRank };

export const RANK_LABELS: Record<UserRank, string> = {
  unaga: 'Унага',
  daagan: 'Даага',
  shudlen: 'Шүдлэн',
  khuleg: 'Хүлэг',
  avarga: 'Аварга',
};

export const RANK_MIN_KM: Record<UserRank, number> = {
  unaga: 0,
  daagan: 100,
  shudlen: 500,
  khuleg: 1000,
  avarga: 3000,
};

export const RANK_COLORS: Record<UserRank, string> = {
  unaga: '#9ca3af',
  daagan: '#22c55e',
  shudlen: '#3b82f6',
  khuleg: '#a855f7',
  avarga: '#ef4444',
};
