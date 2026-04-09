import { useEffect, useState } from 'react';
import { Wind, Thermometer, Droplets, Eye } from 'lucide-react';

interface WeatherInfo {
  temp: number;
  humidity: number;
  wind_speed: number;
  description: string;
  aqi: number;
  aqiLabel: string;
  aqiColor: string;
}

const AQI_LEVELS = [
  { max: 50, label: 'Сайн', color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-500' },
  { max: 100, label: 'Дунд', color: 'text-yellow-600', bg: 'bg-yellow-50', bar: 'bg-yellow-500' },
  { max: 150, label: 'Мэдрэмтэй', color: 'text-orange-600', bg: 'bg-orange-50', bar: 'bg-orange-500' },
  { max: 200, label: 'Хортой', color: 'text-red-600', bg: 'bg-red-50', bar: 'bg-red-500' },
  { max: 999, label: 'Аюултай', color: 'text-purple-600', bg: 'bg-purple-50', bar: 'bg-purple-500' },
];

function getAqiLevel(aqi: number) {
  return AQI_LEVELS.find((l) => aqi <= l.max) ?? AQI_LEVELS[4];
}

export default function AirQualityWidget() {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
    if (!apiKey) {
      // Demo data when no API key
      setWeather({
        temp: 18,
        humidity: 45,
        wind_speed: 3.2,
        description: 'Цэлмэг',
        aqi: 65,
        aqiLabel: 'Дунд',
        aqiColor: 'text-yellow-600',
      });
      setLoading(false);
      return;
    }

    // UB coordinates
    const lat = 47.9184;
    const lon = 106.9177;

    Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=mn`).then(r => r.json()),
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`).then(r => r.json()),
    ])
      .then(([w, aq]) => {
        const aqi = aq?.list?.[0]?.main?.aqi ?? 2;
        const aqiValue = aqi * 50; // rough mapping 1-5 -> 50-250
        const level = getAqiLevel(aqiValue);
        setWeather({
          temp: Math.round(w.main?.temp ?? 18),
          humidity: w.main?.humidity ?? 45,
          wind_speed: w.wind?.speed ?? 3,
          description: w.weather?.[0]?.description ?? 'Цэлмэг',
          aqi: aqiValue,
          aqiLabel: level.label,
          aqiColor: level.color,
        });
      })
      .catch(() => {
        setWeather({
          temp: 18, humidity: 45, wind_speed: 3.2, description: 'Цэлмэг',
          aqi: 65, aqiLabel: 'Дунд', aqiColor: 'text-yellow-600',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-100 rounded-2xl h-48 animate-pulse" />
        </div>
      </section>
    );
  }

  if (!weather) return null;

  const aqiLevel = getAqiLevel(weather.aqi);
  const rideAdvice = weather.aqi <= 100 && weather.wind_speed < 10
    ? { text: 'Дугуйлахад тохиромжтой!', color: 'text-green-600' }
    : weather.aqi <= 150
    ? { text: 'Болгоомжтой дугуйлаарай', color: 'text-yellow-600' }
    : { text: 'Дугуйлахгүй байхыг зөвлөж байна', color: 'text-red-600' };

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-2xl p-6 md:p-8 border border-blue-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900">Улаанбаатар — Өнөөдөр</h3>
              </div>
              <p className="text-sm text-gray-500 capitalize mb-3">{weather.description}</p>
              <p className={`text-sm font-semibold ${rideAdvice.color}`}>{rideAdvice.text}</p>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-orange-400" />
                <div>
                  <div className="text-2xl font-bold text-gray-900">{weather.temp}°C</div>
                  <div className="text-xs text-gray-400">Температур</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-2xl font-bold text-gray-900">{weather.wind_speed} м/с</div>
                  <div className="text-xs text-gray-400">Салхи</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="text-2xl font-bold text-gray-900">{weather.humidity}%</div>
                  <div className="text-xs text-gray-400">Чийгшил</div>
                </div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${aqiLevel.color}`}>{weather.aqi}</div>
                <div className="text-xs text-gray-400">AQI ({aqiLevel.label})</div>
                <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full ${aqiLevel.bar}`} style={{ width: `${Math.min(weather.aqi / 3, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
