import { supabase } from '../lib/supabase';
import type { InsertTables, UpdateTables } from '../types/database.types';

export const newsService = {
  async getArticles(page = 1, pageSize = 12) {
    const from = (page - 1) * pageSize;
    return supabase.from('news').select('*', { count: 'exact' }).eq('is_published', true).range(from, from + pageSize - 1).order('published_at', { ascending: false });
  },
  async getArticle(slug: string) {
    return supabase.from('news').select('*').eq('slug', slug).single();
  },
  async createArticle(data: InsertTables<'news'>) {
    return supabase.from('news').insert(data);
  },
  async updateArticle(id: string, data: UpdateTables<'news'>) {
    return supabase.from('news').update(data).eq('id', id);
  },
};
