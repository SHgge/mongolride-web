import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function AddRoutePage() {
  const { profile } = useAuth();

  if (profile?.role === 'admin') {
    return <Navigate to="/admin/routes" replace />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/routes" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Бүх маршрут
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-7 h-7 text-primary-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Маршрут нэмэх</h1>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Маршрутыг одоогоор зөвхөн админ нэмж байна. Та өөрийн санал болгох маршрутаа клубийн админд илгээнэ үү.
          Гишүүдийн санал болгох систем V1.1-д нэмэгдэнэ.
        </p>
        <Link
          to="/routes"
          className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          Маршрут үзэх
        </Link>
      </div>
    </div>
  );
}
