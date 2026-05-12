// EP-09 P1-3: /check-in/:token landing page.
//
// When a member opens their own QR by accident in the browser, this page tells
// them what to do (show it to the organiser at the event). Does NOT auto-execute
// the check-in — leaked QRs must not grief the owner.
//
// Admin/organiser users don't get a one-tap check-in here either: the scanner
// page (which carries the event_id context) is the canonical entry point.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  QrCode, ArrowRight, Loader2, ShieldAlert, Calendar, MapPin,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface RsvpLookup {
  rsvp_id: string;
  event_id: string;
  user_id: string;
  status: string;
  event_title: string;
  meet_at: string;
  meet_location_name: string;
  is_owner: boolean;
}

export default function CheckInTokenPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();

  const [data, setData] = useState<RsvpLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      // RLS: caller can only read their OWN rsvp by token.
      // Admin / organiser would need the scanner page (which queries by token
      // server-side via check_in_rsvp). So this page is effectively for the owner.
      const { data: r, error: rErr } = await supabase
        .from('event_rsvps')
        .select('id, event_id, user_id, status, events(title, meet_at, meet_location_name)')
        .eq('check_in_token', token)
        .maybeSingle();

      if (!active) return;

      if (rErr) {
        setError(rErr.message);
        setLoading(false);
        return;
      }
      if (!r) {
        setError('QR таних боломжгүй. Та өөрийн ticket хуудаснаасаа шалгана уу.');
        setLoading(false);
        return;
      }

      type Row = {
        id: string; event_id: string; user_id: string; status: string;
        events: { title: string; meet_at: string; meet_location_name: string } | null;
      };
      const row = r as unknown as Row;
      setData({
        rsvp_id: row.id,
        event_id: row.event_id,
        user_id: row.user_id,
        status: row.status,
        event_title: row.events?.title ?? '—',
        meet_at: row.events?.meet_at ?? '',
        meet_location_name: row.events?.meet_location_name ?? '',
        is_owner: !!user && row.user_id === user.id,
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Хүчин төгөлдөр бус QR</h1>
        <p className="text-sm text-gray-500 mb-4">{error ?? 'QR-аас бүртгэл олдсонгүй.'}</p>
        <Link to="/events" className="text-primary-600 text-sm hover:underline">
          ← Эвентүүд рүү буцах
        </Link>
      </div>
    );
  }

  const isOwner = data.is_owner;

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
        <div className="w-14 h-14 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <QrCode className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{data.event_title}</h1>
        <div className="flex items-center justify-center gap-3 text-xs text-gray-500 flex-wrap mb-4">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(data.meet_at).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}</span>
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {data.meet_location_name}</span>
        </div>

        {isOwner ? (
          <>
            <p className="text-sm text-gray-700 mb-2">
              Энэ бол таны check-in QR. Эвент дээр <strong>зохион байгуулагчид үзүүлээрэй</strong> —
              browser дотор автомат check-in хийгдэхгүй.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              Урт хугацаатай дэлгэцэн дээр харах бол доорх товчоор бүрэн ticket хуудсаа нээнэ үү.
            </p>
            <Link
              to={`/events/${data.event_id}/ticket`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
            >
              Миний ticket нээх <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-3">
              Энэ QR өөр гишүүний бүртгэлтэй холбоотой. Browser-аас шууд check-in хийгдэхгүй.
            </p>
            <p className="text-xs text-gray-500 mb-5">
              Зохион байгуулагч бол <strong>scanner хуудаснаас</strong> уншуулаарай:
            </p>
            <Link
              to={`/admin/events/${data.event_id}/scanner`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
            >
              Scanner нээх <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
