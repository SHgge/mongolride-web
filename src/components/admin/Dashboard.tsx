import { useEffect, useState } from 'react';
import { Users, MapPin, Calendar, ShoppingBag, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DashboardStats {
  totalMembers: number;
  totalRoutes: number;
  totalEvents: number;
  totalListings: number;
  pendingRoutes: number;
  upcomingEvents: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0, totalRoutes: 0, totalEvents: 0, totalListings: 0, pendingRoutes: 0, upcomingEvents: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('routes').select('*', { count: 'exact', head: true }),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'upcoming'),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]).then(([members, routes, pending, events, upcoming, listings]) => {
      setStats({
        totalMembers: members.count ?? 0,
        totalRoutes: routes.count ?? 0,
        pendingRoutes: pending.count ?? 0,
        totalEvents: events.count ?? 0,
        upcomingEvents: upcoming.count ?? 0,
        totalListings: listings.count ?? 0,
      });
      setLoading(false);
    });
  }, []);

  const cards = [
    { label: 'Нийт гишүүд', value: stats.totalMembers, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Маршрутууд', value: stats.totalRoutes, icon: MapPin, color: 'bg-green-50 text-green-600', sub: stats.pendingRoutes > 0 ? `${stats.pendingRoutes} хүлээгдэж буй` : undefined },
    { label: 'Арга хэмжээ', value: stats.totalEvents, icon: Calendar, color: 'bg-purple-50 text-purple-600', sub: stats.upcomingEvents > 0 ? `${stats.upcomingEvents} удахгүй` : undefined },
    { label: 'Идэвхтэй зар', value: stats.totalListings, icon: ShoppingBag, color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">MongolRide системийн ерөнхий мэдээлэл</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {loading ? <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" /> : card.value}
            </div>
            <div className="text-sm text-gray-500">{card.label}</div>
            {card.sub && <div className="text-xs text-primary-600 mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Хурдан үйлдэл</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Маршрут батлах', href: '/admin/routes', icon: MapPin },
            { label: 'Гишүүд удирдах', href: '/admin/members', icon: Users },
            { label: 'Арга хэмжээ нэмэх', href: '/admin/events', icon: Calendar },
            { label: 'Мэдээ нэмэх', href: '/admin/news', icon: TrendingUp },
          ].map((action) => (
            <a key={action.label} href={action.href} className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
              <action.icon className="w-4 h-4" /> {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
