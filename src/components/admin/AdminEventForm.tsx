import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Calendar, Bike, XCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ImageUpload } from '../common';
import { logAudit } from '../../lib/audit';
import { diffKeys, shouldNotifyParticipants } from '../../lib/eventDiff';

const DISCIPLINES = [
  { value: 'road', label: 'Зам' },
  { value: 'mtb', label: 'Уулын' },
  { value: 'gravel', label: 'Хайрга' },
  { value: 'urban', label: 'Хотын' },
  { value: 'commute', label: 'Ажилд' },
  { value: 'bikepacking', label: 'Аялал' },
  { value: 'training', label: 'Сургалт' },
  { value: 'other', label: 'Бусад' },
];

const SKILL_LEVELS = [
  { value: 'beginner', label: 'Анхан шат' },
  { value: 'intermediate', label: 'Дунд' },
  { value: 'advanced', label: 'Дээд' },
  { value: 'expert', label: 'Мэргэжлийн' },
  { value: 'all', label: 'Бүгд' },
];

const DROP_POLICIES = [
  { value: 'no_drop', label: 'No-drop (хүлээнэ)' },
  { value: 'drop', label: 'Drop (хүлээхгүй)' },
  { value: 'regroup', label: 'Regroup (уулзана)' },
];

const VISIBILITIES = [
  { value: 'public', label: 'Нийтэд' },
  { value: 'members', label: 'Гишүүдэд' },
  // { value: 'invitation', label: 'Зөвхөн уригдсан (V1.2)' }, // deferred
];

const GEAR_OPTIONS = [
  { value: 'helmet', label: 'Малгай' },
  { value: 'lights', label: 'Гэрэл' },
  { value: 'repair_kit', label: 'Засварын хэрэгсэл' },
  { value: 'water', label: 'Ус' },
  { value: 'id', label: 'Үнэмлэх' },
  { value: 'emergency_contact', label: 'Яаралтай холбоо' },
  { value: 'reflective_vest', label: 'Гэрэлтэх хантааз' },
  { value: 'hi_vis', label: 'Тод хувцас' },
];

interface AdminEventFormProps {
  eventId?: string;
  onCancel: () => void;
  onSaved: () => void;
}

