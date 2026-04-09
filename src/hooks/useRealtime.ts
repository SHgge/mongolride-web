import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtime(table: string, callback: (payload: unknown) => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        callback(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback]);
}
