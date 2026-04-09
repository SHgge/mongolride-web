import { Bike, MapPin, Trophy, Shield, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import RegisterForm from '../components/auth/RegisterForm';

const FEATURES = [
  { icon: MapPin, text: 'GPS маршрутууд судлах' },
  { icon: Users, text: 'Арга хэмжээнд оролцох' },
  { icon: Trophy, text: 'Зэрэглэл ахиулах, badge цуглуулах' },
  { icon: Shield, text: 'SOS яаралтай тусламж' },
];

export default function RegisterPage() {
  return (
    <div className="min-h-[85vh] flex">
      {/* Left - Green branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -right-10 w-72 h-72 bg-white rounded-full" />
          <div className="absolute bottom-20 -left-20 w-96 h-96 bg-white rounded-full" />
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
            Хамтдаа
            <br />дугуйлцгааё
          </h2>
          <p className="text-primary-100 text-lg leading-relaxed max-w-md mb-8">
            Монголын дугуйчдын хамгийн том нийгэмлэгт нэгдээрэй.
          </p>

          <div className="space-y-4">
            {FEATURES.map((feature) => (
              <div key={feature.text} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-primary-200" />
                </div>
                <span className="text-white/90 text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-sm text-primary-200">
          Аль хэдийн 500+ гишүүд нэгдсэн
        </div>
      </div>

      {/* Right - Register form */}
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
              <h1 className="text-2xl font-bold text-gray-900">Бүртгүүлэх</h1>
              <p className="text-gray-500 text-sm mt-1">Үнэгүй бүртгэл, хурдан эхлэх</p>
            </div>
            <RegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}
