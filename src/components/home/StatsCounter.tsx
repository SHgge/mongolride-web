import { useEffect, useState, useRef } from 'react';
import { Users, Route, MapPin, Leaf } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StatItem {
  icon: React.ElementType;
  value: number;
  label: string;
  suffix?: string;
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const duration = 1500;
    const start = performance.now();
    const from = ref.current;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (value - from) * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(animate);
      else ref.current = value;
    }

    requestAnimationFrame(animate);
  }, [value]);

  return <>{display.toLocaleString()}{suffix}</>;
}

export default function StatsCounter() {
  const [stats, setStats] = useState<StatItem[]>([
    { icon: Users, value: 0, label: 'Нийт гишүүд' },
    { icon: Route, value: 0, label: 'Нийт км', suffix: ' км' },
    { icon: MapPin, value: 0, label: 'Маршрутууд' },
    { icon: Leaf, value: 0, label: 'CO₂ хэмнэлт', suffix: ' кг' },
  ]);

  useEffect(() => {
    supabase
      .from('site_stats')
      .select('*')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) {
          const s = data[0];
          setStats([
            { icon: Users, value: s.total_members || 500, label: 'Нийт гишүүд' },
            { icon: Route, value: Math.round(s.total_km) || 120000, label: 'Нийт км', suffix: ' км' },
            { icon: MapPin, value: s.total_routes || 50, label: 'Маршрутууд' },
            { icon: Leaf, value: Math.round(s.green_co2_saved_kg) || 25000, label: 'CO₂ хэмнэлт', suffix: ' кг' },
          ]);
        } else {
          setStats([
            { icon: Users, value: 500, label: 'Нийт гишүүд' },
            { icon: Route, value: 120000, label: 'Нийт км', suffix: ' км' },
            { icon: MapPin, value: 50, label: 'Маршрутууд' },
            { icon: Leaf, value: 25000, label: 'CO₂ хэмнэлт', suffix: ' кг' },
          ]);
        }
      });
  }, []);

  return (
    <section className="bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-100 text-primary-600 rounded-2xl mb-4">
                <stat.icon className="w-7 h-7" />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