// Convert ISO timestamp -> "YYYY-MM-DDTHH:mm" for datetime-local inputs
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminEventForm({ eventId, onCancel, onSaved }: AdminEventFormProps) {
  const { user } = useAuth();
  useNavigate();

  const isEdit = !!eventId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverPhotoPath, setCoverPhotoPath] = useState<string>('');
  const [discipline, setDiscipline] = useState('road');
  const [skillLevel, setSkillLevel] = useState('all');
  const [meetAt, setMeetAt] = useState('');
  const [rollOutAt, setRollOutAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [meetLocation, setMeetLocation] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationM, setElevationM] = useState('');
  const [paceMin, setPaceMin] = useState('');
  const [paceMax, setPaceMax] = useState('');
  const [dropPolicy, setDropPolicy] = useState('no_drop');
  const [surfaceAsphalt, setSurfaceAsphalt] = useState('');
  const [surfaceGravel, setSurfaceGravel] = useState('');
  const [surfaceDirt, setSurfaceDirt] = useState('');
  const [requiredGear, setRequiredGear] = useState<Set<string>>(new Set(['helmet']));
  const [hasSag, setHasSag] = useState(false);
  const [hasMech, setHasMech] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [allowGuests, setAllowGuests] = useState(false);
  const [maxGuests, setMaxGuests] = useState('0');
  const [cancellationHours, setCancellationHours] = useState('24');
  const [feeAmount, setFeeAmount] = useState('0');
  const [visibility, setVisibility] = useState('public');
  const [statusToSave, setStatusToSave] = useState<'draft' | 'published'>('draft');
  const [submitting, setSubmitting] = useState(false);

  // Edit-mode state
  const [loaded, setLoaded] = useState(!isEdit);
  const [currentStatus, setCurrentStatus] = useState<string>('draft');
  const [original, setOriginal] = useState<Record<string, unknown> | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Load existing event for edit mode
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    (async () => {
      type EventSelectFn = () => { eq: (col: string, val: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
      const selectFn = (supabase.from('events').select as unknown) as (cols: string) => ReturnType<EventSelectFn>;
      const { data, error } = await selectFn('*').eq('id', eventId).single();
      if (!active) return;
      if (error || !data) {
        toast.error('Эвент олдсонгүй');
        return;
      }
      const e = data as Record<string, unknown>;
      setTitle((e.title as string) ?? '');
      setDescription((e.description as string) ?? '');
      setCoverPhotoPath((e.cover_photo_path as string) ?? '');
      setDiscipline((e.discipline as string) ?? 'road');
      setSkillLevel((e.skill_level as string) ?? 'all');
      setMeetAt(isoToLocalInput(e.meet_at as string | null));
      setRollOutAt(isoToLocalInput(e.roll_out_at as string | null));
      setEndAt(isoToLocalInput(e.end_at as string | null));
      setMeetLocation((e.meet_location_name as string) ?? '');
      setDistanceKm(e.distance_km != null ? String(e.distance_km) : '');
      setElevationM(e.elevation_gain_m != null ? String(e.elevation_gain_m) : '');
      setPaceMin(e.pace_min_kmh != null ? String(e.pace_min_kmh) : '');
      setPaceMax(e.pace_max_kmh != null ? String(e.pace_max_kmh) : '');
      setDropPolicy((e.drop_policy as string) ?? 'no_drop');
      setSurfaceAsphalt(e.surface_asphalt_pct != null ? String(e.surface_asphalt_pct) : '');
      setSurfaceGravel(e.surface_gravel_pct != null ? String(e.surface_gravel_pct) : '');
      setSurfaceDirt(e.surface_dirt_pct != null ? String(e.surface_dirt_pct) : '');
      setRequiredGear(new Set((e.required_gear as string[]) ?? []));
      setHasSag(!!e.has_sag);
      setHasMech(!!e.has_mechanical_support);
      setCapacity(e.capacity != null ? String(e.capacity) : '');
      setAllowGuests(!!e.allow_guests);
      setMaxGuests(e.max_guests_per_member != null ? String(e.max_guests_per_member) : '0');
      setCancellationHours(e.cancellation_deadline_hours != null ? String(e.cancellation_deadline_hours) : '24');
      setFeeAmount(e.fee_amount != null ? String(e.fee_amount) : '0');
      setVisibility((e.visibility as string) ?? 'public');
      setCurrentStatus((e.status as string) ?? 'draft');
      setOriginal(e);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [eventId]);

  const toggleGear = (g: string) => {
    const next = new Set(requiredGear);
    if (next.has(g)) next.delete(g); else next.add(g);
    setRequiredGear(next);
  };

  const buildPayload = (): Record<string, unknown> => ({
    title: title.trim(),
    description: description.trim(),
    cover_photo_path: coverPhotoPath || null,
    discipline,
    skill_level: skillLevel,
    meet_at: new Date(meetAt).toISOString(),
    roll_out_at: new Date(rollOutAt).toISOString(),
    end_at: endAt ? new Date(endAt).toISOString() : null,
    meet_location_name: meetLocation.trim(),
    distance_km: distanceKm ? Number(distanceKm) : null,
    elevation_gain_m: elevationM ? Number(elevationM) : null,
    pace_min_kmh: paceMin ? Number(paceMin) : null,
    pace_max_kmh: paceMax ? Number(paceMax) : null,
    drop_policy: dropPolicy,
    surface_asphalt_pct: surfaceAsphalt ? Number(surfaceAsphalt) : null,
    surface_gravel_pct: surfaceGravel ? Number(surfaceGravel) : null,
    surface_dirt_pct: surfaceDirt ? Number(surfaceDirt) : null,
    required_gear: Array.from(requiredGear),
    has_sag: hasSag,
    has_mechanical_support: hasMech,
    capacity: capacity ? Number(capacity) : null,
    allow_guests: allowGuests,
    max_guests_per_member: Number(maxGuests) || 0,
    cancellation_deadline_hours: Number(cancellationHours) || 24,
    fee_amount: Number(feeAmount) || 0,
    visibility,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !meetAt || !rollOutAt || !meetLocation.trim() || !user) {
      toast.error('Гарчиг, цаг, газар шаардлагатай');
      return;
    }
    setSubmitting(true);

    type EventInsert = Record<string, unknown>;
    const payload = buildPayload();

    if (isEdit && eventId) {
      // UPDATE branch
      const updateFn = (supabase.from('events').update as unknown) as (d: EventInsert) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
      const { error } = await updateFn(payload).eq('id', eventId);
      if (error) {
        toast.error(error.message ?? 'Хадгалахад алдаа гарлаа');
        setSubmitting(false);
        return;
      }

      // Diff & audit + notify
      const changedFields = original ? diffKeys(original, { ...original, ...payload }) : [];
      await logAudit('event.updated', eventId, { changed_fields: changedFields });

      if (shouldNotifyParticipants(changedFields)) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-event-changed`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ event_id: eventId, changed_fields: changedFields }),
            });
          }
        } catch (err) {
          console.error('[notify-event-changed]', err);
        }
      }

      toast.success('Шинэчиллээ');
      setSubmitting(false);
      onSaved();
      return;
    }

    // CREATE branch
    const insertPayload: EventInsert = {
      ...payload,
      status: statusToSave,
      organizer_id: user.id,
    };
    const insertFn = (supabase.from('events').insert as unknown) as (d: EventInsert) => { select: () => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } };
    const { data, error } = await insertFn(insertPayload).select().single();

    if (error) {
      toast.error(error.message ?? 'Алдаа гарлаа');
      setSubmitting(false);
      return;
    }

    toast.success(statusToSave === 'published' ? 'Нийтлэгдлээ' : 'Хадгалагдлаа');
    await logAudit('event.created', data?.id, { title: insertPayload.title, status: statusToSave });
    setSubmitting(false);
    onSaved();
  };

  const handleCancelEvent = async () => {
    if (!eventId) return;
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session байхгүй');
        setCancelling(false);
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-event`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_id: eventId, reason: cancelReason.trim() || null }),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(`Цуцлахад алдаа: ${txt}`);
        setCancelling(false);
        return;
      }
      await logAudit('event.cancelled', eventId, { reason: cancelReason.trim() || null });
      toast.success('Эвент цуцлагдлаа');
      setShowCancelModal(false);
      setCancelling(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
      setCancelling(false);
    }
  };

  const handleComplete = async () => {
    if (!eventId) return;
    if (!confirm('Энэ эвентийг "Дууссан" төлөвт оруулах уу?')) return;
    setCompleting(true);
    try {
      const rpcFn = (supabase.rpc as unknown) as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
      const { error } = await rpcFn('change_event_status', {
        p_event_id: eventId,
        p_new_status: 'completed',
      });
      if (error) {
        toast.error(error.message ?? 'Алдаа гарлаа');
        setCompleting(false);
        return;
      }
      await logAudit('event.completed', eventId);
      toast.success('Эвент дууссан төлөвт орлоо');
      setCompleting(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
      setCompleting(false);
    }
  };

  const isPast = isEdit && rollOutAt ? new Date(rollOutAt).getTime() < Date.now() : false;
  const canCancel = isEdit && currentStatus === 'published';
  const canComplete = isEdit && currentStatus === 'published' && isPast;

  if (isEdit && !loaded) {
    return (
      <div className="max-w-3xl flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Буцах
      </button>

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Арга хэмжээ засах' : 'Шинэ арга хэмжээ'}
          </h2>
          {isEdit && (
            <span className="ml-auto px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
              Төлөв: {currentStatus}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basics */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Үндсэн</legend>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Нэр *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Тайлбар</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Нүүр зураг</label>
              <ImageUpload bucket="event-assets" folder="covers" currentUrl={coverPhotoPath || null} onUpload={setCoverPhotoPath} size="lg" />
              <p className="text-xs text-gray-400 mt-1">PNG/JPG/WebP, хамгийн их 4MB.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Чиглэл *</label>
                <select value={discipline} onChange={(e) => setDiscipline(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                  {DISCIPLINES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Түвшин *</label>
                <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                  {SKILL_LEVELS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Schedule */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Хуваарь</legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Уулзах *</label>
                <input type="datetime-local" value={meetAt} onChange={(e) => setMeetAt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Хөдлөх *</label>
                <input type="datetime-local" value={rollOutAt} onChange={(e) => setRollOutAt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Дуусах</label>
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Уулзах газар *</label>
              <input type="text" value={meetLocation} onChange={(e) => setMeetLocation(e.target.value)}
                placeholder="Зайсан толгой"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
          </fieldset>

          {/* Ride character */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900 mb-2"><Bike className="w-4 h-4 inline mr-1" /> Унааны шинж</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Зай (км)</label>
                <input type="number" step="0.1" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Өндөршил (м)</label>
                <input type="number" value={elevationM} onChange={(e) => setElevationM(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Хурд min (км/ц)</label>
                <input type="number" step="0.1" value={paceMin} onChange={(e) => setPaceMin(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Хурд max (км/ц)</label>
                <input type="number" step="0.1" value={paceMax} onChange={(e) => setPaceMax(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Группын бодлого</label>
              <select value={dropPolicy} onChange={(e) => setDropPolicy(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm">
                {DROP_POLICIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Асфальт %</label>
                <input type="number" min={0} max={100} value={surfaceAsphalt} onChange={(e) => setSurfaceAsphalt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Хайрга %</label>
                <input type="number" min={0} max={100} value={surfaceGravel} onChange={(e) => setSurfaceGravel(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Шороо %</label>
                <input type="number" min={0} max={100} value={surfaceDirt} onChange={(e) => setSurfaceDirt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
          </fieldset>

          {/* Gear & support */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Хэрэгсэл & дэмжлэг</legend>
            <div className="grid grid-cols-2 gap-2">
              {GEAR_OPTIONS.map((g) => (
                <label key={g.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={requiredGear.has(g.value)} onChange={() => toggleGear(g.value)}
                    className="w-4 h-4 text-primary-600 rounded" />
                  {g.label}
                </label>
              ))}
            </div>
            <div className="flex gap-4 mt-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={hasSag} onChange={(e) => setHasSag(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                SAG машин
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={hasMech} onChange={(e) => setHasMech(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                Засварчин
              </label>
            </div>
          </fieldset>

          {/* Capacity */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Хүчин чадал & зочин</legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Хязгаар</label>
                <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Цуцлах хугацаа (ц)</label>
                <input type="number" min={1} value={cancellationHours} onChange={(e) => setCancellationHours(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Төлбөр (₮)</label>
                <input type="number" min={0} value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={allowGuests} onChange={(e) => setAllowGuests(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                Зочин зөвшөөрөх
              </label>
              {allowGuests && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Хамгийн их:</span>
                  <input type="number" min={0} value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)}
                    className="w-20 px-2 py-1.5 border border-gray-200 rounded text-sm" />
                </div>
              )}
            </div>
          </fieldset>

          {/* Visibility */}
          <fieldset>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Харагдац</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm">
              {VISIBILITIES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </fieldset>

          {/* Status actions (edit mode only) */}
          {isEdit && (canCancel || canComplete) && (
            <fieldset className="space-y-3 pt-4 border-t border-gray-100">
              <legend className="text-sm font-semibold text-gray-900 mb-2">Төлвийн үйлдэл</legend>
              <div className="flex gap-3">
                {canCancel && (
                  <button type="button" onClick={() => setShowCancelModal(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-red-200 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50">
                    <XCircle className="w-4 h-4" /> Цуцлах эвентийг
                  </button>
                )}
                {canComplete && (
                  <button type="button" onClick={handleComplete} disabled={completing}
                    className="flex items-center gap-2 px-4 py-2 border border-green-200 text-sm font-medium text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50">
                    {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Дуусгах
                  </button>
                )}
              </div>
            </fieldset>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Цуцлах</button>
            {isEdit ? (
              <button type="submit" disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Шинэчлэх
              </button>
            ) : (
              <>
                <button type="submit" onClick={() => setStatusToSave('draft')} disabled={submitting}
                  className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  Ноорог хадгалах
                </button>
                <button type="submit" onClick={() => setStatusToSave('published')} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Нийтлэх
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Эвент цуцлах</h3>
            <p className="text-sm text-gray-500 mb-4">
              Энэ эвент цуцлагдсаны дараа сэргээх боломжгүй. Бүх RSVP цуцлагдаж, оролцогч нарт мэдэгдэл очно.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Шалтгаан</label>
            <textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              placeholder="(заавал биш)"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none" />
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">
                Болих
              </button>
              <button type="button" onClick={handleCancelEvent} disabled={cancelling}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Цуцлах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
