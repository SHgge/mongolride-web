import { MapPin, Users, Trophy, Shield, Zap, Leaf } from 'lucide-react';

const REASONS = [
  {
    icon: MapPin,
    title: 'Маршрут судлах',
    description: 'PostGIS газрын зурагтай 50+ маршрутаас сонгож, GPS track татаж аваарай.',
  },
  {
    icon: Users,
    title: 'Нийгэмлэгт нэгдэх',
    description: 'Дугуйчдын хамт арга хэмжээнд оролцож, шинэ найзуудтай болоорой.',
  },
  {
    icon: Trophy,
    title: 'Зэрэглэл ахиулах',
    description: 'Км бүртгүүлж, badge цуглуулж, leaderboard-д өрсөлдөөрэй.',
  },
  {
    icon: Shield,
    title: 'SOS тусламж',
    description: 'Яаралтай үед нэг дарахад ойролцоох гишүүд тусламж ирнэ.',
  },
  {
    icon: Zap,
    title: 'Зах зээл',
    description: 'Дугуй, сэлбэг, хувцас - хямд үнээр club гишүүдтэй худалдаалах.',
  },
  {
    icon: Leaf,
    title: 'Ногоон хэмнэлт',
    description: 'Дугуйгаар зорчиж хэмнэсэн CO₂ хэмжээгээ хянаарай.',
  },
];

export default function WhyJoinSection() {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Яагаад MongolRide?</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Монголын дугуйчдын хамгийн том платформ — маршрут, арга хэмжээ, зах зээл, нийгэмлэг бүгд нэг дор.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {REASONS.map((reason) => (
            <div
              key={reason.title}
              className="group p-6 rounded-2xl border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all duration-300"
            >
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-100 transition-colors">
                <reason.icon className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{reason.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{reason.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
