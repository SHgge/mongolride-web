import { useEffect, useState } from 'react';
import { airQualityService } from '../services/airquality.service';
import type { AirQualityData } from '../types/weather.types';

export function useAirQuality(lat: number, lon: number) {
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    airQualityService.getAirQuality(lat, lon).then((data) => {
      setAirQuality(data);
      setLoading(false);
    });
  }, [lat, lon]);

  return { airQuality, loading };
}
