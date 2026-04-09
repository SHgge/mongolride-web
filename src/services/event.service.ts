import { supabase } from '../lib/supabase';
import type { InsertTables } from '../types/database.types';

export const eventService = {
  async getEvents(page = 1, pageSize = 12) {
    const from = (page - 1) * pageSize;
    return supabase.from('events').select('*', { count: 'exact' }).range(from, from + pageSize - 1).order('event_date', { ascending: true });
  },
  async getEvent(id: string) {
    return supabase.from('events').select('*').eq('id', id).single();
  },
  async createEvent(data: InsertTables<'events'>) {
    return supabase.from('events').insert(data);
  },
  async joinEvent(eventId: string, userId: string) {
    return supabase.from('event_participants').insert({ event_id: eventId, user_id: userId });
  },
  async getUpcomingEvents(limit = 4) {
    return supabase.from('events').select('*').eq('status', 'upcoming').order('event_date', { ascending: true }).limit(limit);
  },
};
