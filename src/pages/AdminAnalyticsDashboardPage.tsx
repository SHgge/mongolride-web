// EP-07: /admin/dashboard — analytics dashboard for admins.
// KPI cards + period selector + tabs (Overview / Events / Members / Weather / At-risk / Notif).

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import KpiCard from '../components/admin/dashboard/KpiCard';
import PeriodSelector, { useCurrentPeriod } from '../components/admin/dashboard/PeriodSelector';
import EventTable from '../components/admin/dashboard/EventTable';
import {
  MemberGrowthChart, WeatherScatterChart, DayOfWeekHeatmap, CohortHeatmap, FunnelChart,
} from '../components/admin/dashboard/Charts';
import { AtRiskList, NotificationHealthCard } from '../components/admin/dashboard/SideCards';
import LivePanel from '../components/admin/dashboard/LivePanel';
import { useKpiSummary, useEventList } from '../hooks/analytics/queries';
import { useSearchParams } from 'react-router-dom';

type Tab = 'overview' | 'events' | 'members' | 'weather' | 'risk' | 'notif';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Тойм' },
  { key: 'events',   label: 'Эвентүүд' },
  { key: 'members',  label: 'Гишүүд' },
  { key: 'weather',  label: 'Цаг агаар' },
  { key: 'risk',     label: 'Эрсдэлтэй' },
  { key: 'notif',    label: 'Notification' },
];

const DISCIPLINES = [
  { value: '',          label: 'Бүх чиглэл' },
  { value: 'road',      label: 'Зам' },
  { value: 'mtb',       label: 'Уулын' },
  { value: 'gravel',    label: 'Хайрга' },
  { value: 'urban',     label: 'Хотын' },
  { value: 'commute',   label: 'Ажилд' },
  { value: 'bikepacking', label: 'Аялал' },
  { value: 'training',  label: 'Сургалт' },
  { value: 'other',     label: 'Бусад' },
];

function fmtPct(v: number | null): string {
  return v != null ? `${(v * 100).toFixed(1)}%` : '—';
}

export default function AdminAnalyticsDashboardPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params); next.set('tab', t); setParams(next, { replace: true });
  };

  const discipline = params.get('discipline') ?? '';
  const setDiscipline = (d: string) => {
    const next = new URLSearchParams(params);
    if (d) next.set('discipline', d); else next.delete('discipline');
    setParams(next, { replace: true });
  };

  const period = useCurrentPeriod();

  // KPI
  const { data: kpi, isLoading: kpiLoading, error: kpiError } = useKpiSummary({
    fromIso: period.fromIso, toIso: period.toIso,
  });

  // Event list (used in Events tab + Funnel totals)
  const { data: events, isLoading: eventsLoading } = useEventList({
    fromIso: period.fromIso,
    toIso: period.toIso,
    discipline: discipline || null,
  });

  const funnelTotals = useMemo(() => {
    const t = { rsvps: 0, confirmed: 0, attended: 0, onTime: 0 };
    for (const e of events ?? []) {
      t.rsvps     += e.rsvps_total ?? 0;
      t.confirmed += (e.attended_count ?? 0) + (e.no_show_count ?? 0); // confirmed-and-locked-in
      t.attended  += e.attended_count ?? 0;
      t.onTime    += (e.attended_count ?? 0) - (e.late_arrival_count ?? 0);
    }
    return t;
  }, [events]);

  const exportFilters = useMemo(() => ({
    from: period.fromIso, to: period.toIso, discipline: discipline || null,
  }), [period.fromIso, period.toIso, discipline]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Гишүүний оролцоо, ирц, цаг агаарын нөлөөг хянах.
        </p>
      </div>

      <LivePanel />

      <div className="my-4 flex flex-wrap items-center gap-3 justify-between">
        <PeriodSelector />
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-md text-xs"
        >
          {DISCIPLINES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>

      {/* KPI cards */}
      {kpiError ? (
        <div className="bg-red-50 border border-red-100 text-red-800 text-sm rounded-lg px-4 py-3 mb-4">
          {(kpiError as Error).message}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard
            label="Эвент"
            value={kpi?.total_events?.toLocaleString('mn-MN') ?? '—'}
            rawValue={kpi?.total_events ?? null}
            prevValue={kpi?.prev_total_events ?? null}
            deltaUnit="pct"
            loading={kpiLoading}
          />
          <KpiCard
            label="RSVPs"
            value={kpi?.total_rsvps?.toLocaleString('mn-MN') ?? '—'}
            rawValue={kpi?.total_rsvps ?? null}
            prevValue={kpi?.prev_total_rsvps ?? null}
            deltaUnit="pct"
            loading={kpiLoading}
          />
          <KpiCard
            label="Багтаамж"
            value={fmtPct(kpi?.fill_rate_avg ?? null)}
            rawValue={kpi?.fill_rate_avg ?? null}
            prevValue={kpi?.prev_fill_rate_avg ?? null}
            deltaUnit="pp"
            loading={kpiLoading}
          />
          <KpiCard
            label="Ирц"
            value={fmtPct(kpi?.attendance_rate_avg ?? null)}
            rawValue={kpi?.attendance_rate_avg ?? null}
            prevValue={kpi?.prev_attendance_rate_avg ?? null}
            deltaUnit="pp"
            to="?tab=risk"
            loading={kpiLoading}
          />
          <KpiCard
            label="Цагтаа"
            value={fmtPct(kpi?.on_time_rate_avg ?? null)}
            rawValue={kpi?.on_time_rate_avg ?? null}
            prevValue={kpi?.prev_on_time_rate_avg ?? null}
            deltaUnit="pp"
            loading={kpiLoading}
          />
          <KpiCard
            label="Идэвхтэй гишүүд"
            value={kpi?.active_members?.toLocaleString('mn-MN') ?? '—'}
            rawValue={kpi?.active_members ?? null}
            prevValue={kpi?.prev_active_members ?? null}
            deltaUnit="pct"
            to="?tab=members"
            loading={kpiLoading}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <FunnelChart
            rsvps={funnelTotals.rsvps}
            confirmed={funnelTotals.confirmed}
            attended={funnelTotals.attended}
            onTime={funnelTotals.onTime}
          />
          <MemberGrowthChart fromIso={period.fromIso} toIso={period.toIso} />
          <WeatherScatterChart />
          <DayOfWeekHeatmap fromIso={period.fromIso} />
        </div>
      )}

      {tab === 'events' && (
        <EventTable rows={events ?? []} loading={eventsLoading} exportFilters={exportFilters} />
      )}

      {tab === 'members' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <MemberGrowthChart fromIso={period.fromIso} toIso={period.toIso} />
          <CohortHeatmap fromIso={period.fromIso} />
        </div>
      )}

      {tab === 'weather' && (
        <div className="grid gap-4">
          <WeatherScatterChart />
          <DayOfWeekHeatmap fromIso={period.fromIso} />
        </div>
      )}

      {tab === 'risk' && <AtRiskList />}

      {tab === 'notif' && <NotificationHealthCard />}

      {kpiLoading && tab !== 'events' && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
