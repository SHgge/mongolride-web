import { supabase } from '../lib/supabase';
import type { InsertTables, UpdateTables } from '../types/database.types';

export const routeService = {
  async getRoutes(page = 1, pageSize = 12) {
    const from = (page - 1) * pageSize;
    return supabase.from('routes').select('*', { count: 'exact' }).range(from, from + pageSize - 1).order('created_at', { ascending: false });
  },
  async getRoute(id: string) {
    return supabase.from('routes').select('*').eq('id', id).single();
  },
  async createRoute(data: InsertTables<'routes'>) {
    return supabase.from('routes').insert(data);
  },
  async updateRoute(id: string, data: UpdateTables<'routes'>) {
    return supabase.from('routes').update(data).eq('id', id);
  },
  async getFeaturedRoutes() {
    return supabase.from('routes').select('*').eq('status', 'approved').order('avg_rating', { ascending: false }).limit(6);
  },
};
