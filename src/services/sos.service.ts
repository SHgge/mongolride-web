import { supabase } from '../lib/supabase';

export const sosService = {
  async createAlert(userId: string, location: { lat: number; lng: number }, message?: string) {
    return supabase.from('sos_alerts').insert({
      user_id: userId,
      location: `POINT(${location.lng} ${location.lat})`,
      message,
    });
  },
  async getActiveAlerts() {
    return supabase.from('sos_alerts').select('*').eq('status', 'active');
  },
  async resolveAlert(id: string) {
    return supabase.from('sos_alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
  },
};
