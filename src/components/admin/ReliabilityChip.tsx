// EP-09 P1-6: Reliability chip — trailing 90-day attended/no_show ratio.
// Calls the member_reliability(p_user_id) RPC. Caches in-memory by user_id
// so repeated mounts in a list don't refire the call.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Label = 'reliable' | 'mostly_reliable' | 'unreliable' | 'unknown';

interface Reliability {
  attended_count: number;
  no_show_count: number;
  reliability_label: Label;
  last_event_at: string | null;
}

const META: Record<Label, { text: string; cls: string; title: string }> = {
  reliable:        { text: 'Найдвартай',     cls: 'bg-green-100 text-green-700',  title: 'Сүүлийн 90 хоногт ≥90% оролцсон' },
  mostly_reliable: { text: 'Дунд зэрэг',     cls: 'bg-yellow-100 text-yellow-700', title: 'Сүүлийн 90 хоногт 70–90% оролцсон' },
  unreliable:      { text: 'Найдваргүй',     cls: 'bg-red-100 text-red-700',      title: 'Сүүлийн 90 хоногт <70% оролцсон' },
  unknown:         { text: '—',              cls: 'bg-gray-100 text-gray-500',    title: 'Хангалттай мэдээлэл алга (3-аас бага RSVP)' },
};

const cache = new Map<string, Reliability | null>();

export default function ReliabilityChip({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const [data, setData] = useState<Reliability | null>(cache.get(userId) ?? null);
  const [loading, setLoading] = useState(!cache.has(userId));

  useEffect(() => {
    if (cache.has(userId)) {
      setData(cache.get(userId) ?? null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase.rpc('member_reliability' as never, { p_user_id: userId } as never)
      .then(({ data: rows, error }) => {
        if (!active) return;
        if (error) {
          cache.set(userId, null);
          setData(null);
        } else {
          const row = (Array.isArray(rows) ? rows[0] : rows) as Reliability | null;
          cache.set(userId, row);
          setData(row);
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  if (loading) {
    return <span className="inline-block w-16 h-4 bg-gray-100 rounded animate-pulse" />;
  }

  const label: Label = data?.reliability_label ?? 'unknown';
  const meta = META[label];
  const tip = data
    ? `${meta.title} (${data.attended_count} оролцсон, ${data.no_show_count} ирээгүй)`
    : meta.title;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${meta.cls}`}
      title={tip}
    >
      {meta.text}
      {!compact && data && (data.attended_count + data.no_show_count) > 0 && (
        <span className="text-gray-500/80 ml-1">{data.attended_count}/{data.attended_count + data.no_show_count}</span>
      )}
    </span>
  );
}
