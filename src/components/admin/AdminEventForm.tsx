import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Calendar, Bike } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ImageUpload } from '../common';
import { logAudit } from '../../lib/audit';

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
  { value: 'invitation', label: 'Зөвхөн уригдсан' },
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
  onCancel: () => void;
  onSaved: () => void;
}

export default function AdminEventForm({ onCancel, onSaved }: AdminEventFormProps) {
  const { user } = useAuth();
  useNavigate();

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

  const toggleGear = (g: string) => {
    const next = new Set(requiredGear);
    if (next.has(g)) next.delete(g); else next.add(g);
    setRequiredGear(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !meetAt || !rollOutAt || !meetLocation.trim() || !user) {
      toast.error('Гарчиг, цаг, газар шаардлагатай');
      return;
    }
    setSubmitting(true);

    type EventInsert = Record<string, unknown>;
    const data: EventInsert = {
      title: title.trim(),
      description: description.trim(),
      cover_photo_path: coverPhotoPath || null,
      discipline, skill_level: skillLevel,
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
      status: statusToSave,
      organizer_id: user.id,
    };

    const insertFn = (supabase.from('events').insert as unknown) as (d: EventInsert) => Promise<{ error: { message: string } | null }>;
    const { error } = await insertFn(data);

    if (error) {
      toast.error(error.message ?? 'Алдаа гарлаа');
      setSubmitting(false);
      return;
    }

    toast.success(statusToSave === 'published' ? 'Нийтлэгдлээ' : 'Хадгалагдлаа');
    await logAudit('event.created', undefined, { title: data.title, status: statusToSave });
    setSubmitting(false);
    onSaved();
  };

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
          <h2 className="text-xl font-bold text-gray-900">Шинэ арга хэмжээ</h2>
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
              <ImageUpload bucket="routes" folder="events" currentUrl={coverPhotoPath || null} onUpload={setCoverPhotoPath} size="lg" />
              <p className="text-xs text-gray-400 mt-1">Анхааруулга: одоогоор `routes` bucket ашиглаж байна (event-assets bucket нь policy-той)</p>
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

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Цуцлах</button>
            <button type="submit" onClick={() => setStatusToSave('draft')} disabled={submitting}
              className="flex-1 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              Ноорог хадгалах
            </button>
            <button type="submit" onClick={() => setStatusToSave('published')} disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Нийтлэх
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
