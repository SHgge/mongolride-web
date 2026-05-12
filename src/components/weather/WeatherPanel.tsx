import {
  Thermometer, Wind, CloudRain, Droplets, Sun, Sunrise, Sunset, Eye,
  AlertTriangle, RefreshCw, Loader2, Gauge, Cloud,
} from 'lucide-react';
import { useWeatherSnapshot } from '../../hooks/useWeatherSnapshot';
import type {
  WeatherRiskLevel, WeatherRiskComponents, WeatherSnapshot,
} from '../../types/database.types';

interface WeatherPanelProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  atIso: string | null | undefined;
  isAdmin?: boolean;
}

const RISK_META: Record<WeatherRiskLevel, { label: string; bg: string; text: string; ring: string }> = {
  green:  { label: 'Хэвийн',                  bg: 'bg-green-100',  text: 'text-green-800',  ring: 'ring-green-300' },
  yellow: { label: 'Анхааруулга',             bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-300' },
  orange: { label: 'Эрсдэлтэй',               bg: 'bg-orange-100', text: 'text-orange-800', ring: 'ring-orange-300' },
  red:    { label: 'Аюултай',                 bg: 'bg-red-100',    text: 'text-red-800',    ring: 'ring-red-300' },
  black:  { label: 'Цуцлахыг зөвлөж байна',   bg: 'bg-gray-900',   text: 'text-white',      ring: 'ring-gray-700' },
};

const COMPONENT_LABELS: Record<keyof WeatherRiskComponents, string> = {
  cold: 'Хүйтэн', heat: 'Халуун', wind: 'Салхи', aqi: 'AQI',
  dust: 'Тоос', precip: 'Хур тунадас', thunderstorm: 'Аянга', uv: 'UV',
};

const COMPONENT_THRESHOLDS: Record<keyof WeatherRiskComponents, string> = {
  cold:  '≤-5°C: шар, ≤-15°C: улбар, ≤-25°C: улаан, ≤-30°C: хар',
  heat:  '≥28°C: шар, ≥32°C: улбар, ≥35°C: улаан',
  wind:  '≥12 м/с: шар, ≥18 м/с: улбар, ≥22 м/с: улаан',
  aqi:   '≥100: шар, ≥150: улбар, ≥200: улаан, ≥300: хар',
  dust:  'PM10 ≥80: шар, ≥150: улбар, ≥250 + салхи: улаан',
  precip: '≥3 мм: шар, ≥10 мм: улбар',
  thunderstorm: 'магадлал ≥30%: улбар, ≥60%: улаан',
  uv:    '≥8: шар, ≥11: улбар',
};

function compassDir(deg: number | null): string {
  if (deg == null) return '—';
  const dirs = ['Х','ХЗ','З','БЗ','Б','БУ','У','ХУ'];
  return dirs[Math.round(deg / 45) % 8];
}

function aqiCategoryColor(aqi: number | null): string {
  if (aqi == null) return 'text-gray-400';
  if (aqi >= 300) return 'text-purple-700';
  if (aqi >= 200) return 'text-red-600';
  if (aqi >= 150) return 'text-orange-600';
  if (aqi >= 100) return 'text-yellow-600';
  if (aqi >= 50)  return 'text-yellow-500';
  return 'text-green-600';
}

function fetchedAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'дөнгөж сая';
  if (min < 60) return `${min} минутын өмнө`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цагийн өмнө`;
  return `${Math.floor(h / 24)} өдрийн өмнө`;
}

function isForecastFar(atIso: string): boolean {
  const days = (new Date(atIso).getTime() - Date.now()) / 86_400_000;
  return days > 5;
}

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}
function Stat({ icon: Icon, label, value, sub, color }: StatProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
      <div className="flex items-center gap-1 text-[11px] text-gray-500 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-base font-semibold ${color ?? 'text-gray-900 dark:text-gray-100'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

interface SubBadgeProps {
  component: keyof WeatherRiskComponents;
  level: WeatherRiskLevel;
  snapshot: WeatherSnapshot | null;
}
function SubBadge({ component, level, snapshot }: SubBadgeProps) {
  const meta = RISK_META[level];
  let valueText = '—';
  if (snapshot) {
    switch (component) {
      case 'cold':
      case 'heat': valueText = snapshot.temp_c != null ? `${snapshot.temp_c.toFixed(0)}°C` : '—'; break;
      case 'wind': valueText = snapshot.wind_speed_ms != null ? `${snapshot.wind_speed_ms.toFixed(1)} м/с` : '—'; break;
      case 'aqi':  valueText = snapshot.aqi_us != null ? `${snapshot.aqi_us}` : '—'; break;
      case 'dust': valueText = snapshot.pm10_ugm3 != null ? `PM10 ${snapshot.pm10_ugm3.toFixed(0)}` : '—'; break;
      case 'precip': valueText = snapshot.precip_amount_mm != null ? `${snapshot.precip_amount_mm.toFixed(1)} мм` : '—'; break;
      case 'thunderstorm': valueText = snapshot.thunderstorm_prob_pct != null ? `${snapshot.thunderstorm_prob_pct}%` : '—'; break;
      case 'uv':   valueText = snapshot.uv_index != null ? `UV ${snapshot.uv_index.toFixed(0)}` : '—'; break;
    }
  }
  return (
    <div
      className={`px-2 py-1 rounded-md text-[11px] font-medium ${meta.bg} ${meta.text}`}
      title={`${COMPONENT_LABELS[component]} — ${valueText}\n${COMPONENT_THRESHOLDS[component]}`}
    >
      {COMPONENT_LABELS[component]}: {valueText}
    </div>
  );
}

export default function WeatherPanel({ lat, lng, atIso, isAdmin = false }: WeatherPanelProps) {
  const enabled = lat != null && lng != null && !!atIso;
  const { snapshot, risk, loading, error, refresh, cooldownRemainingMs } =
    useWeatherSnapshot({ lat, lng, atIso, enabled });

  if (!enabled) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
        <p className="text-sm text-gray-500">
          Цаг агаарын мэдээлэл харахын тулд эвентэд уулзах байршил (lat/lng) болон цаг тохируулсан байх ёстой.
        </p>
      </div>
    );
  }

  const overall = risk?.overall ?? 'green';
  const meta = RISK_META[overall];

  const cooldownMin = Math.ceil(cooldownRemainingMs / 60_000);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
      <div className={`px-5 py-3 ${meta.bg} ${meta.text} flex items-center justify-between flex-wrap gap-2`}>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ring-1 ${meta.ring} bg-white/40`}>
            {meta.label}
          </span>
          <span className="text-xs opacity-80">
            Цаг агаарын урьдчилсан мэдээ
          </span>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={refresh}
            disabled={loading || cooldownRemainingMs > 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-white/40 hover:bg-white/60 rounded-md disabled:opacity-50"
            title={cooldownRemainingMs > 0 ? `Дахин дуудах боломжтой: ${cooldownMin} мин дараа` : 'Шинэчлэх'}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Шинэчлэх
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {snapshot?.is_stale && (
          <div className="flex items-center gap-1.5 text-xs text-yellow-700 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Сүүлийн өгөгдөл — провайдер боломжгүй байна.
          </div>
        )}

        {atIso && isForecastFar(atIso) && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            5 хоногоос хол урьдчилсан мэдээний нарийвчлал багасна.
          </div>
        )}

        {/* Sub-badges */}
        {risk && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(risk.components) as Array<[keyof WeatherRiskComponents, WeatherRiskLevel]>)
              .filter(([, lvl]) => lvl && lvl !== 'green')
              .map(([component, level]) => (
                <SubBadge key={component} component={component} level={level} snapshot={snapshot} />
              ))}
            {(Object.values(risk.components) as WeatherRiskLevel[]).every((l) => !l || l === 'green') && (
              <span className="text-xs text-gray-400">Бүх үзүүлэлт хэвийн</span>
            )}
          </div>
        )}

        {/* Stats grid */}
        {(loading && !snapshot) ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
            {[0,1,2,3,4,5,6,7].map((i) => (
              <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl h-16" />
            ))}
          </div>
        ) : snapshot ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              icon={Thermometer}
              label="Температур"
              value={snapshot.temp_c != null ? `${snapshot.temp_c.toFixed(0)}°C` : '—'}
              sub={snapshot.feels_like_c != null && snapshot.feels_like_c !== snapshot.temp_c
                ? `мэдрэмж ${snapshot.feels_like_c.toFixed(0)}°C` : undefined}
            />
            <Stat
              icon={Wind}
              label="Салхи"
              value={snapshot.wind_speed_ms != null
                ? `${snapshot.wind_speed_ms.toFixed(1)} м/с ${compassDir(snapshot.wind_dir_deg)}`
                : '—'}
              sub={snapshot.wind_gust_ms != null ? `шуурга ${snapshot.wind_gust_ms.toFixed(0)}` : undefined}
            />
            <Stat
              icon={CloudRain}
              label="Хур тунадас"
              value={snapshot.precip_amount_mm != null ? `${snapshot.precip_amount_mm.toFixed(1)} мм` : '—'}
              sub={snapshot.precip_prob_pct != null ? `${snapshot.precip_prob_pct}% магадлал` : undefined}
            />
            <Stat
              icon={Droplets}
              label="Чийгшил"
              value={snapshot.humidity_pct != null ? `${snapshot.humidity_pct}%` : '—'}
              sub={snapshot.pressure_hpa != null ? `${snapshot.pressure_hpa.toFixed(0)} hPa` : undefined}
            />
            <Stat
              icon={Gauge}
              label="AQI"
              value={snapshot.aqi_us != null ? String(snapshot.aqi_us) : '—'}
              sub={snapshot.pm25_ugm3 != null ? `PM2.5 ${snapshot.pm25_ugm3.toFixed(0)}` : undefined}
              color={aqiCategoryColor(snapshot.aqi_us)}
            />
            <Stat
              icon={Sun}
              label="UV"
              value={snapshot.uv_index != null ? snapshot.uv_index.toFixed(0) : '—'}
            />
            <Stat
              icon={Sunrise}
              label="Нар мандах"
              value={snapshot.sunrise_at
                ? new Date(snapshot.sunrise_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
                : '—'}
            />
            <Stat
              icon={Sunset}
              label="Нар жаргах"
              value={snapshot.sunset_at
                ? new Date(snapshot.sunset_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
                : '—'}
            />
            {snapshot.cloud_cover_pct != null && (
              <Stat icon={Cloud} label="Үүл" value={`${snapshot.cloud_cover_pct}%`} />
            )}
            {snapshot.visibility_km != null && (
              <Stat icon={Eye} label="Харагдац" value={`${snapshot.visibility_km.toFixed(0)} км`} />
            )}
          </div>
        ) : null}

        {/* Provenance */}
        {snapshot && (
          <div className="text-[10px] text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Эх сурвалж: <span className="font-medium">{snapshot.provider}</span></span>
            <span>·</span>
            <span>Сүүлд татсан: {fetchedAgo(snapshot.fetched_at)}</span>
            <span>·</span>
            <span>Open-Meteo / OSM-ийн өгөгдөл</span>
          </div>
        )}
      </div>
    </div>
  );
}
