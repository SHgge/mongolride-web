import { Link } from 'react-router-dom';
import { Bike, Mail, Phone, MapPin } from 'lucide-react';

const FOOTER_LINKS = {
  'Платформ': [
    { to: '/routes', label: 'Маршрутууд' },
    { to: '/events', label: 'Арга хэмжээ' },
    { to: '/marketplace', label: 'Зах зээл' },
    { to: '/leaderboard', label: 'Тэргүүлэгчид' },
  ],
  'Мэдээлэл': [
    { to: '/news', label: 'Мэдээ' },
    { to: '/about', label: 'Бидний тухай' },
    { to: '/contact', label: 'Холбоо барих' },
    { to: '/privacy', label: 'Нууцлалын бодлого' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
                <Bike className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                Mongol<span className="text-primary-400">Ride</span>
              </span>
            </Link>
            <p className="text-sm text-gray-400 mb-6 max-w-sm leading-relaxed">
              Монголын дугуйчдын хамгийн том нийгэмлэг. Маршрут судлах, арга хэмжээнд нэгдэх, хамт дугуйлах.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Mail className="w-4 h-4" /> info@mongolride.mn
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Phone className="w-4 h-4" /> +976 9911-2233
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="w-4 h-4" /> Улаанбаатар, Монгол
              </div>
            </div>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-sm text-gray-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} MongolRide. Бүх эрх хуулиар хамгаалагдсан.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm">Facebook</a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm">Instagram</a>
            <a href="https://strava.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm">Strava</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
