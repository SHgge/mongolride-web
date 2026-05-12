import { useMemo } from 'react';
import type { WeatherSnapshot, WeatherRisk } from '../types/database.types';

export interface AugmentedGearItem {
  value: string;
  label: string;
  /** True when this item was injected by the weather analyzer (not in event.required_gear). */
  weatherAdded: boolean;
  reason?: string;
}

const GEAR_LABELS: Record<string, string> = {
  helmet: 'Малгай',
  lights: 'Гэрэл',
  repair_kit: 'Засварын хэрэгсэл',
  water: 'Ус',
  id: 'Үнэмлэх',
  emergency_contact: 'Яаралтай холбоо',
  reflective_vest: 'Гэрэлтэх хантааз',
  hi_vis: 'Тод хувцас',
  thermal_layer: 'Дулаан давхарга',
  balaclava: 'Нүүрний хамгаалалт',
  pogies: 'Гарын дулаалга (pogies)',
  mask: 'PM2.5 маск (KN95/N95)',
  sunglasses: 'Нарны шил',
  sunscreen: 'Нар хамгаалах тос',
  extra_water: 'Нэмэлт ус',
  rain_jacket: 'Борооны хүрэм',
  studded_tires: 'Шиг(stud)-тэй дугуй',
};

interface Args {
  baseRequiredGear: string[];
  snapshot: WeatherSnapshot | null;
  risk: WeatherRisk | null;
}

export function useAugmentedGear({ baseRequiredGear, snapshot, risk }: Args): AugmentedGearItem[] {
  return useMemo(() => {
    const out = new Map<string, AugmentedGearItem>();

    // Base gear from the event
    for (const g of baseRequiredGear ?? []) {
      out.set(g, {
        value: g,
        label: GEAR_LABELS[g] ?? g,
        weatherAdded: false,
      });
    }

    if (!snapshot || !risk) return Array.from(out.values());

    const addWeather = (key: string, reason: string) => {
      if (out.has(key)) return; // already in baseline; don't downgrade flag
      out.set(key, {
        value: key,
        label: GEAR_LABELS[key] ?? key,
        weatherAdded: true,
        reason,
      });
    };

    // Cold layers
    if (risk.components.cold === 'orange' || risk.components.cold === 'red' || risk.components.cold === 'black') {
      const t = snapshot.temp_c ?? snapshot.feels_like_c ?? 0;
      addWeather('thermal_layer', `Температур ${t.toFixed(0)}°C — дулаан давхарга шаардлагатай`);
      addWeather('balaclava', 'Хүйтнээс нүүр амыг хамгаалах');
      if (snapshot.temp_c != null && snapshot.temp_c <= -25) {
        addWeather('pogies', 'Гар хөлдөхөөс сэргийлэх');
      }
    }

    // AQI mask
    if (risk.components.aqi === 'yellow' || risk.components.aqi === 'orange' ||
        risk.components.aqi === 'red' || risk.components.aqi === 'black') {
      addWeather('mask', `AQI ${snapshot.aqi_us ?? '?'} — амьсгалын замыг хамгаалах`);
    }

    // UV protection
    if (risk.components.uv === 'yellow' || risk.components.uv === 'orange') {
      addWeather('sunglasses', `UV ${snapshot.uv_index?.toFixed(0) ?? '?'} — нарны шил`);
      addWeather('sunscreen', 'SPF 30+ нар хамгаалах тос');
    }

    // Heat — extra water
    if (risk.components.heat === 'yellow' || risk.components.heat === 'orange' || risk.components.heat === 'red') {
      addWeather('extra_water', `Температур ${snapshot.temp_c?.toFixed(0) ?? '?'}°C — нэмэлт ус`);
    }

    // Rain
    if (risk.components.precip === 'yellow' || risk.components.precip === 'orange') {
      addWeather('rain_jacket', `Хур тунадас ${snapshot.precip_amount_mm?.toFixed(1) ?? '?'} мм`);
    }

    // High wind — visibility hint already covered via lights/hi_vis where set
    // (no specific add)

    return Array.from(out.values());
  }, [baseRequiredGear, snapshot, risk]);
}
