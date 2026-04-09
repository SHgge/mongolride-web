export function formatDistance(km: number): string {
  return `${km.toFixed(1)} км`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN');
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('mn-MN');
}

export function formatPrice(price: number, currency = 'MNT'): string {
  return new Intl.NumberFormat('mn-MN', { style: 'currency', currency }).format(price);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} мин`;
  return `${hours} цаг ${mins} мин`;
}
