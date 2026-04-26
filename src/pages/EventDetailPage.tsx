import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Calendar, MapPin, Users, Clock, ArrowLeft, Bike, Mountain, Wind,
  Shield, AlertTriangle, CheckCircle2, Loader2, UserPlus, UserMinus,
} from 'lucide-react';
import { supabase, supabasePublic } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables } from '../types/database.types';
import { Loader } from '../components/common';

type Event = Tables<'events'>;
type Rsvp = Tables<'event_rsvps'>;

const DISCIPLINE_LABELS: Record<string, string> = {
  road: 'Зам', mtb: 'Уулын', gravel: 'Хайрга', urban: 'Хотын',
  commute: 'Ажилд', bikepacking: 'Аялал', training: 'Сургалт', other: 'Бусад',
};
const SKILL_LABELS: Record<string, string> = {
  beginner: 'Анхан шат', intermediate: 'Дунд', advanced: 'Дээд', expert: 'Мэргэжлийн', all: 'Бүгд',
};
const DROP_POLICY_LABELS: Record<string, string> = {
  drop: 'Drop (хүлээхгүй)', no_drop: 'No-drop (хүлээнэ)', regroup: 'Regroup (уулзана)',
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', published: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700', completed: 'bg-green-100 text-green-700',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Ноорог', published: 'Удахгүй', cancelled: 'Цуцлагдсан', completed: 'Дууссан',
};
const RSVP_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Бүртгэгдсэн', color: 'bg-green-100 text-green-700' },
  waitlist: { label: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
  pending_payment: { label: 'Төлбөр хүлээж буй', color: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Цуцалсан', color: 'bg-gray-100 text-gray-600' },
  no_show: { label: 'Ирээгүй', color: 'bg-red-100 text-red-700' },
  attended: { label: 'Оролцсон', color: 'bg-primary-100 text-primary-700' },
};
const GEAR_LABELS: Record<string, string> = {
  helmet: 'Малгай', lights: 'Гэрэл', repair_kit: 'Засварын хэрэгсэл',
  water: 'Ус', id: 'Үнэмлэх', emergency_contact: 'Яаралтай холбоо',
  reflective_vest: 'Гэрэлтэх хантааз', hi_vis: 'Тод хувцас',
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isAuthenticated } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [myRsvp, setMyRsvp] = useState<Rsvp | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showRsvpModal, setShowRsvpModal] = useState(false);

  // RSVP form state
  const [liabilityAck, setLiabilityAck] = useState(false);
  const [gearConfirmed, setGearConfirmed] = useState<Set<string>>(new Set());
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [guestCount, setGuestCount] = useState(0);
  const [rsvpNotes, setRsvpNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch event
  useEffect(() => {
    if (!id) return;
    supabasePublic.from('events').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { setEvent(data); setLoading(false); });
  }, [id]);

  // Fetch counts + my RSVP
  const refreshRsvps = useCallback(async () => {
    if (!id) return;
    const { count: confirmed } = await supabasePublic.from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id).eq('status', 'confirmed');
    const { count: wait } = await supabasePublic.from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id).eq('status', 'waitlist');
    setConfirmedCount(confirmed ?? 0);
    setWaitlistCount(wait ?? 0);

    if (user) {
      const { data } = await supabase.from('event_rsvps')
        .select('*').eq('event_id', id).eq('user_id', user.id).maybeSingle();
      setMyRsvp(data);
    }
  }, [id, user]);

  useEffect(() => { refreshRsvps(); }, [refreshRsvps]);

  // Pre-fill emergency from profile (no profile.emergency_contact field; use phone as default)
  useEffect(() => {
    if (profile && !emergencyPhone) {
      setEmergencyName(profile.full_name);
      setEmergencyPhone(profile.phone ?? '');
    }
  }, [profile, emergencyPhone]);

  // Realtime capacity
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`event-rsvps:${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_rsvps', filter: `event_id=eq.${id}`,
      }, () => refreshRsvps())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, refreshRsvps]);

  const openRsvpModal = () => {
    if (!event) return;
    // Pre-tick gear if user already RSVPd
    setGearConfirmed(new Set(event.required_gear));
    setLiabilityAck(false);
    setShowRsvpModal(true);
  };

  const submitRsvp = async () => {
    if (!event) return;

    // All gear must be ticked
    const allGearTicked = event.required_gear.every((g) => gearConfirmed.has(g));
    if (!allGearTicked) { toast.error('Бүх хэрэгслийг баталгаажуулна уу'); return; }
    if (!liabilityAck) { toast.error('Эрсдлийн зөвшөөрөл өгнө үү'); return; }
    if (!emergencyName.trim() || !emergencyPhone.trim()) {
      toast.error('Яаралтай холбоо барих мэдээлэл оруулна уу'); return;
    }

    setSubmitting(true);
    type RpcFn = (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
    const rpc = supabase.rpc as unknown as RpcFn;

    const { error } = await rpc('rsvp_event', {
      p_event_id: event.id,
      p_guest_count: guestCount,
      p_emergency_name: emergencyName.trim(),
      p_emergency_phone: emergencyPhone.trim(),
      p_liability_ack: true,
      p_gear_confirmed: true,
      p_notes: rsvpNotes.trim() || null,
    });

    if (error) {
      toast.error(error.message || 'RSVP алдаа гарлаа');
    } else {
      toast.success('Бүртгэл амжилттай!');
      setShowRsvpModal(false);
      refreshRsvps();
    }
    setSubmitting(false);
  };

  const cancelRsvp = async () => {
    if (!event || !confirm('Та бүртгэлээ цуцлахдаа итгэлтэй байна уу?')) return;
    type RpcFn = (name: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    const rpc = supabase.rpc as unknown as RpcFn;
    const { error } = await rpc('cancel_rsvp', { p_event_id: event.id, p_reason: null });
    if (error) toast.error(error.message);
    else { toast.success('Цуцлагдлаа'); refreshRsvps(); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  if (!event) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Арга хэмжээ олдсонгүй</h2>
        <Link to="/events" className="text-primary-600 font-medium">Бүх арга хэмжээ</Link>
      </div>
    );
  }

  const eventDate = new Date(event.meet_at);
  const isUpcoming = event.status === 'published' && eventDate > new Date();
  const isFull = event.capacity !== null && confirmedCount >= event.capacity;
  const cancellationDeadline = new Date(eventDate.getTime() - event.cancellation_deadline_hours * 3600_000);
  const canCancel = new Date() < cancellationDeadline;
  const coverUrl = event.cover_photo_path
    ? supabasePublic.storage.from('event-assets').getPublicUrl(event.cover_photo_path).data.publicUrl
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Бүх арга хэмжээ
      </Link>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-6 h-64 bg-gradient-to-br from-primary-600 to-primary-500">
        {coverUrl && <img src={coverUrl} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium mb-2 ${STATUS_COLORS[event.status]}`}>
            {STATUS_LABELS[event.status]}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{event.title}</h1>
        </div>
      </div>

      {/* Meta strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">Чиглэл</div>
          <div className="font-semibold text-gray-900 flex items-center gap-1.5">
            <Bike className="w-4 h-4 text-primary-600" /> {DISCIPLINE_LABELS[event.discipline]}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">Түвшин</div>
          <div className="font-semibold text-gray-900">{SKILL_LABELS[event.skill_level]}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">Бодлого</div>
          <div className="font-semibold text-gray-900 text-sm">{DROP_POLICY_LABELS[event.drop_policy]}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-xs text-gray-400 mb-1">Хурд</div>
          <div className="font-semibold text-gray-900 text-sm">
            {event.pace_min_kmh && event.pace_max_kmh
              ? `${event.pace_min_kmh}-${event.pace_max_kmh} км/ц`
              : '—'}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          {event.description && (
            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Тайлбар</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{event.description}</p>
            </div>
          )}

          {/* Distance + elevation + surface */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Маршрут</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                <div><div className="text-xs text-gray-400">Зай</div><div className="font-semibold">{event.distance_km ?? '—'} км</div></div>
              </div>
              <div className="flex items-center gap-2">
                <Mountain className="w-5 h-5 text-primary-600" />
                <div><div className="text-xs text-gray-400">Өндөршил</div><div className="font-semibold">{event.elevation_gain_m ?? 0} м</div></div>
              </div>
            </div>
            {(event.surface_asphalt_pct || event.surface_gravel_pct || event.surface_dirt_pct) && (
              <div>
                <div className="text-xs text-gray-500 mb-2">Гадаргуу</div>
                <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                  {event.surface_asphalt_pct ? <div className="bg-gray-700" style={{ width: `${event.surface_asphalt_pct}%` }} title={`Асфальт ${event.surface_asphalt_pct}%`} /> : null}
                  {event.surface_gravel_pct ? <div className="bg-amber-500" style={{ width: `${event.surface_gravel_pct}%` }} title={`Хайрга ${event.surface_gravel_pct}%`} /> : null}
                  {event.surface_dirt_pct ? <div className="bg-orange-700" style={{ width: `${event.surface_dirt_pct}%` }} title={`Шороо ${event.surface_dirt_pct}%`} /> : null}
                </div>
                <div className="flex gap-3 text-xs text-gray-500 mt-2">
                  {event.surface_asphalt_pct ? <span>Асфальт {event.surface_asphalt_pct}%</span> : null}
                  {event.surface_gravel_pct ? <span>Хайрга {event.surface_gravel_pct}%</span> : null}
                  {event.surface_dirt_pct ? <span>Шороо {event.surface_dirt_pct}%</span> : null}
                </div>
              </div>
            )}
          </div>

          {/* Required gear */}
          {event.required_gear.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Шаардагдах хэрэгсэл</h2>
              <div className="grid grid-cols-2 gap-2">
                {event.required_gear.map((g) => (
                  <div key={g} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-primary-600" /> {GEAR_LABELS[g] ?? g}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Support */}
          {(event.has_sag || event.has_mechanical_support) && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 text-sm text-primary-800">
              {event.has_sag && <div>🚐 SAG машин дагалдана</div>}
              {event.has_mechanical_support && <div>🔧 Засварчинтай</div>}
            </div>
          )}
        </div>

        {/* Right: Schedule + RSVP */}
        <div className="space-y-4">
          {/* Schedule card */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Хуваарь</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /> {eventDate.toLocaleDateString('mn-MN')}</div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Уулзах: {eventDate.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="flex items-center gap-2"><Wind className="w-4 h-4 text-gray-400" /> Хөдлөх: {new Date(event.roll_out_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gray-400 mt-0.5" /> <span>{event.meet_location_name}</span></div>
            </div>
          </div>

          {/* Capacity */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Оролцогчид</h3>
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">{confirmedCount}</span>
              {event.capacity && <span className="text-gray-400">/ {event.capacity}</span>}
            </div>
            {event.capacity && (
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (confirmedCount / event.capacity) * 100)}%` }} />
              </div>
            )}
            {waitlistCount > 0 && <div className="text-xs text-yellow-700">+ {waitlistCount} хүлээгдэж буй</div>}

            {/* RSVP actions */}
            {isUpcoming && isAuthenticated && (
              myRsvp && myRsvp.status !== 'cancelled' ? (
                <div className="mt-4">
                  <div className={`px-3 py-1.5 rounded-md text-xs font-medium text-center mb-2 ${RSVP_STATUS_LABELS[myRsvp.status]?.color ?? 'bg-gray-100'}`}>
                    {RSVP_STATUS_LABELS[myRsvp.status]?.label}
                    {myRsvp.status === 'waitlist' && myRsvp.waitlist_position && ` №${myRsvp.waitlist_position}`}
                  </div>
                  <button onClick={cancelRsvp} disabled={!canCancel}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canCancel ? `Хугацаа дууссан (${event.cancellation_deadline_hours}ц өмнө)` : ''}>
                    <UserMinus className="w-4 h-4" /> Цуцлах
                  </button>
                </div>
              ) : (
                <button onClick={openRsvpModal} disabled={isFull && event.capacity !== null && !event.allow_guests}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  <UserPlus className="w-4 h-4" />
                  {isFull ? 'Хүлээгдэж бүртгүүлэх' : 'Бүртгүүлэх'}
                </button>
              )
            )}
            {isUpcoming && !isAuthenticated && (
              <Link to="/login" className="mt-4 block w-full text-center py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg">
                Нэвтэрч бүртгүүлэх
              </Link>
            )}
          </div>

          {/* Liability deadline info */}
          {isUpcoming && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-xs text-yellow-800">
              <Shield className="w-4 h-4 inline mr-1" />
              Цуцлах эцсийн хугацаа: {cancellationDeadline.toLocaleString('mn-MN', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>
      </div>

      {/* RSVP modal */}
      {showRsvpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 my-8 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Бүртгэлийг баталгаажуулах</h2>
            <p className="text-sm text-gray-500 mb-5">{event.title}</p>

            <div className="space-y-4">
              {/* Gear checklist */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Шаардагдах хэрэгсэл (бүгдийг чагтлана)</label>
                <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                  {event.required_gear.map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={gearConfirmed.has(g)}
                        onChange={(e) => {
                          const next = new Set(gearConfirmed);
                          if (e.target.checked) next.add(g); else next.delete(g);
                          setGearConfirmed(next);
                        }}
                        className="w-4 h-4 text-primary-600 rounded" />
                      <span className="text-sm text-gray-700">{GEAR_LABELS[g] ?? g}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Emergency contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Яаралтай холбоо (нэр)</label>
                  <input type="text" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Утас</label>
                  <input type="text" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
              </div>

              {/* Guest count */}
              {event.allow_guests && event.max_guests_per_member > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Зочны тоо <span className="text-xs text-gray-400">(хамгийн их {event.max_guests_per_member})</span>
                  </label>
                  <input type="number" min={0} max={event.max_guests_per_member}
                    value={guestCount} onChange={(e) => setGuestCount(Math.min(event.max_guests_per_member, Math.max(0, Number(e.target.value))))}
                    className="w-24 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тэмдэглэл (заавал биш)</label>
                <textarea rows={2} value={rsvpNotes} maxLength={500} onChange={(e) => setRsvpNotes(e.target.value)}
                  placeholder="Жишээ: Урдаас 5 минут оройтож ирнэ"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
              </div>

              {/* Liability */}
              <label className="flex items-start gap-2 cursor-pointer bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <input type="checkbox" checked={liabilityAck} onChange={(e) => setLiabilityAck(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded mt-0.5" />
                <span className="text-xs text-yellow-900">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  Би өөрийн эрсдэлээр оролцохыг хүлээн зөвшөөрч байна
                </span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRsvpModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">
                Цуцлах
              </button>
              <button onClick={submitRsvp} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Баталгаажуулах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
