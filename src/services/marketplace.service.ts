import { supabase } from '../lib/supabase';
import type { InsertTables, UpdateTables } from '../types/database.types';

export const marketplaceService = {
  async getListings(page = 1, pageSize = 12) {
    const from = (page - 1) * pageSize;
    return supabase.from('listings').select('*', { count: 'exact' }).eq('status', 'active').range(from, from + pageSize - 1).order('created_at', { ascending: false });
  },
  async getListing(id: string) {
    return supabase.from('listings').select('*').eq('id', id).single();
  },
  async createListing(data: InsertTables<'listings'>) {
    return supabase.from('listings').insert(data);
  },
  async updateListing(id: string, data: UpdateTables<'listings'>) {
    return supabase.from('listings').update(data).eq('id', id);
  },
};
