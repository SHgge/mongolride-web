import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Tables } from '../../types/database.types';

type SOSAlertType = Tables<'sos_alerts'>;

export default function SOSAlert() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SOSAlertType[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch active alerts
    supabase
      .from('sos_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => setAlerts(data ?? []));

    // Subscribe to realtime
    const channel = supabase
      .channel('sos-live')
      .on('broadcast', { event: 'new-sos' }, (_payload) => {
        // Refetch on new SOS
        supabase
          .from('sos_alerts')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .then(({ data }) => setAlerts(data ?? []));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleRespond = async (alertId: string) => {
    if (!user) return;
    await supabase.from('sos_responses').insert({
      sos_id: alertId,
      responder_id: user.id,
    });
    // Update alert status
    await supabase.from('sos_alerts').update({ status: 'responding' }).eq('id', alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  // Don't show own alerts or when no alerts
  const otherAlerts = alerts.filter((a) => a.user_id !== user?.id);
  if (otherAlerts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-40 space-y-3 max-w-sm">
      {otherAlerts.map((alert) => (
        <div key={alert.id} className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-lg animate-pulse-slow">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-800">SOS Тусламжийн дуудлага!</h3>
              {alert.message && (
                <p className="text-xs text-red-600 mt-1">{alert.message}</p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-red-500">
                <Clock className="w-3 h-3" />
                {new Date(alert.created_at).toLocaleTimeString('mn-MN')}
              </div>
              <button
                onClick={() => handleRespond(alert.id)}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" /> Тусалъя
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
