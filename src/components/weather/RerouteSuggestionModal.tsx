import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { X, Loader2, Wind, MapPin, Mountain, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';

interface RerouteCandidate {
  type: 'route';
  route_id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  difficulty_label: string | null;
  start_lat: number;
  start_lng: number;
  estimated_aqi: number | null;
  distance_km_from_meet: number;
}

interface TimeWindow {
  from: string;
  to: string;
  estimated_aqi: number;
}

interface RerouteResponse {
  ok: boolean;
  current_aqi: number | null;
  best_alt_dir: string | null;
  best_alt_aqi: number | null;
  delta: number | null;
  alternatives: RerouteCandidate[];
  alternative_time_windows: TimeWindow[];
}

interface Props {
  eventId: string;
  currentRouteId: string | null;
  onClose: () => void;
  onApplied: (newRouteId: string) => void;
}

export default function RerouteSuggestionModal({ eventId, currentRouteId, onClose, onApplied }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RerouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Session байхгүй');
        const r = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-route-reroute`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ event_id: eventId }),
          },
        );
        if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 120)}`);
        const json = (await r.json()) as RerouteResponse;
        if (active) setData(json);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [eventId]);

  const apply = async (cand: RerouteCandidate) => {
    setApplyingId(cand.route_id);
    const { error: updErr } = await supabase
      .from('events')
      .update({ route_id: cand.route_id })
      .eq('id', eventId);
    if (updErr) {
      toast.error(`Маршрут солих алдаа: ${updErr.message}`);
      setApplyingId(null);
      return;
    }
    await logAudit('event.rerouted', eventId, {
      original_route_id: currentRouteId,
      new_route_id: cand.route_id,
      reason: 'aqi',
      aqi_before: data?.current_aqi,
      aqi_after: cand.estimated_aqi,
    });
    // Notify confirmed RSVPs (best-effort via existing EP-03 function)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-event-changed`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ event_id: eventId, changed_fields: ['route_id'] }),
          },
        );
      }
    } catch (e) {
      console.error('[reroute] notify failed:', e);
    }
    toast.success(`Маршрут "${cand.name}" руу шилжлээ`);
    setApplyingId(null);
    onApplied(cand.route_id);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl my-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Маршрут солих санал</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              AQI өндөр учраас илүү цэвэр агаартай газрын саналыг харуулж байна.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Хайж байна...
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-4">
              <AlertTriangle className="w-4 h-4 inline mr-1" /> {error}
            </div>
          )}

          {data && !loading && (
            <>
              <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-gray-500">Одоогийн уулзах цэгийн AQI: </span>
                    <strong className="text-orange-600">{data.current_aqi ?? '—'}</strong>
                  </div>
                  {data.best_alt_aqi != null && data.delta != null && (
                    <div className="flex items-center gap-1.5 text-green-700">
                      <ArrowRight className="w-3.5 h-3.5" />
                      <Wind className="w-3.5 h-3.5" />
                      <span>{data.best_alt_dir} зүгт AQI <strong>{data.best_alt_aqi}</strong> ({data.delta}-аар бага)</span>
                    </div>
                  )}
                </div>
              </div>

              {data.alternatives.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">Санал болгож буй маршрутууд</h3>
                  {data.alternatives.map((cand) => (
                    <div
                      key={cand.route_id}
                      className="border border-gray-200 rounded-xl p-4 hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 mb-1">{cand.name}</h4>
                          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{cand.distance_km.toFixed(1)} км</span>
                            <span className="flex items-center gap-1"><Mountain className="w-3 h-3" />{cand.elevation_gain_m} м</span>
                            {cand.difficulty_label && <span className="capitalize">{cand.difficulty_label}</span>}
                            <span>· уулзах цэгээс {cand.distance_km_from_meet} км</span>
                          </div>
                          {cand.estimated_aqi != null && (
                            <div className="mt-1.5 text-xs text-green-700">
                              Тооцоолсон AQI: <strong>{cand.estimated_aqi}</strong>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => apply(cand)}
                          disabled={!!applyingId}
                          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                          {applyingId === cand.route_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : null}
                          Энэ маршрут руу шилжих
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : data.alternative_time_windows.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">
                    Илүү цэвэр маршрут олдсонгүй. Доорх цаг хугацаанд AQI бага байна:
                  </h3>
                  {data.alternative_time_windows.map((w, i) => (
                    <div key={i} className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm">
                      <Clock className="w-4 h-4 inline mr-1.5 text-green-600" />
                      <strong>{new Date(w.from).toLocaleString('mn-MN', { dateStyle: 'short', timeStyle: 'short' })}</strong>
                      {' → '}
                      <strong>{new Date(w.to).toLocaleString('mn-MN', { dateStyle: 'short', timeStyle: 'short' })}</strong>
                      <span className="text-green-700 ml-2">(AQI ≤ {w.estimated_aqi})</span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400">
                    Эвентийн цагийг өөрчлөхийн тулд "Засах" дэлгэцнээс уулзах цагийг шинэчилнэ үү.
                  </p>
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-8 text-center">
                  25 км дотор илүү цэвэр маршрут олдсонгүй. Эвент цуцлах эсвэл хойшлуулахаар хянагтун.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
