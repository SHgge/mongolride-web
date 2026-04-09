import { supabase } from '../lib/supabase';
import type { Tables, UserRole } from '../types/database.types';

export type Profile = Tables<'profiles'>;

interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

interface ListResult<T> {
  data: T[];
  count: number;
  error: string | null;
}

export const profileService = {
  /** Нэг хэрэглэгчийн профайл авах */
  async getProfile(userId: string): Promise<ServiceResult<Profile>> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    return { data, error: error?.message ?? null };
  },

  /** Профайл шинэчлэх (өөрийн) */
  async updateProfile(
    userId: string,
    updates: {
      full_name?: string;
      phone?: string | null;
      avatar_url?: string | null;
      bio?: string | null;
      strava_id?: string | null;
    },
  ): Promise<ServiceResult<Profile>> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    return { data, error: error?.message ?? null };
  },

  /** Бүх профайл авах - Admin */
  async getAllProfiles(
    page = 1,
    pageSize = 20,
    orderBy: keyof Profile = 'created_at',
    ascending = false,
  ): Promise<ListResult<Profile>> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order(orderBy, { ascending })
      .range(from, to);

    return {
      data: data ?? [],
      count: count ?? 0,
      error: error?.message ?? null,
    };
  },

  /** Хэрэглэгчийн role солих - Admin */
  async updateRole(userId: string, role: UserRole): Promise<ServiceResult<Profile>> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    return { data, error: error?.message ?? null };
  },

  /** Профайл хайх (нэрээр) */
  async searchProfiles(query: string, limit = 10): Promise<ListResult<Profile>> {
    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .ilike('full_name', `%${query}%`)
      .eq('is_active', true)
      .limit(limit);

    return {
      data: data ?? [],
      count: count ?? 0,
      error: error?.message ?? null,
    };
  },

  /** Leaderboard - нийт км-ээр эрэмбэлсэн */
  async getLeaderboard(limit = 20): Promise<ListResult<Profile>> {
    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('total_km', { ascending: false })
      .limit(limit);

    return {
      data: data ?? [],
      count: count ?? 0,
      error: error?.message ?? null,
    };
  },

  /** Хэрэглэгчийн байрлал шинэчлэх */
  async updateLocation(
    userId: string,
    lat: number,
    lng: number,
  ): Promise<ServiceResult<Profile>> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        last_known_lat: lat,
        last_known_lng: lng,
        last_location_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    return { data, error: error?.message ?? null };
  },

  /** Хэрэглэгчийн badge-ууд авах */
  async getUserBadges(userId: string) {
    const { data, error } = await supabase
      .from('user_badges')
      .select('*, badges(*)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    return { data: data ?? [], error: error?.message ?? null };
  },
};
