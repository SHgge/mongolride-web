import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ElevationChartProps {
  coordinates: [number, number, number?][];
  className?: string;
}

export default function ElevationChart({ coordinates, className = '' }: ElevationChartProps) {
  if (!coordinates || coordinates.length < 2) return null;

  // Build chart data: cumulative distance vs elevation
  let cumDist = 0;
  const data: { distance: number; elevation: number }[] = [];

  for (let i = 0; i < coordinates.length; i++) {
    const ele = coordinates[i][2];
    if (ele === undefined) continue;

    if (i > 0) {
      const [lon1, lat1] = coordinates[i - 1];
      const [lon2, lat2] = coordinates[i];
      const R = 6371;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      cumDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Sample every ~50 points for performance
    if (coordinates.length > 500 && i % Math.floor(coordinates.length / 300) !== 0 && i !== coordinates.length - 1) continue;

    data.push({
      distance: Math.round(cumDist * 10) / 10,
      elevation: Math.round(ele),
    });
  }

  if (data.length < 2) return null;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#43a047" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#43a047" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="distance"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={(v) => `${v} км`}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={(v) => `${v} м`}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            formatter={(value) => [`${value} м`, 'Өндөршил']}
            labelFormatter={(label) => `${label} км`}
          />
          <Area
            type="monotone"
            dataKey="elevation"
            stroke="#43a047"
            strokeWidth={2}
            fill="url(#elevGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
