import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, Star, MapPin, Mountain, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Tables, RouteDifficultyLabel } from '../../types/database.types';

type Route = Tables<'routes'>;

interface EventRoute {
  id: string;
  route_id: string;
  is_primary: boolean;
  display_order: number;
  label: string | null;
  // Joined route fields:
  title: string;
  distance_km: number;
  elevation_gain_m: number;
  difficulty_label: RouteDifficultyLabel | null;
}

interface EventRoutesEditorProps {
  /** When falsy (creating a new event), the editor renders a placeholder. */
  eventId?: string;
}

const DIFFICULTY_BG: Record<RouteDifficultyLabel, string> = {
  easy:     'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  hard:     'bg-orange-100 text-orange-700',
  expert:   'bg-red-100 text-red-700',
};

export default function EventRoutesEditor({ eventId }: EventRoutesEditorProps) {
  const [linked, setLinked] = useState<EventRoute[]>([]);
  const [available, setAvailable] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [pickRouteId, setPickRouteId] = useState('');
  const [pickLabel, setPickLabel] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!eventId) { setLoading(false); return; }
    setLoading(true);
    const { data: rows } = await supabase
      .from('event_routes')
      .select('id, route_id, is_primary, display_order, label, routes(title, distance_km, elevation_gain_m, difficulty_label)')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true });

    type Row = {
      id: string; route_id: string; is_primary: boolean; display_order: number; label: string | null;
      routes: { title: string; distance_km: number; elevation_gain_m: number; difficulty_label: RouteDifficultyLabel | null } | null;
    };
    const linked: EventRoute[] = ((rows ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      route_id: r.route_id,
      is_primary: r.is_primary,
      display_order: r.display_order,
      label: r.label,
      title: r.routes?.title ?? '—',
      distance_km: Number(r.routes?.distance_km ?? 0),
      elevation_gain_m: r.routes?.elevation_gain_m ?? 0,
      difficulty_label: r.routes?.difficulty_label ?? null,
    }));
    setLinked(linked);
    setLoading(false);
  };

  // Initial load + load all published routes for the picker
  useEffect(() => {
    reload();
    supabase.from('routes').select('*').eq('status', 'published')
      .order('title')
      .then(({ data }) => setAvailable((data ?? []) as Route[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (!eventId) {
    return (
      <p className="text-xs text-gray-400">
        Эвентийг эхлээд хадгалсны дараа маршрут хавсаргах боломжтой болно.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Уншиж байна...
      </div>
    );
  }

  const linkedRouteIds = new Set(linked.map((l) => l.route_id));
  const filtered = available.filter((r) =>
    !linkedRouteIds.has(r.id) &&
    (!search.trim() || r.title.toLowerCase().includes(search.toLowerCase())),
  );

  const addRoute = async () => {
    if (!pickRouteId) { toast.error('Маршрут сонгоно уу'); return; }
    setBusy(true);
    const isFirst = linked.length === 0;
    const { error } = await supabase.from('event_routes').insert({
      event_id: eventId,
      route_id: pickRouteId,
      label: pickLabel.trim() || null,
      is_primary: isFirst,
      display_order: linked.length,
    });
    if (error) {
      toast.error(`Нэмэхэд алдаа: ${error.message}`);
    } else {
      toast.success('Маршрут хавсаргалаа');
      setPicking(false);
      setPickRouteId('');
      setPickLabel('');
      setSearch('');
      await reload();
    }
    setBusy(false);
  };

  const removeRoute = async (id: string) => {
    if (!confirm('Энэ маршрутыг хасах уу?')) return;
    const { error } = await supabase.from('event_routes').delete().eq('id', id);
    if (error) {
      toast.error(`Хасах алдаа: ${error.message}`);
    } else {
      toast.success('Хасагдлаа');
      await reload();
    }
  };

  const setPrimary = async (id: string) => {
    setBusy(true);
    // Unset all primaries first, then set this one (one-primary partial unique idx enforces this)
    await supabase.from('event_routes').update({ is_primary: false }).eq('event_id', eventId);
    const { error } = await supabase.from('event_routes').update({ is_primary: true }).eq('id', id);
    if (error) toast.error(`Тохируулах алдаа: ${error.message}`);
    await reload();
    setBusy(false);
  };

  const move = async (id: string, dir: 'up' | 'down') => {
    const idx = linked.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= linked.length) return;

    const a = linked[idx];
    const b = linked[swapIdx];
    setBusy(true);
    await Promise.all([
      supabase.from('event_routes').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('event_routes').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    await reload();
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {linked.length === 0 ? (
        <p className="text-xs text-gray-400">
          Маршрут хавсаргаагүй. Хавсаргавал оролцогчид RSVP хийхдээ маршрут сонгох боломжтой болно.
        </p>
      ) : (
        <div className="space-y-2">
          {linked.map((l, i) => (
            <div key={l.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(l.id, 'up')}
                  disabled={i === 0 || busy}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => move(l.id, 'down')}
                  disabled={i === linked.length - 1 || busy}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`/routes/${l.route_id}`} target="_blank" rel="noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate">
                    {l.title}
                  </a>
                  {l.is_primary && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold rounded">
                      <Star className="w-3 h-3 fill-current" /> Үндсэн
                    </span>
                  )}
                  {l.label && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded">
                      {l.label}
                    </span>
                  )}
                  {l.difficulty_label && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${DIFFICULTY_BG[l.difficulty_label]}`}>
                      {l.difficulty_label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {l.distance_km.toFixed(1)} км</span>
                  <span className="flex items-center gap-1"><Mountain className="w-3 h-3" /> {l.elevation_gain_m} м</span>
                </div>
              </div>

              {!l.is_primary && (
                <button type="button" onClick={() => setPrimary(l.id)} disabled={busy}
                  className="text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50">
                  Үндсэн
                </button>
              )}
              <button type="button" onClick={() => removeRoute(l.id)} disabled={busy}
                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!picking ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Маршрут нэмэх
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Маршрут хайх..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                {available.length === 0 ? 'Нийтлэгдсэн маршрут байхгүй' : 'Олдсонгүй'}
              </p>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPickRouteId(r.id)}
                  className={`w-full text-left p-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                    pickRouteId === r.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{r.title}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                    <span>{Number(r.distance_km).toFixed(1)} км</span>
                    <span>{r.elevation_gain_m} м</span>
                    {r.difficulty_label && <span>{r.difficulty_label}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
          <input
            type="text"
            value={pickLabel}
            onChange={(e) => setPickLabel(e.target.value)}
            placeholder="Шошго (заавал биш) — жишээ: 'Урт' эсвэл 'Богино'"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setPicking(false); setPickRouteId(''); setPickLabel(''); setSearch(''); }}
              className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Хаах
            </button>
            <button
              type="button"
              onClick={addRoute}
              disabled={!pickRouteId || busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Нэмэх
            </button>
          </div>
        </div>
      )}

      {linked.length === 1 && (
        <p className="text-[11px] text-gray-400">
          Зөвхөн нэг маршрут хавсаргасан үед оролцогчид сонгох шаардлагагүй.
        </p>
      )}
    </div>
  );
}
