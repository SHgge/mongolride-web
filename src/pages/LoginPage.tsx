import { Bike } from 'lucide-react';
import { Link } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-[85vh] flex">
      {/* Left - Green branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-20 w-80 h-80 bg-white rounded-full" />
          <div className="absolute bottom-10 right-10 w-60 h-60 bg-white rounded-full" />
        </div>

        <div className="relative">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Bike className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">MongolRide</span>
          </Link>
        </div>

        <div className="relative">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Дугуйн нийгэмлэгт
            <br />тавтай морил
          </h2>
          <p className="text-primary-100 text-lg leading-relaxed max-w-md">
            500+ гишүүд, 50+ маршрут, мянга мянган километр — Монголын хамгийн идэвхтэй дугуйн клуб.
          </p>
        </div>

        <div className="relative flex gap-8">
          <div>
            <div className="text-3xl font-bold text-white">500+</div>
            <div className="text-sm text-primary-200">Гишүүд</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">120K</div>
            <div className="text-sm text-primary-200">Нийт км</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">50+</div>
            <div className="text-sm text-primary-200">Маршрут</div>
          </div>
        </div>
      </div>

      {/* Right - Login form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">
              Mongol<span className="text-primary-600">Ride</span>
            </span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Нэвтрэх</h1>
              <p className="text-gray-500 text-sm mt-1">Тавтай морилно уу</p>
            </div>
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
