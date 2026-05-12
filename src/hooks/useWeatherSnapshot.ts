import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  WeatherSnapshot,
  WeatherRisk,
  WeatherRiskComponents,
  WeatherRiskLevel,
} from '../types/database.types';

interface Args {
  lat: number | null | undefined;
  lng: number | null | undefined;
  atIso: string | null | undefined;
  /** When false (e.g. coords not set), skip fetching and stay idle. */
  enabled?: boolean;
}

interface State {
  snapshot: WeatherSnapshot | null;
  risk: WeatherRisk | null;
  loading: boolean;
  error: string | null;
  lastRefreshAt: number | null;
}

const REFRESH_COOLDOWN_MS = 5 * 60_000;

export function useWeatherSnapshot({ lat, lng, atIso, enabled = true }: Args) {
  const [state, setState] = useState<State>({
    snapshot: null, risk: null, loading: false, error: null, lastRefreshAt: null,
  });
  const reqId = useRef(0);

  const fetchOnce = useCallback(async () => {
    if (!enabled || lat == null || lng == null || !atIso) return;
    const myId = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // Public endpoint (verify_jwt=false). Use the user's session token if
      // signed in, otherwise fall back to the anon key so the request still
      // includes a Supabase API key header.
      const { data: { session } } = await supabase.auth.getSession();
      const bearer = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-weather-snapshot`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${bearer}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ lat, lng, at: atIso }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Weather fetch failed (${res.status}): ${text.slice(0, 120)}`);
      }
      const snap = (await res.json()) as WeatherSnapshot;

      // Classify risk via SQL RPC (single source of truth)
      const { data: classified, error: cErr } = await supabase.rpc(
        'classify_weather_risk' as never,
        {
          p_temp_c: snap.temp_c,
          p_feels_like_c: snap.feels_like_c,
          p_wind_ms: snap.wind_speed_ms,
          p_aqi: snap.aqi_us,
          p_pm10_ugm3: snap.pm10_ugm3,
          p_precip_mm: snap.precip_amount_mm,
          p_thunder_prob: snap.thunderstorm_prob_pct,
          p_uv: snap.uv_index,
        } as never,
      );
      if (cErr) console.error('[weather] classify failed:', cErr.message);

      const row = Array.isArray(classified)
        ? (classified[0] as { overall: WeatherRiskLevel; components: WeatherRiskComponents } | undefined)
        : (classified as { overall: WeatherRiskLevel; components: WeatherRiskComponents } | null);

      const risk: WeatherRisk = row
        ? { overall: row.overall, components: row.components }
        : { overall: 'green', components: {} };

      if (reqId.current !== myId) return;
      setState({
        snapshot: snap,
        risk,
        loading: false,
        error: null,
        lastRefreshAt: Date.now(),
      });
    } catch (err) {
      if (reqId.current !== myId) return;
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [lat, lng, atIso, enabled]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  const refresh = useCallback(() => {
    if (state.lastRefreshAt && Date.now() - state.lastRefreshAt < REFRESH_COOLDOWN_MS) {
      return false; // rate-limited
    }
    fetchOnce();
    return true;
  }, [fetchOnce, state.lastRefreshAt]);

  const cooldownRemainingMs = state.lastRefreshAt
    ? Math.max(0, REFRESH_COOLDOWN_MS - (Date.now() - state.lastRefreshAt))
    : 0;

  return { ...state, refresh, cooldownRemainingMs };
}
