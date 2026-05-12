// EP-07 P1-6: organizer-scoped dashboard.
// /organizer/dashboard — non-admin organizers see ONLY their own events.
// SQL function event_analytics_list already enforces "organizer = auth.uid()
// OR co_organizer" when caller is not admin.

import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEventList } from '../hooks/analytics/queries';
import PeriodSelector, { useCurrentPeriod } from '../components/admin/dashboard/PeriodSelector';
import EventTable from '../components/admin/dashboard/EventTable';
import LivePanel from '../components/admin/dashboard/LivePanel';
import { FunnelChart } from '../components/admin/dashboard/Charts';

export default function OrganizerDashboardPage() {
  const { user } = useAuth();
  const period = useCurrentPeriod();

  const { data: events, isLoading } = useEventList({
    fromIso: period.fromIso,
    toIso: period.toIso,
  });

  const totals = useMemo(() => {
    const t = { events: 0, rsvps: 0, attended: 0, late: 0, no_show: 0 };
    for (const e of events ?? []) {
      t.events++;
      t.rsvps    += e.rsvps_total ?? 0;
      t.attended += e.attended_count ?? 0;
      t.late     += e.late_arrival_count ?? 0;
      t.no_show  += e.no_show_count ?? 0;
    }
    return t;
  }, [events]);

  const exportFilters = { from: period.fromIso, to: period.toIso };

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Зохион байгуулагчийн dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Таны эвентүүдийн ирц, оролцоо.</p>
      </div>

      <LivePanel />

      <div className="my-4">
        <PeriodSelector />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Tile label="Эвент"      value={totals.events} />
        <Tile label="RSVPs"      value={totals.rsvps} />
        <Tile label="Ирсэн"      value={totals.attended} color="text-green-700" />
        <Tile label="Ирээгүй"    value={totals.no_show} color="text-red-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <FunnelChart
          rsvps={totals.rsvps}
          confirmed={totals.attended + totals.no_show}
          attended={totals.attended}
          onTime={totals.attended - totals.late}
        />
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">Хураангуй</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>Хоцорсон: <strong className="text-amber-600">{totals.late}</strong></li>
            <li>Ирц: <strong>{totals.rsvps > 0
              ? `${((totals.attended / Math.max(1, totals.attended + totals.no_show)) * 100).toFixed(1)}%`
              : '—'}</strong></li>
          </ul>
        </div>
      </div>

      <EventTable
        rows={events ?? []}
        loading={isLoading}
        exportFilters={exportFilters}
      />
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color ?? 'text-gray-900'}`}>
        {value.toLocaleString('mn-MN')}
      </div>
    </div>
  );
}
