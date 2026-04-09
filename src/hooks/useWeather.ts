import { useEffect, useState } from 'react';
import { weatherService } from '../services/weather.service';
import type { WeatherData } from '../types/weather.types';

export function useWeather(lat: number, lon: number) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    weatherService.getWeather(lat, lon).then((data) => {
      setWeather(data);
      setLoading(false);
    });
  }, [lat, lon]);

  return { weather, loading };
}
