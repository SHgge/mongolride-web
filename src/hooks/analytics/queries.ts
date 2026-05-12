// EP-07: TanStack Query hooks for analytics RPCs.
// Every hook is admin-or-organizer scoped on the SQL side; a 'forbidden'
// error from PostgREST is rethrown so React Query surfaces it to UI.

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface KpiSummary {
  total_events: number;
  total_rsvps: number;
  fill_rate_avg: number | null;
  attendance_rate_avg: number | null;
  on_time_rate_avg: number | null;
  active_members: number;
  prev_total_events: number;
  prev_total_rsvps: number;
  prev_fill_rate_avg: number | null;
  prev_attendance_rate_avg: number | null;
  prev_on_time_rate_avg: number | null;
  prev_active_members: number;
}

export interface EventListRow {
  event_id: string;
  title: string;
  meet_at: string;
  discipline: string;
  capacity: number | null;
  rsvps_total: number;
  attended_count: number;
  no_show_count: number;
  late_arrival_count: number;
  fill_rate: number | null;
  attendance_rate: number | null;
  on_time_rate: number | null;
  weather_aqi: number | null;
  weather_temp_c: number | null;
}

export interface GrowthRow {
  week_start: string;
  new_members: number;
  active_members: number;
}

export interface CohortRow {
  cohort_month: string;
  months_since: number;
  retention_pct: number;
  cohort_size: number;
  /** Optional — backend mat view exposes it, RPC currently doesn't surface it */
  active_users?: number;
}

export interface ScatterRow {
  event_id: string;
  x: number;
  y: number;
  label: string;
  meet_at: string;
}

export interface DowHeatmapRow {
  dow: number;
  hour: number;
  attendance_rate_avg: number;
  event_count: number;
}

export interface AtRiskRow {
  user_id: string;
  full_name: string;
  role: string;
  attended_90d: number;
  no_show_90d: number;
  cancelled_90d: number;
  last_event_at: string | null;
  reliability_label: string;
  reason: string;
}

export interface NotificationHealth {
  sent_today: number;
  sent_yesterday: number;
  failed_today: number;
  dead_open: number;
  bounced_emails: number;
}

interface RangeArgs {
  fromIso: string;
  toIso: string;
  discipline?: string | null;
  organizer?: string | null;
}

function rpcOne<T>(fn: string, args: Record<string, unknown>) {
  return async (): Promise<T | null> => {
    const { data, error } = await supabase.rpc(fn as never, args as never);
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return (row as T | null) ?? null;
  };
}

function rpcMany<T>(fn: string, args: Record<string, unknown>) {
  return async (): Promise<T[]> => {
    const { data, error } = await supabase.rpc(fn as never, args as never);
    if (error) throw new Error(error.message);
    return ((Array.isArray(data) ? data : []) as T[]);
  };
}

// ----------------- Hooks -----------------

export function useKpiSummary(args: RangeArgs, opts?: Partial<UseQueryOptions<KpiSummary | null>>) {
  return useQuery({
    queryKey: ['kpi_summary', args.fromIso, args.toIso],
    queryFn: rpcOne<KpiSummary>('kpi_summary', { p_from: args.fromIso, p_to: args.toIso }),
    ...opts,
  });
}

export function useEventList(args: RangeArgs, opts?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['event_analytics_list', args.fromIso, args.toIso, args.discipline ?? null, args.organizer ?? null, opts?.limit ?? 100, opts?.offset ?? 0],
    queryFn: rpcMany<EventListRow>('event_analytics_list', {
      p_from: args.fromIso,
      p_to: args.toIso,
      p_discipline: args.discipline ?? null,
      p_organizer: args.organizer ?? null,
      p_limit: opts?.limit ?? 100,
      p_offset: opts?.offset ?? 0,
    }),
  });
}

export function useMemberGrowth(args: RangeArgs) {
  return useQuery({
    queryKey: ['member_growth_series', args.fromIso, args.toIso],
    queryFn: rpcMany<GrowthRow>('member_growth_series', {
      p_from: args.fromIso, p_to: args.toIso,
    }),
  });
}

export function useCohortRetention(fromIso: string) {
  return useQuery({
    queryKey: ['cohort_retention_grid', fromIso],
    queryFn: rpcMany<CohortRow>('cohort_retention_grid', { p_from: fromIso }),
  });
}

export function useWeatherScatter(metric: 'aqi' | 'temp' | 'wind') {
  return useQuery({
    queryKey: ['weather_impact_scatter', metric],
    queryFn: rpcMany<ScatterRow>('weather_impact_scatter', { p_metric: metric }),
  });
}

export function useDowHeatmap(fromIso: string) {
  return useQuery({
    queryKey: ['day_of_week_heatmap', fromIso],
    queryFn: rpcMany<DowHeatmapRow>('day_of_week_heatmap', { p_from: fromIso }),
  });
}

export function useAtRisk(limit = 50) {
  return useQuery({
    queryKey: ['at_risk_members', limit],
    queryFn: rpcMany<AtRiskRow>('at_risk_members', { p_limit: limit }),
  });
}

export function useNotificationHealth() {
  return useQuery({
    queryKey: ['notification_health'],
    queryFn: rpcOne<NotificationHealth>('notification_health', {}),
  });
}

export async function logDrilldown(viewKey: string, targetId: string | null, filters: Record<string, unknown>) {
  await supabase.rpc('log_analytics_drilldown' as never, {
    p_view_key: viewKey,
    p_target_id: targetId,
    p_filters: filters,
  } as never);
}
