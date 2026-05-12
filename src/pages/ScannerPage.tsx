// EP-09 P1-2: Admin scanner page — /admin/events/:eventId/scanner
// Authorised: admin OR event organizer / co-organizer / sweep_rider.
// Authorisation re-checked server-side by the check_in_rsvp RPC.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Camera, CameraOff, Wifi, WifiOff, Search,
  CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { logAudit } from '../lib/audit';
import {
  enqueueOfflineScan,
  drainOfflineQueue,
  getOfflineScanCount,
  isOnline as detectOnline,
} from '../lib/offlineScans';
import type { Tables } from '../types/database.types';

type Event = Tables<'events'>;

interface ScanRow {
  ts: number;
  status: string;
  rsvp_id: string | null;
  user_name: string | null;
  late: boolean | null;
  message: string | null;
  method: 'qr' | 'manual';
}

interface RpcRow {
  rsvp_id: string | null;
  user_id: string | null;
  user_name: string | null;
  status: string;
  checked_in_at: string | null;
  late: boolean | null;
  message: string | null;
}

function playChime(success: boolean) {
  // Tiny WebAudio bleep — works without an asset
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = success ? 880 : 220;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 250);
  } catch { /* silent on browsers without WebAudio */ }
}

function vibrate(ms = 30) {
  try { (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(ms); } catch { /* ignore */ }
}

export default function ScannerPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, profile } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authorised, setAuthorised] = useState(false);

  const [counters, setCounters] = useState({ checked: 0, confirmed: 0 });
  const [recent, setRecent] = useState<ScanRow[]>([]);
  const [override, setOverride] = useState(false);
  const [online, setOnline] = useState<boolean>(detectOnline());
  const [queuedCount, setQueuedCount] = useState(0);
  const [flash, setFlash] = useState<{ kind: 'success' | 'amber' | 'error'; text: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ token: string; ts: number } | null>(null);

  // ----------------------------------------------------------
  // Authorisation
  // ----------------------------------------------------------
  useEffect(() => {
    if (!eventId || !user) return;
    let active = true;
    (async () => {
      const { data: ev, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      if (!active) return;
      if (error || !ev) {
        setAuthChecked(true);
        return;
      }
      const e = ev as Event;
      setEvent(e);
      const isAdmin = profile?.role === 'admin';
      const isOrg = e.organizer_id === user.id;
      const isCo = (e.co_organizer_ids ?? []).includes(user.id);
      const isSweep = e.sweep_rider_id === user.id;
      setAuthorised(isAdmin || isOrg || isCo || isSweep);
      setAuthChecked(true);
    })();
    return () => { active = false; };
  }, [eventId, user, profile]);

  // ----------------------------------------------------------
  // Realtime counter
  // ----------------------------------------------------------
  const refreshCounters = useCallback(async () => {
    if (!eventId) return;
    const [{ count: confirmed }, { count: checked }] = await Promise.all([
      supabase.from('event_rsvps').select('*', { count: 'exact', head: true })
        .eq('event_id', eventId).in('status', ['confirmed', 'attended']),
      supabase.from('event_rsvps').select('*', { count: 'exact', head: true })
        .eq('event_id', eventId).not('checked_in_at', 'is', null),
    ]);
    setCounters({ checked: checked ?? 0, confirmed: confirmed ?? 0 });
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !authorised) return;
    refreshCounters();
    const ch = supabase
      .channel(`scanner:${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_rsvps',
        filter: `event_id=eq.${eventId}`,
      }, () => refreshCounters())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, authorised, refreshCounters]);

  // ----------------------------------------------------------
  // Offline detection + queue counter
  // ----------------------------------------------------------
  useEffect(() => {
    const refreshQueued = async () => {
      if (eventId) setQueuedCount(await getOfflineScanCount(eventId));
    };
    refreshQueued();

    const onOnline = async () => {
      setOnline(true);
      if (!eventId) return;
      const result = await drainOfflineQueue(supabase as unknown as Parameters<typeof drainOfflineQueue>[0], logAudit);
      if (result.synced > 0 || result.dropped_idempotent > 0) {
        toast.success(`${result.synced + result.dropped_idempotent} scan синк хийгдлээ`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} scan амжилтгүй — холбогдсоны дараа шалгана уу`);
      }
      await refreshQueued();
      await refreshCounters();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [eventId, refreshCounters]);

  // ----------------------------------------------------------
  // Camera lifecycle + wakelock
  // ----------------------------------------------------------
  useEffect(() => {
    if (!authorised) return;
    let wake: { release?: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (k: string) => Promise<{ release?: () => Promise<void> }> };
    };
    nav.wakeLock?.request('screen').then((s) => { wake = s; }).catch(() => {});

    let cancelled = false;
    (async () => {
      try {
        const html5 = new Html5Qrcode('qr-reader');
        scannerRef.current = html5;
        await html5.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          async (decoded) => {
            if (cancelled) return;
            await handleScan(decoded);
          },
          () => { /* ignore decode misses */ },
        );
        if (!cancelled) setScanning(true);
      } catch (e) {
        setCameraError((e as Error).message ?? 'Камера руу хандах боломжгүй');
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch(() => {}).finally(() => {
        scannerRef.current?.clear?.();
      });
      wake?.release?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorised]);

  // ----------------------------------------------------------
  // Scan handler (QR + manual share the same RPC + recording path)
  // ----------------------------------------------------------
  const recordScan = useCallback((row: RpcRow, method: 'qr' | 'manual') => {
    setRecent((p) => [{
      ts: Date.now(),
      status: row.status,
      rsvp_id: row.rsvp_id,
      user_name: row.user_name,
      late: row.late,
      message: row.message,
      method,
    }, ...p].slice(0, 5));
  }, []);

  const handleScan = useCallback(async (decoded: string) => {
    if (!eventId) return;
    const m = decoded.match(/check-in\/([0-9a-f-]{36})/i);
    if (!m) {
      setFlash({ kind: 'error', text: 'QR формат буруу' });
      playChime(false); vibrate(60);
      return;
    }
    const token = m[1];

    // Debounce duplicate frames (camera fires the same QR many times/sec)
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.token === token && now - lastScanRef.current.ts < 2000) {
      return;
    }
    lastScanRef.current = { token, ts: now };

    // GPS (best-effort, 2s timeout)
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2000 }));
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* ignore */ }

    if (!detectOnline()) {
      await enqueueOfflineScan({
        token, eventId, lat, lng, override, method: 'qr', ts: now,
      });
      setQueuedCount(await getOfflineScanCount(eventId));
      setFlash({ kind: 'amber', text: 'Offline — scan дараалалд орлоо' });
      vibrate(20);
      return;
    }

    const { data, error } = await supabase.rpc('check_in_rsvp' as never, {
      p_token: token,
      p_event_id: eventId,
      p_method: 'qr',
      p_override: override,
      p_lat: lat,
      p_lng: lng,
    } as never);

    if (error) {
      setFlash({ kind: 'error', text: error.message });
      playChime(false); vibrate(60);
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
    if (!row) return;

    recordScan(row, 'qr');

    if (row.status === 'checked_in') {
      setFlash({ kind: 'success', text: `${row.user_name ?? 'Гишүүн'}${row.late ? ' (хоцорсон)' : ''}` });
      playChime(true); vibrate(30);
      if (row.rsvp_id) {
        await logAudit('rsvp.checked_in', row.rsvp_id, {
          method: 'qr', late: row.late ?? false, override,
        });
      }
    } else if (row.status === 'already_checked_in') {
      setFlash({ kind: 'amber', text: `${row.user_name ?? 'Гишүүн'} — өмнө check-in хийгдсэн` });
      playChime(false); vibrate(15);
    } else if (row.status === 'outside_window') {
      setFlash({ kind: 'error', text: 'Цаг хугацааны хязгаараас гадуур. Override асаагаад дахин уншуулна уу.' });
      playChime(false); vibrate(60);
    } else {
      setFlash({ kind: 'error', text: row.message ?? row.status });
      playChime(false); vibrate(60);
    }
  }, [eventId, override, recordScan]);

  // Auto-clear flash after 3.5s
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  // ----------------------------------------------------------
  // Render guards
  // ----------------------------------------------------------
  if (!user) return <Navigate to="/login" replace />;
  if (!authChecked) {
    return <div className="flex items-center justify-center min-h-[40vh] text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!authorised) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-gray-900">Та энэ эвентэд scan хийх эрхгүй</h1>
        <Link to="/admin/events" className="text-primary-600 text-sm mt-2 inline-block hover:underline">
          ← Эвентүүд рүү буцах
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <Link to={`/admin/events`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Эвентүүд
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <p className="text-xs text-gray-400">Scanner</p>
            <h1 className="text-lg font-semibold text-gray-900">{event?.title ?? '—'}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {event ? new Date(event.meet_at).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-700 leading-none">
                {counters.checked}<span className="text-gray-400 text-base">/{counters.confirmed}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Check-in</div>
            </div>
            <button
              onClick={refreshCounters}
              className="p-2 text-gray-400 hover:text-gray-600"
              title="Тоог шинэчлэх"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Online + override + queued bar */}
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-3 bg-gray-50/60 text-xs">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
            online ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {online ? 'Онлайн' : 'OFFLINE'}
          </span>
          {queuedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-800">
              {queuedCount} scan дараалалд
            </span>
          )}
          <label className="inline-flex items-center gap-1.5 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
              className="w-3.5 h-3.5 text-primary-600 rounded"
            />
            <span className="text-gray-700">Цаг хугацааны хязгаар override</span>
          </label>
        </div>

        {/* Camera */}
        <div className="relative">
          {cameraError ? (
            <div className="aspect-square sm:aspect-video bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
              <CameraOff className="w-10 h-10 mb-2 text-red-400" />
              <p className="text-sm">{cameraError}</p>
              <p className="text-xs opacity-60 mt-1">Камерийн зөвшөөрлөө шалгаад дахин ачаална уу.</p>
            </div>
          ) : (
            <>
              <div id="qr-reader" className="bg-gray-900 [&_video]:!w-full [&_video]:!h-auto [&_video]:!max-h-[480px] [&_video]:!object-cover" />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 bg-gray-900/80">
                  <Camera className="w-8 h-8 mb-2" />
                  <p className="text-sm">Камера эхлүүлж байна...</p>
                </div>
              )}
            </>
          )}

          {/* Flash overlay */}
          {flash && (
            <div className={`absolute inset-x-0 bottom-0 px-4 py-3 text-sm font-medium text-center ${
              flash.kind === 'success' ? 'bg-green-600 text-white'
              : flash.kind === 'amber' ? 'bg-amber-500 text-white'
              : 'bg-red-600 text-white'
            }`}>
              {flash.kind === 'success' && <CheckCircle2 className="w-4 h-4 inline mr-1.5" />}
              {flash.kind === 'amber' && <AlertTriangle className="w-4 h-4 inline mr-1.5" />}
              {flash.kind === 'error' && <XCircle className="w-4 h-4 inline mr-1.5" />}
              {flash.text}
            </div>
          )}
        </div>

        {/* Manual fallback */}
        {eventId && (
          <ManualSearch
            eventId={eventId}
            override={override}
            onResult={(row) => {
              recordScan(row, 'manual');
              if (row.status === 'checked_in') {
                setFlash({ kind: 'success', text: `${row.user_name} (manual)` });
                playChime(true); vibrate(30);
              } else if (row.status === 'already_checked_in') {
                setFlash({ kind: 'amber', text: `${row.user_name} — өмнө check-in` });
              } else {
                setFlash({ kind: 'error', text: row.message ?? row.status });
              }
            }}
          />
        )}

        {/* Recent list */}
        <div className="border-t border-gray-100 px-4 py-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Сүүлийн 5 scan</h2>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-400">Одоохондоо хоосон.</p>
          ) : (
            <ul className="space-y-1">
              {recent.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    r.status === 'checked_in' ? 'bg-green-500'
                    : r.status === 'already_checked_in' ? 'bg-amber-500'
                    : 'bg-red-500'
                  }`} />
                  <span className="text-gray-500">
                    {new Date(r.ts).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-gray-900 truncate flex-1">
                    {r.user_name ?? '—'} {r.late ? <span className="text-amber-600">(хоцорсон)</span> : null}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">{r.method}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Manual search fallback
// ============================================================

interface ManualMatch {
  rsvp_id: string;
  token: string;
  user_id: string;
  full_name: string;
  status: string;
  checked_in_at: string | null;
}

interface ManualSearchProps {
  eventId: string;
  override: boolean;
  onResult: (row: RpcRow) => void;
}

function ManualSearch({ eventId, override, onResult }: ManualSearchProps) {
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<ManualMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const search = useMemo(() => {
    let cancelled = false;
    return async (query: string) => {
      if (!query.trim()) { setMatches([]); return; }
      setLoading(true);
      try {
        // Find matching profiles, then look up their RSVP for this event.
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .ilike('full_name', `%${query.trim()}%`)
          .limit(10);
        const userIds = (profs ?? []).map((p) => p.id as string);
        if (userIds.length === 0) {
          if (!cancelled) setMatches([]);
          return;
        }
        const { data: rsvps } = await supabase
          .from('event_rsvps')
          .select('id, user_id, status, checked_in_at, check_in_token')
          .eq('event_id', eventId)
          .in('user_id', userIds);
        if (!cancelled) {
          const profileMap = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string) ?? '']));
          setMatches((rsvps ?? []).map((r) => ({
            rsvp_id: r.id as string,
            token: r.check_in_token as string,
            user_id: r.user_id as string,
            full_name: profileMap.get(r.user_id as string) ?? '',
            status: r.status as string,
            checked_in_at: r.checked_in_at as string | null,
          })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      return () => { cancelled = true; };
    };
  }, [eventId]);

  useEffect(() => {
    const t = setTimeout(() => search(q), 250);
    return () => clearTimeout(t);
  }, [q, search]);

  const markCheckedIn = async (m: ManualMatch) => {
    setSubmittingId(m.rsvp_id);
    const { data, error } = await supabase.rpc('check_in_rsvp' as never, {
      p_token: m.token,
      p_event_id: eventId,
      p_method: 'manual',
      p_override: override,
      p_lat: null,
      p_lng: null,
    } as never);
    setSubmittingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
    if (!row) return;
    if (row.status === 'checked_in' && row.rsvp_id) {
      await logAudit('rsvp.checked_in', row.rsvp_id, {
        method: 'manual', late: row.late ?? false, override,
      });
    }
    onResult(row);
    // Refresh local list status
    setMatches((prev) => prev.map((x) => x.rsvp_id === m.rsvp_id
      ? { ...x, status: 'attended', checked_in_at: row.checked_in_at }
      : x));
  };

  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Manual fallback</h2>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Гишүүний нэрээр хайх..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>
      {loading && <p className="text-[11px] text-gray-400 mt-1">Хайж байна...</p>}
      {matches.length > 0 && (
        <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {matches.map((m) => (
            <li key={m.rsvp_id} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-50 rounded-md text-xs">
              <div className="min-w-0 flex-1">
                <div className="text-gray-900 font-medium truncate">{m.full_name}</div>
                <div className="text-gray-400">
                  {m.status}{m.checked_in_at ? ` · ${new Date(m.checked_in_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </div>
              </div>
              {m.checked_in_at ? (
                <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded">checked in</span>
              ) : (
                <button
                  onClick={() => markCheckedIn(m)}
                  disabled={submittingId === m.rsvp_id || m.status === 'cancelled' || m.status === 'pending_payment'}
                  className="px-2 py-1 bg-primary-600 text-white text-[10px] font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingId === m.rsvp_id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Check in'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {q && !loading && matches.length === 0 && (
        <p className="text-[11px] text-gray-400 mt-1">Олдсонгүй.</p>
      )}
    </div>
  );
}
