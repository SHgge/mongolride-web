import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Upload, MapPin, Mountain, Activity, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ImageUpload } from '../common';
import { logAudit } from '../../lib/audit';
import type { Tables, RouteDifficultyLabel, RouteDiscipline, RouteVisibility, RouteStatus, RouteSurfaceBreakdown, RouteClimb } from '../../types/database.types';

type Route = Tables<'routes'>;

const DISCIPLINES: Array<{ value: RouteDiscipline; label: string }> = [
  { value: 'road',        label: 'Зам' },
  { value: 'mtb',         label: 'Уулын' },
  { value: 'gravel',      label: 'Хайрга' },
  { value: 'urban',       label: 'Хотын' },
  { value: 'commute',     label: 'Ажилд' },
  { value: 'bikepacking', label: 'Аялал' },
  { value: 'training',    label: 'Сургалт' },
  { value: 'other',       label: 'Бусад' },
];

const VISIBILITIES: Array<{ value: RouteVisibility; label: string }> = [
  { value: 'public',  label: 'Нийтэд' },
  { value: 'members', label: 'Гишүүдэд' },
  { value: 'private', label: 'Зөвхөн админ' },
];

const DIFFICULTY_LABELS: Record<RouteDifficultyLabel, string> = {
  easy:     'Хялбар',
  moderate: 'Дунд',
  hard:     'Хэцүү',
  expert:   'Маш хэцүү',
};

interface AdminRouteFormProps {
  routeId?: string;
  onCancel: () => void;
  onSaved: () => void;
}

interface ParseGpxResult {
  ok: boolean;
  points_count: number;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_grade_pct: number;
  climbs_count: number;
  loop_type: 'loop' | 'out_and_back' | 'point_to_point';
}

interface ClassifyResult {
  ok: boolean;
  reason?: string;
  samples_total?: number;
  samples_classified?: number;
  breakdown?: RouteSurfaceBreakdown;
}

