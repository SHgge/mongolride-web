// EP-09 P1-4: Printable roster — /admin/events/:eventId/roster
// A4-friendly. Visible only to admin/organizer/co-organizer.
// Includes emergency contacts; no-shows surface at the bottom (NULL checked_in_at last).

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables } from '../types/database.types';

type Event = Tables<'events'>;

interface RosterRow {
  rsvp_id: string;
  user_id: string;
  full_name: string;
  status: string;
  checked_in_at: string | null;
  checked_in_late: boolean | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  guest_count: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  pending_payment: 'Pending payment',
  attended: 'Attended',
  waitlist: 'Waitlist',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export default function RosterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, profile } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authorised, setAuthorised] = useState(false);

  useEffect(() => {
    if (!eventId || !user) return;
    let active = true;
    (async () => {
      const { data: ev } = await supabase
        .from('events').select('*').eq('id', eventId).maybeSingle();
      if (!active) return;
      if (!ev) { setAuthChecked(true); setLoading(false); return; }
      const e = ev as Event;
      setEvent(e);

      const isAdmin = profile?.role === 'admin';
      const isOrg = e.organizer_id === user.id;
      const isCo = (e.co_organizer_ids ?? []).includes(user.id);
      const isSweep = e.sweep_rider_id === user.id;
      const ok = isAdmin || isOrg || isCo || isSweep;
      setAuthorised(ok);
      setAuthChecked(true);
      if (!ok) { setLoading(false); return; }

      const { data: rsvps } = await supabase
        .from('event_rsvps')
        .select('id, user_id, status, checked_in_at, checked_in_late, emergency_contact_name, emergency_contact_phone, guest_count')
        .eq('event_id', eventId)
        .neq('status', 'cancelled')
        .order('checked_in_at', { ascending: true, nullsFirst: false });

      const userIds = Array.from(new Set((rsvps ?? []).map((r) => r.user_id as string)));
      const profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles').select('id, full_name').in('id', userIds);
        for (const p of profs ?? []) {
          profileMap.set(p.id as string, (p.full_name as string) ?? '');
        }
      }

      if (!active) return;
      setRows((rsvps ?? []).map((r) => ({
        rsvp_id: r.id as string,
        user_id: r.user_id as string,
        full_name: profileMap.get(r.user_id as string) ?? '',
        status: r.status as string,
        checked_in_at: (r.checked_in_at as string | null) ?? null,
        checked_in_late: (r.checked_in_late as boolean | null) ?? null,
        emergency_contact_name: (r.emergency_contact_name as string | null) ?? null,
        emergency_contact_phone: (r.emergency_contact_phone as string | null) ?? null,
        guest_count: (r.guest_count as number | null) ?? null,
      })));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [eventId, user, profile]);

  const printedAt = useMemo(() =>
    new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }),
  []);

  if (!user) return <Navigate to="/login" replace />;
  if (loading || !authChecked) {
    return <div className="flex items-center justify-center min-h-[40vh] text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!authorised || !event) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Хандах эрхгүй</h1>
        <Link to="/admin/events" className="text-primary-600 text-sm hover:underline mt-2 inline-block">
          ← Эвентүүд
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 print:p-0 print:max-w-none">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link to={`/admin/events`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Эвентүүд
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          <Printer className="w-4 h-4" /> A4 хэвлэх
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 print:border-0 print:p-2">
        <header className="border-b border-gray-200 pb-3 mb-3">
          <h1 className="text-xl font-bold text-gray-900">{event.title}</h1>
          <div className="text-xs text-gray-500 flex flex-wrap gap-3 mt-1">
            <span>{new Date(event.meet_at).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}</span>
            <span>· {event.meet_location_name}</span>
            <span>· Хэвлэсэн: {printedAt}</span>
            <span>· Нийт: {rows.length} мөр</span>
          </div>
        </header>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 print:bg-transparent">
              <th className="text-left px-2 py-1.5 border border-gray-200 w-8">#</th>
              <th className="text-left px-2 py-1.5 border border-gray-200">Нэр</th>
              <th className="text-left px-2 py-1.5 border border-gray-200 w-28">Төлөв</th>
              <th className="text-left px-2 py-1.5 border border-gray-200 w-44">Яаралтай холбоо</th>
              <th className="text-left px-2 py-1.5 border border-gray-200 w-20">Check-in</th>
              <th className="text-center px-2 py-1.5 border border-gray-200 w-12">✓</th>
              <th className="text-left px-2 py-1.5 border border-gray-200 w-24">Гарын үсэг</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-6 text-gray-400">Бүртгэл байхгүй</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.rsvp_id} className="hover:bg-gray-50 print:hover:bg-transparent">
                <td className="px-2 py-1.5 border border-gray-200">{i + 1}</td>
                <td className="px-2 py-1.5 border border-gray-200">
                  <div className="font-medium">{r.full_name || '—'}</div>
                  {r.guest_count ? <div className="text-[10px] text-gray-500">+{r.guest_count} зочин</div> : null}
                </td>
                <td className="px-2 py-1.5 border border-gray-200">{STATUS_LABEL[r.status] ?? r.status}</td>
                <td className="px-2 py-1.5 border border-gray-200">
                  {r.emergency_contact_name ?? '—'}
                  {r.emergency_contact_phone ? <div className="text-[10px] text-gray-500">{r.emergency_contact_phone}</div> : null}
                </td>
                <td className="px-2 py-1.5 border border-gray-200">
                  {r.checked_in_at
                    ? <>
                        {new Date(r.checked_in_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ulaanbaatar' })}
                        {r.checked_in_late ? <span className="text-amber-700"> (хоцорсон)</span> : null}
                      </>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-2 py-1.5 border border-gray-200 text-center">
                  <span className="inline-block w-5 h-5 border border-gray-300 rounded-sm" />
                </td>
                <td className="px-2 py-1.5 border border-gray-200">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="text-[10px] text-gray-400 mt-3">
          MongolRide · Энэхүү хуудас бол paper backup. QR scanner-ээр уншуулсаны дараа хайчтай үлдээх.
        </footer>
      </div>
    </div>
  );
}
