import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Users, Trophy } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white rounded-full translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 lg:py-36">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Монголын хамгийн том дугуйн нийгэмлэг
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Хамтдаа дугуйлж,
            <br />
            <span className="text-primary-300">Монголыг нээцгээе</span>
          </h1>

          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl leading-relaxed">
            Маршрут судлах, арга хэмжээнд нэгдэх, тоног төхөөрөмж худалдаалах,
            дугуйн нийгэмлэгтэй холбогдох — бүгд нэг дор.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-primary-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-lg shadow-black/10"
            >
              Нэгдэх
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/routes"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/20 transition-colors border border-white/20"
            >
              Маршрут үзэх
            </Link>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-300" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">500+</div>
                <div className="text-sm text-white/60">Гишүүд</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary-300" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">50+</div>
                <div className="text-sm text-white/60">Маршрут</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary-300" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">120K+</div>
                <div className="text-sm text-white/60">Нийт км</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
