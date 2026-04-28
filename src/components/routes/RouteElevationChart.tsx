import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useRouteHover } from '../../hooks/useRouteHover';
import type { ElevationPoint, RouteClimb } from '../../types/database.types';

interface RouteElevationChartProps {
  profile: ElevationPoint[];
  climbs?: RouteClimb[];
  height?: number;
}

interface TooltipPayload {
  active?: boolean;
  label?: number;
  payload?: Array<{ value: number; payload: ElevationPoint }>;
}

function ChartTooltip({ active, label, payload }: TooltipPayload) {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-md px-3 py-2 text-xs">
      <div className="text-gray-900 font-semibold">{Number(label).toFixed(1)} км</div>
      <div className="text-gray-600">{Math.round(payload[0].value)} м</div>
    </div>
  );
}

export default function RouteElevationChart({ profile, climbs = [], height = 220 }: RouteElevationChartProps) {
  const { hoveredKm, setHoveredKm } = useRouteHover();

  const { minEle, maxEle } = useMemo(() => {
    if (profile.length === 0) return { minEle: 0, maxEle: 0 };
    let min = profile[0].ele;
    let max = profile[0].ele;
    for (const p of profile) {
      if (p.ele < min) min = p.ele;
      if (p.ele > max) max = p.ele;
    }
    // Floor to nearest 50m below; ceil to 50m above for clean axis
    return {
      minEle: Math.floor(min / 50) * 50,
      maxEle: Math.ceil(max / 50) * 50,
    };
  }, [profile]);

  if (profile.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-gray-400">
        Өндөршлийн өгөгдөл байхгүй
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart
          data={profile}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onMouseMove={(state) => {
            if (state?.activeLabel != null) {
              setHoveredKm(Number(state.activeLabel));
            }
          }}
          onMouseLeave={() => setHoveredKm(null)}
        >
          <defs>
            <linearGradient id="eleFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#43a047" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#43a047" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            type="number"
            dataKey="km"
            domain={[0, 'dataMax']}
            tickFormatter={(v) => `${Number(v).toFixed(0)}`}
            stroke="#9ca3af"
            fontSize={11}
          />
          <YAxis
            domain={[minEle, maxEle]}
            tickFormatter={(v) => `${v}м`}
            stroke="#9ca3af"
            fontSize={11}
            width={48}
          />

          {/* Climb shading */}
          {climbs.map((c, i) => (
            <ReferenceArea
              key={i}
              x1={c.start_km}
              x2={c.end_km}
              y1={minEle}
              y2={maxEle}
              fill="#f59e0b"
              fillOpacity={0.08}
              stroke="#f59e0b"
              strokeOpacity={0.3}
              ifOverflow="hidden"
            />
          ))}

          <Area
            type="monotone"
            dataKey="ele"
            stroke="#2e7d32"
            strokeWidth={2}
            fill="url(#eleFill)"
            isAnimationActive={false}
            activeDot={{ r: 5, fill: '#f59e0b', stroke: '#fde68a', strokeWidth: 3 }}
          />

          {/* Sync cursor when triggered from outside (e.g. map hover, future) */}
          {hoveredKm != null && (
            <ReferenceLine x={hoveredKm} stroke="#f59e0b" strokeWidth={2} ifOverflow="hidden" />
          )}

          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#f59e0b', strokeWidth: 1.5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
