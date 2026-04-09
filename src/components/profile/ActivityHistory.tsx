import { useEffect, useState } from 'react';
import { Mountain, FileText, Bike } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Tables } from '../../types/database.types';

type KmLog = Tables<'km_logs'>;

interface KmLogWithRoute extends KmLog {
  route_title?: string;
}

interface ActivityHistoryProps {
  refreshKey?: number;
}

export default function ActivityHistory({ refreshKey }: ActivityHistoryProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<KmLogWithRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('km_logs')
      .select('*, routes(title)')
      .eq('user_id', user.id)
      .order('ride_date', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const mapped = (data ?? []).map((log: Record<string, unknown>) => ({
          ...(log as KmLog),
          route_title: (log.routes as { title: string } | null)?.title,
        }));
        setLogs(mapped);
        setLoading(false);
      });
  }, [user, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-10">
        <Bike className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Одоогоор бүртгэл байхгүй</p>
        <p className="text-xs text-gray-400 mt-1">Дээрх "Км бүртгэх" товч дараад эхлээрэй</p>
      </div>
    );
  }

  // Group by month
  const grouped: Record<string, KmLogWithRoute[]> = {};
  logs.forEach((log) => {
    const d = new Date(log.ride_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(log);
  });

  const monthNames = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([monthKey, monthLogs]) => {
        const [year, month] = monthKey.split('-').map(Number);
        const totalKm = monthLogs.reduce((sum, l) => sum + Number(l.distance_km), 0);
        const totalElev = monthLogs.reduce((sum, l) => sum + l.elevation_gain, 0);

        return (
          <div key={monthKey}>
            {/* Month header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {monthNames[month - 1]} {year}
              </h3>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{totalKm.toFixed(1)} км</span>
                <span>{totalElev.toLocaleString()} м</span>
                <span>{monthLogs.length} унаа</span>
              </div>
            </div>

            {/* Logs */}
            <div className="space-y-2">
              {monthLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  {/* Date */}
                  <div className="w-10 h-10 bg-white rounded-lg flex flex-col items-center justify-center border border-gray-100 flex-shrink-0">
                    <span className="text-sm font-bold text-gray-900 leading-none">{new Date(log.ride_date).getDate()}</span>
                    <span className="text-[9px] text-gray-400">{new Date(log.ride_date).toLocaleDateString('mn-MN', { weekday: 'short' })}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {log.route_title ?? 'Чөлөөт унаа'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      {log.notes && (
                        <span className="flex items-center gap-0.5 truncate max-w-[150px]">
                          <FileText className="w-3 h-3" /> {log.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-primary-700">{Number(log.distance_km).toFixed(1)} км</div>
                    {log.elevation_gain > 0 && (
                      <div className="text-xs text-gray-400 flex items-center justify-end gap-0.5">
                        <Mountain className="w-3 h-3" /> {log.elevation_gain} м
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
