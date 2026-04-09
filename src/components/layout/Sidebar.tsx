import { NavLink, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, MapPin, Calendar, ShoppingBag, Newspaper, Shield, Settings, ArrowLeft, Bike, LogOut, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/members', label: 'Гишүүд', icon: Users },
  { to: '/admin/routes', label: 'Маршрутууд', icon: MapPin },
  { to: '/admin/events', label: 'Арга хэмжээ', icon: Calendar },
  { to: '/admin/marketplace', label: 'Зах зээл', icon: ShoppingBag },
  { to: '/admin/news', label: 'Мэдээ', icon: Newspaper },
  { to: '/admin/settings', label: 'Тохиргоо', icon: Settings },
];

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Bike className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">
            Mongol<span className="text-primary-600">Ride</span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5 mt-2">
          <Shield className="w-3.5 h-3.5 text-primary-600" />
          <span className="text-xs font-medium text-primary-600">Админ панел</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {ADMIN_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <link.icon className="w-5 h-5" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-100">
        {/* Profile */}
        {profile && (
          <div className="px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-primary-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</div>
              <div className="text-xs text-gray-400 capitalize">{profile.role}</div>
            </div>
          </div>
        )}

        <div className="px-3 pb-3 space-y-1">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Сайт руу буцах
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Системээс гарах
          </button>
        </div>
      </div>
    </aside>
  );
}
