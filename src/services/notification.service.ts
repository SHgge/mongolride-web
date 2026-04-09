import { supabase } from '../lib/supabase';

export const notificationService = {
  async getNotifications(userId: string) {
    return supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  },
  async markAsRead(id: string) {
    return supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },
  async markAllAsRead(userId: string) {
    return supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  },
};
