// EP-09 P1-1: Member ticket page — /events/:id/ticket
// Shows the user's own RSVP QR for offline display at the ride start point.
// Auth-gated; uses RLS to fetch only the caller's own RSVP.

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Calendar, MapPin, Download, Printer, Loader2,
  Apple, Wallet, ShieldAlert,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables } from '../types/database.types';

type Event = Tables<'events'>;
type Rsvp = Tables<'event_rsvps'>;

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Бүртгэгдсэн',
  pending_payment: 'Төлбөр хүлээж буй',
  attended: 'Оролцсон',
  waitlist: 'Хүлээгдэж буй',
  cancelled: 'Цуцалсан',
  no_show: 'Ирээгүй',
};

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Wakelock so the screen doesn't dim while the organiser scans
  useEffect(() => {
    let wake: { release?: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (kind: string) => Promise<{ release?: () => Promise<void> }> };
    };
    if (nav.wakeLock) {
      nav.wakeLock.request('screen').then((sentinel) => { wake = sentinel; }).catch(() => {});
    }
    return () => { wake?.release?.().catch(() => {}); };
  }, []);

  // Load event + RSVP
  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    (async () => {
      try {
        const [{ data: ev, error: eErr }, { data: r, error: rErr }] = await Promise.all([
          supabase.from('events').select('*').eq('id', id).maybeSingle(),
          supabase.from('event_rsvps')
            .select('*')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);
        if (!active) return;
        if (eErr || !ev) { setError('Эвент олдсонгүй'); return; }
        if (rErr || !r) { setError('Бүртгэл олдсонгүй'); return; }
        setEvent(ev as Event);
        setRsvp(r as Rsvp);

        // Generate QR (lazy import keeps bundle small)
        const { default: QRCode } = await import('qrcode');
        const url = `${window.location.origin}/check-in/${(r as Rsvp).check_in_token}`;
        const dataUrl = await QRCode.toDataURL(url, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 600,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        if (active) setQrDataUrl(dataUrl);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, user]);

  const handleSaveImage = async () => {
    if (!qrDataUrl || !event || !profile) return;
    // Composite QR + event title + member name onto a canvas
    const canvas = canvasRef.current ?? document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 720;
    canvas.height = 920;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(event.title, canvas.width / 2, 60);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(new Date(event.meet_at).toLocaleString('mn-MN'), canvas.width / 2, 92);
    const img = new Image();
    await new Promise<void>((res) => { img.onload = () => res(); img.src = qrDataUrl; });
    ctx.drawImage(img, 60, 130, 600, 600);
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(profile.full_name, canvas.width / 2, 770);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Энэ QR зөвхөн өөрийнхөө check-in-д зориулагдсан', canvas.width / 2, 800);
    ctx.fillText(`MongolRide · ${window.location.origin}`, canvas.width / 2, 880);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ticket-${event.title.replace(/\s+/g, '-')}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };

  const handlePrint = () => window.print();

  const showWalletStub = () => toast('Apple/Google Wallet pass — V1.1-д бэлэн болно');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error || !event || !rsvp) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-gray-900">{error ?? 'Бүртгэлийн дэлгэрэнгүй олдсонгүй'}</h1>
        <Link to={`/events/${id}`} className="text-primary-600 text-sm mt-2 inline-block hover:underline">
          ← Эвент рүү буцах
        </Link>
      </div>
    );
  }

  const isCheckable = rsvp.status === 'confirmed' || rsvp.status === 'attended' || rsvp.status === 'pending_payment';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 print:py-0 print:px-0">
      <Link to={`/events/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 print:hidden">
        <ArrowLeft className="w-4 h-4" /> Эвент
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden print:border-0">
        <div className="bg-gradient-to-br from-primary-600 to-primary-500 text-white p-6 print:bg-white print:text-gray-900">
          <p className="text-xs opacity-80 mb-1 print:opacity-60">Миний бүртгэл</p>
          <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm mt-3 opacity-90">
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(event.meet_at).toLocaleString('mn-MN')}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.meet_location_name}</span>
          </div>
        </div>

        <div className="p-6 grid sm:grid-cols-[300px_1fr] gap-6 items-start">
          {/* QR */}
          <div className="flex flex-col items-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Check-in QR"
                className="w-[280px] h-[280px] border-4 border-white shadow-lg rounded-xl"
              />
            ) : (
              <div className="w-[280px] h-[280px] bg-gray-100 rounded-xl flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-3 text-center max-w-[280px]">
              Энэ QR зөвхөн таны check-in-д зориулагдсан — бусадтай хуваалцаж болохгүй.
            </p>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Гишүүн</p>
              <p className="text-base font-semibold text-gray-900">{profile?.full_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Төлөв</p>
              <p className="text-sm font-medium text-primary-700">{STATUS_LABEL[rsvp.status] ?? rsvp.status}</p>
            </div>
            {rsvp.checked_in_at && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Check-in</p>
                <p className="text-sm font-medium text-green-700">
                  {new Date(rsvp.checked_in_at).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}
                  {rsvp.checked_in_late ? ' (хоцорсон)' : ''}
                </p>
              </div>
            )}
            {(rsvp.emergency_contact_name || rsvp.emergency_contact_phone) && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Яаралтай холбоо</p>
                <p className="text-sm text-gray-700">
                  {rsvp.emergency_contact_name}
                  {rsvp.emergency_contact_phone ? ` · ${rsvp.emergency_contact_phone}` : ''}
                </p>
              </div>
            )}
            {!isCheckable && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
                Энэ бүртгэлээр одоохондоо check-in хийх боломжгүй ({STATUS_LABEL[rsvp.status] ?? rsvp.status}).
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-wrap gap-2 print:hidden">
          <button
            onClick={handleSaveImage}
            disabled={!qrDataUrl}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Зураг хадгалах
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <Printer className="w-4 h-4" /> Хэвлэх
          </button>
          <button
            onClick={showWalletStub}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <Apple className="w-4 h-4" /> Apple Wallet (V1.1)
          </button>
          <button
            onClick={showWalletStub}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <Wallet className="w-4 h-4" /> Google Wallet (V1.1)
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
