export interface WeatherData {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  description: string;
  icon: string;
}

export interface AirQualityData {
  aqi: number;
  pm25: number;
  pm10: number;
  status: string;
}
