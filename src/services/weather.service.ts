const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY;

export const weatherService = {
  async getWeather(lat: number, lon: number) {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=mn`);
    return res.json();
  },
};
