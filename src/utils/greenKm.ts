export function calculateGreenKm(distanceKm: number, isCommute: boolean): number {
  // Green km = cycling distance that replaces car travel
  return isCommute ? distanceKm : 0;
}

export function calculateCO2Saved(greenKm: number): number {
  // Average car emits ~120g CO2 per km
  return greenKm * 0.12; // kg
}

export function formatCO2(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} тонн CO₂`;
  return `${kg.toFixed(1)} кг CO₂`;
}
