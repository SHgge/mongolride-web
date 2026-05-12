// EP-09 P1-2: IndexedDB queue for scans made while offline.
// On reconnect, drainOfflineQueue() replays each scan via check_in_rsvp.
// Idempotent: scanning the same QR twice is fine.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface OfflineScan {
  id: string;
  token: string;
  eventId: string;
  lat: number | null;
  lng: number | null;
  override: boolean;
  method: 'qr' | 'manual';
  ts: number;
}

interface OfflineDB extends DBSchema {
  scans: {
    key: string;
    value: OfflineScan;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;
function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>('thesistrack-scans', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('scans')) {
          db.createObjectStore('scans', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOfflineScan(s: Omit<OfflineScan, 'id'>): Promise<void> {
  const db = await getDB();
  await db.put('scans', { ...s, id: crypto.randomUUID() });
}

export async function getOfflineScans(eventId?: string): Promise<OfflineScan[]> {
  const db = await getDB();
  const all = await db.getAll('scans');
  return eventId ? all.filter((s) => s.eventId === eventId) : all;
}

export async function getOfflineScanCount(eventId?: string): Promise<number> {
  return (await getOfflineScans(eventId)).length;
}

interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

interface DrainResult {
  synced: number;
  dropped_idempotent: number;
  failed: number;
}

export async function drainOfflineQueue(
  client: RpcClient,
  audit: (action: string, target?: string, details?: Record<string, unknown>) => Promise<void>,
): Promise<DrainResult> {
  const db = await getDB();
  const all = await db.getAll('scans');
  let synced = 0;
  let dropped_idempotent = 0;
  let failed = 0;

  for (const s of all) {
    const { data, error } = await client.rpc('check_in_rsvp', {
      p_token: s.token,
      p_event_id: s.eventId,
      p_method: s.method,
      p_override: s.override,
      p_lat: s.lat,
      p_lng: s.lng,
    });
    const row = Array.isArray(data) ? (data[0] as { status?: string; rsvp_id?: string; late?: boolean } | undefined) : undefined;
    if (error) { failed++; continue; }
    if (row?.status === 'checked_in' && row.rsvp_id) {
      synced++;
      await audit('rsvp.checked_in', row.rsvp_id, {
        method: s.method,
        late: row.late,
        offline_synced: true,
        override: s.override,
      });
      await db.delete('scans', s.id);
    } else if (row?.status === 'already_checked_in') {
      dropped_idempotent++;
      await db.delete('scans', s.id);
    } else {
      // cancelled / wrong_event / payment_pending / outside_window — keep in queue
      // so the organiser can act on them after sync (they'll see them in UI).
      failed++;
    }
  }

  return { synced, dropped_idempotent, failed };
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
