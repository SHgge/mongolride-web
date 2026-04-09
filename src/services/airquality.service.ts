const AQ_API_KEY = import.meta.env.VITE_AIR_QUALITY_API_KEY;

export const airQualityService = {
  async getAirQuality(lat: number, lon: number) {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${AQ_API_KEY}`);
    return res.json();
  },
};
