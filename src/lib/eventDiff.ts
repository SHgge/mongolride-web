export function diffKeys<T extends Record<string, unknown>>(before: T, after: T): string[] {
  const changed: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  keys.forEach((k) => {
    const a = before[k];
    const b = after[k];
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) changed.push(k);
    } else if (a !== b) {
      changed.push(k);
    }
  });
  return changed;
}

const NOTIFY_FIELDS = ['meet_at', 'roll_out_at', 'meet_location_name', 'discipline', 'required_gear'];

export function shouldNotifyParticipants(changedFields: string[]): boolean {
  return changedFields.some((f) => NOTIFY_FIELDS.includes(f));
}
