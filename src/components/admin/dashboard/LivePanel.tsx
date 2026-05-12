// EP-07 P1-5: live "happening now" panel.
// Shows event currently in progress (meet_at within last 6h, status='published'),
// counters update via Realtime.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface LiveEvent {
  id: string;
  title: string;
  meet_at: string;
  capacity: number | null;
}

interface Counts {
  confirmed: number;
  attended: number;
  late: number;
  no_show: number;
}

export default function LivePanel() {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [counts, setCounts] = useState<Counts>({ confirmed: 0, attended: 0, late: 0, no_show: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 3600_000).toISOString();
      const oneHourAhead = new Date(Date.now() + 1 * 3600_000).toISOString();
      const { data } = await supabase
        .from('events')
        .select('id, title, meet_at, capacity')
        .eq('status', 'published')
        .gte('meet_at', sixHoursAgo)
        .lte('meet_at', oneHourAhead)
        .order('meet_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setEvent(data as LiveEvent | null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!event) return;

    const refreshCounts = async () => {
      const [{ count: confirmed }, { count: attended }, { count: late }, { count: noShow }] =
        await Promise.all([
          supabase.from('event_rsvps').select('*', { count: 'exact', head: true })
            .eq('event_id', event.id).eq('status', 'confirmed'),
          supabase.from('event_rsvps').select('*', { count: 'exact', head: true })
            .eq('event_id', event.id).eq('status', 'attended'),
          supabase.from('event_rsvps').select('*', { count: 'exact', head: true })
            .eq('event_id', event.id).eq('status', 'attended').eq('checked_in_late', true),
          supabase.from('event_rsvps').select('*', { count: 'exact', head: true })
            .eq('event_id', event.id).eq('status', 'no_show'),
        ]);
      setCounts({
        confirmed: confirmed ?? 0,
        attended:  attended  ?? 0,
        late:      late      ?? 0,
        no_show:   noShow    ?? 0,
      });
    };
    refreshCounts();

    const ch = supabase
      .channel(`live-panel:${event.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_rsvps',
        filter: `event_id=eq.${event.id}`,
      }, () => refreshCounts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [event]);

  if (loading || !event) return null;

  const total = counts.confirmed + counts.attended + counts.no_show;

  return (
    <Link
      to={`/admin/events/${event.id}/scanner`}
      className="block bg-gradient-to-r from-primary-50 to-amber-50 border border-primary-200 rounded-xl px-5 py-3 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </div>
        <Activity className="w-4 h-4 text-primary-700" />
        <span className="font-semibold text-gray-900 text-sm">Live: {event.title}</span>
        <span className="text-xs text-gray-500">
          {new Date(event.meet_at).toLocaleTimeString('mn-MN', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ulaanbaatar',
          })}
        </span>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="tabular-nums">
            <strong className="text-green-700">{counts.attended}</strong>
            {event.capacity ? <span className="text-gray-400"> / {event.capacity}</span> : null}
            <span className="text-gray-500 ml-1">checked in</span>
          </span>
          {counts.late > 0 && <span className="text-amber-700 tabular-nums">{counts.late} хоцорсон</span>}
          {counts.no_show > 0 && <span className="text-red-600 tabular-nums">{counts.no_show} ирээгүй</span>}
          {total > 0 && (
            <span className="text-gray-400">
              {Math.round((counts.attended / Math.max(1, total)) * 100)}% ирц
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