export default function AdminRouteForm({ routeId, onCancel, onSaved }: AdminRouteFormProps) {
  const { user } = useAuth();
  const isEdit = !!routeId;

  // Metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discipline, setDiscipline] = useState<RouteDiscipline>('road');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('Mongolia');
  const [visibility, setVisibility] = useState<RouteVisibility>('public');
  const [statusToSave, setStatusToSave] = useState<RouteStatus>('draft');
  const [coverPhotoPath, setCoverPhotoPath] = useState('');

  // GPX-derived (read-only after parse)
  const [gpxPath, setGpxPath] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [elevationGainM, setElevationGainM] = useState<number | null>(null);
  const [, setElevationLossM] = useState<number | null>(null);
  const [maxGradePct, setMaxGradePct] = useState<number | null>(null);
  const [climbs, setClimbs] = useState<RouteClimb[]>([]);
  const [loopType, setLoopType] = useState<string | null>(null);
  const [surfaceBreakdown, setSurfaceBreakdown] = useState<RouteSurfaceBreakdown>({});
  const [difficultyLabel, setDifficultyLabel] = useState<RouteDifficultyLabel | null>(null);
  const [difficultyScore, setDifficultyScore] = useState<number | null>(null);

  // UI state
  const [loaded, setLoaded] = useState(!isEdit);
  const [savingMeta, setSavingMeta] = useState(false);
  const [parsingGpx, setParsingGpx] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [currentRouteId, setCurrentRouteId] = useState<string | null>(routeId ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------------
  // Load existing route in edit mode
  // ----------------------------------------------------------
  useEffect(() => {
    if (!routeId) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('routes').select('*').eq('id', routeId).single();
      if (!active) return;
      if (error || !data) {
        toast.error('Маршрут олдсонгүй');
        return;
      }
      const r = data as Route;
      setTitle(r.title);
      setDescription(r.description);
      setDiscipline(r.discipline);
      setRegion(r.region ?? '');
      setCountry(r.country);
      setVisibility(r.visibility);
      setStatusToSave(r.status);
      setCoverPhotoPath(r.cover_photo_path ?? '');
      setGpxPath(r.gpx_path);
      setDistanceKm(Number(r.distance_km));
      setElevationGainM(r.elevation_gain_m);
      setElevationLossM(r.elevation_loss_m);
      setMaxGradePct(r.max_grade_pct != null ? Number(r.max_grade_pct) : null);
      setClimbs(r.climbs);
      setLoopType(r.loop_type);
      setSurfaceBreakdown(r.surface_breakdown);
      setDifficultyLabel(r.difficulty_label);
      setDifficultyScore(r.difficulty_score != null ? Number(r.difficulty_score) : null);
      setCurrentRouteId(r.id);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [routeId]);

  // ----------------------------------------------------------
  // Step 1: create-or-pick the route id we'll attach the GPX to
  //   - In edit mode we already have routeId
  //   - In create mode we insert a draft skeleton on first GPX upload
  //     so we get a stable id to use as the storage folder.
  // ----------------------------------------------------------
  const ensureRouteRow = async (): Promise<string | null> => {
    if (currentRouteId) return currentRouteId;
    if (!user) {
      toast.error('Нэвтэрсэн байх шаардлагатай');
      return null;
    }
    if (!title.trim()) {
      toast.error('Эхлээд гарчиг оруулна уу');
      return null;
    }

    // Insert minimal draft. PostGIS path is required NOT NULL — use a placeholder
    // 2-point line that will be replaced by parse-gpx.
    const placeholderPath = 'SRID=4326;LINESTRING(106.9177 47.9184,106.9178 47.9185)';
    const { data, error } = await supabase
      .from('routes')
      .insert({
        title: title.trim(),
        description: description.trim(),
        discipline,
        visibility,
        status: 'draft' as const,
        region: region.trim() || null,
        country: country.trim() || 'Mongolia',
        created_by: user.id,
        path: placeholderPath,
        distance_km: 0.01,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error(`Маршрут үүсгэхэд алдаа: ${error?.message ?? 'unknown'}`);
      return null;
    }
    setCurrentRouteId(data.id);
    await logAudit('route.created', data.id, { title: title.trim() });
    return data.id;
  };

  // ----------------------------------------------------------
  // GPX upload + parse
  // ----------------------------------------------------------
  const handleGpxFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      toast.error('Зөвхөн .gpx файл upload хийнэ');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('GPX файл 10MB-аас бага байх ёстой');
      return;
    }

    setParsingGpx(true);
    try {
      const rid = await ensureRouteRow();
      if (!rid) { setParsingGpx(false); return; }

      const targetPath = `${rid}/gpx/original.gpx`;
      const { error: upErr } = await supabase.storage
        .from('route-assets')
        .upload(targetPath, file, { upsert: true, contentType: 'application/gpx+xml' });
      if (upErr) {
        toast.error(`Upload алдаа: ${upErr.message}`);
        setParsingGpx(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session байхгүй');
        setParsingGpx(false);
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-gpx`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ route_id: rid, gpx_path: targetPath }),
      });

      if (!res.ok) {
        const text = await res.text();
        toast.error(`Parse алдаа: ${text.slice(0, 200)}`);
        setParsingGpx(false);
        return;
      }

      const result = await res.json() as ParseGpxResult;

      // Reload the route to get computed values + difficulty
      const { data: refreshed } = await supabase.from('routes').select('*').eq('id', rid).single();
      if (refreshed) {
        const r = refreshed as Route;
        setGpxPath(r.gpx_path);
        setDistanceKm(Number(r.distance_km));
        setElevationGainM(r.elevation_gain_m);
        setElevationLossM(r.elevation_loss_m);
        setMaxGradePct(r.max_grade_pct != null ? Number(r.max_grade_pct) : null);
        setClimbs(r.climbs);
        setLoopType(r.loop_type);
        setDifficultyLabel(r.difficulty_label);
        setDifficultyScore(r.difficulty_score != null ? Number(r.difficulty_score) : null);
      }

      toast.success(`GPX боловсруулагдлаа: ${result.distance_km}км / ${result.elevation_gain_m}м / ${result.climbs_count} авирах`);
      await logAudit('route.gpx_parsed', rid, {
        distance_km: result.distance_km,
        elevation_gain_m: result.elevation_gain_m,
        climbs_count: result.climbs_count,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setParsingGpx(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ----------------------------------------------------------
  // Surface classification
  // ----------------------------------------------------------
  const handleClassifySurface = async () => {
    if (!currentRouteId || !gpxPath) {
      toast.error('Эхлээд GPX оруулна уу');
      return;
    }
    setClassifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session байхгүй');
        setClassifying(false);
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/classify-route-surface`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ route_id: currentRouteId }),
      });
      const result = await res.json() as ClassifyResult;
      if (!result.ok) {
        toast.error(`Гадаргуу таних амжилтгүй: ${result.reason ?? 'тодорхойгүй'}`);
        setClassifying(false);
        return;
      }

      // Refresh from DB (difficulty re-computed too)
      const { data: refreshed } = await supabase.from('routes').select('surface_breakdown, difficulty_label, difficulty_score').eq('id', currentRouteId).single();
      if (refreshed) {
        const r = refreshed as Pick<Route, 'surface_breakdown' | 'difficulty_label' | 'difficulty_score'>;
        setSurfaceBreakdown(r.surface_breakdown);
        setDifficultyLabel(r.difficulty_label);
        setDifficultyScore(r.difficulty_score != null ? Number(r.difficulty_score) : null);
      }
      toast.success(`Гадаргуу: ${result.breakdown?.asphalt}% асфальт / ${result.breakdown?.gravel}% хайрга / ${result.breakdown?.dirt}% шороо`);
      await logAudit('route.surface_classified', currentRouteId, result.breakdown as Record<string, unknown> | undefined);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setClassifying(false);
    }
  };

  // ----------------------------------------------------------
  // Save metadata + status
  // ----------------------------------------------------------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) {
      toast.error('Гарчиг шаардлагатай');
      return;
    }
    setSavingMeta(true);

    if (statusToSave === 'published' && !gpxPath) {
      toast.error('Нийтлэхийн тулд GPX оруулсан байх ёстой');
      setSavingMeta(false);
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      discipline,
      region: region.trim() || null,
      country: country.trim() || 'Mongolia',
      visibility,
      status: statusToSave,
      cover_photo_path: coverPhotoPath || null,
    };

    if (currentRouteId) {
      const { error } = await supabase
        .from('routes')
        .update(payload)
        .eq('id', currentRouteId);
      if (error) {
        toast.error(`Хадгалахад алдаа: ${error.message}`);
        setSavingMeta(false);
        return;
      }
      await logAudit('route.updated', currentRouteId, { status: statusToSave });
      toast.success(statusToSave === 'published' ? 'Маршрут нийтлэгдлээ' : 'Хадгалагдлаа');
      setSavingMeta(false);
      onSaved();
      return;
    }

    // Create-mode without GPX yet — insert a draft skeleton so user can come back
    const rid = await ensureRouteRow();
    if (rid) {
      // ensureRouteRow inserts with status=draft; if user wanted draft, that's fine.
      // If they wanted published but no GPX, we already short-circuited above.
      toast.success('Ноорог хадгалагдлаа');
      setSavingMeta(false);
      onSaved();
    } else {
      setSavingMeta(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Маршрутууд
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {isEdit ? 'Маршрут засах' : 'Маршрут нэмэх'}
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        GPX файл оруулснаар зай, өндөршил, авирах сегмент, хэцүү байдал автоматаар тооцогдоно.
      </p>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic metadata */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Үндсэн мэдээлэл</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Гарчиг *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Тайлбар</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Төрөл</label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as RouteDiscipline)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                {DISCIPLINES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Бүс нутаг</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Жишээ: Улаанбаатар"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Нүүр зураг</label>
            <ImageUpload
              bucket="route-assets"
              folder={currentRouteId ? `${currentRouteId}/cover` : 'temp/cover'}
              currentUrl={coverPhotoPath || null}
              onUpload={(url) => setCoverPhotoPath(url)}
              size="lg"
            />
          </div>
        </section>

        {/* GPX upload + parse */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">GPX файл</h2>
            {gpxPath && (
              <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
                Боловсруулагдсан
              </span>
            )}
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml,application/xml,text/xml"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleGpxFile(f);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingGpx}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 hover:border-primary-300 hover:bg-primary-50/50 transition-colors disabled:opacity-50"
            >
              {parsingGpx ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Боловсруулж байна...</>
              ) : (
                <><Upload className="w-4 h-4" /> {gpxPath ? 'Шинэ GPX оруулах' : 'GPX оруулах'}</>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-2">
              {gpxPath
                ? 'GPX-ийг шинээр сольвол зай, өндөршил, хэцүү дахин тооцогдоно.'
                : 'Гарчиг бөглөсний дараа GPX upload хийнэ. .gpx, дээд тал нь 10MB.'}
            </p>
          </div>

          {/* Parsed metrics */}
          {gpxPath && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
              <Stat icon={MapPin}    label="Зай"        value={distanceKm != null ? `${distanceKm.toFixed(1)} км` : '—'} />
              <Stat icon={Mountain}  label="Өндөршил"   value={elevationGainM != null ? `${elevationGainM} м` : '—'} />
              <Stat icon={Activity}  label="Хамгийн их налуу" value={maxGradePct != null ? `${maxGradePct.toFixed(1)}%` : '—'} />
              <Stat icon={FileText}  label="Топологи"   value={loopType ? LOOP_LABEL[loopType] ?? loopType : '—'} />
            </div>
          )}

          {climbs.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Авирах сегментүүд ({climbs.length})</h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {climbs.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-50 px-3 py-1.5 rounded-md">
                    <span className="text-gray-600">
                      {c.start_km}–{c.end_km}км · {c.length_km}км
                    </span>
                    <span className="text-gray-900 font-medium">
                      {c.gain_m}м / {c.avg_grade}%
                    </span>
                    <span className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] font-bold">
                      {c.category === 'HC' ? 'HC' : `Cat ${c.category}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Surface classification */}
        {gpxPath && (
          <section className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Гадаргуу</h2>
              <button
                type="button"
                onClick={handleClassifySurface}
                disabled={classifying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg disabled:opacity-50"
              >
                {classifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {Object.keys(surfaceBreakdown).length > 0 ? 'Дахин таних' : 'OSM-аас таних'}
              </button>
            </div>
            {Object.keys(surfaceBreakdown).length === 0 ? (
              <p className="text-xs text-gray-400">
                "OSM-аас таних" товч даран маршрутын асфальт/хайрга/шороог тооцоолно.
              </p>
            ) : (
              <div className="space-y-2">
                <SurfaceBar label="Асфальт" pct={surfaceBreakdown.asphalt ?? 0} color="bg-gray-500" />
                <SurfaceBar label="Хайрга"  pct={surfaceBreakdown.gravel  ?? 0} color="bg-stone-500" />
                <SurfaceBar label="Шороо"   pct={surfaceBreakdown.dirt    ?? 0} color="bg-amber-600" />
              </div>
            )}
          </section>
        )}

        {/* Difficulty (computed) */}
        {difficultyLabel && (
          <section className="bg-primary-50/50 border border-primary-100 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Хэцүү байдал</h2>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-primary-700">{DIFFICULTY_LABELS[difficultyLabel]}</span>
              {difficultyScore != null && (
                <span className="text-sm text-gray-500">{difficultyScore.toFixed(1)} / 10</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Зай, өндөршил, налуу, гадаргуу гэсэн 4 үзүүлэлтээс автомат тооцоологдсон.
            </p>
          </section>
        )}

        {/* Visibility + status */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Нийтлэл</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Хэн харах вэ</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as RouteVisibility)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                {VISIBILITIES.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Төлөв</label>
              <select
                value={statusToSave}
                onChange={(e) => setStatusToSave(e.target.value as RouteStatus)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="draft">Ноорог</option>
                <option value="published">Нийтлэгдсэн</option>
                <option value="archived">Архив</option>
              </select>
            </div>
          </div>
          {!gpxPath && statusToSave === 'published' && (
            <p className="text-xs text-amber-600">
              Нийтлэхийн тулд GPX файл оруулсан байх шаардлагатай.
            </p>
          )}
        </section>

        {/* Action bar */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50"
          >
            Цуцлах
          </button>
          <button
            type="submit"
            disabled={savingMeta || (statusToSave === 'published' && !gpxPath)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {savingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {statusToSave === 'published' ? 'Нийтлэх' : 'Хадгалах'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
const LOOP_LABEL: Record<string, string> = {
  loop:            'Тойрог',
  out_and_back:    'Очоод буцах',
  point_to_point:  'А → B',
};

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function Stat({ icon: Icon, label, value }: StatProps) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

interface SurfaceBarProps {
  label: string;
  pct: number;
  color: string;
}

function SurfaceBar({ label, pct, color }: SurfaceBarProps) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
