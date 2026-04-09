import { useState, useRef } from 'react';
import { FileUp, Loader2, X, MapPin, Mountain, Ruler } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface GPXData {
  coordinates: [number, number, number?][]; // [lng, lat, elevation?]
  distance_km: number;
  elevation_gain: number;
  gpx_url: string;
}

interface GPXUploadProps {
  folder: string;
  onParsed: (data: GPXData) => void;
  existingUrl?: string | null;
}

function parseGPX(xmlStr: string): { coordinates: [number, number, number?][]; distance_km: number; elevation_gain: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'text/xml');

  const coordinates: [number, number, number?][] = [];
  const trkpts = doc.querySelectorAll('trkpt');

  if (trkpts.length === 0) {
    // Try rtept (route points)
    const rtepts = doc.querySelectorAll('rtept');
    rtepts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') ?? '0');
      const lon = parseFloat(pt.getAttribute('lon') ?? '0');
      const eleNode = pt.querySelector('ele');
      const ele = eleNode ? parseFloat(eleNode.textContent ?? '0') : undefined;
      coordinates.push([lon, lat, ele]);
    });
  } else {
    trkpts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') ?? '0');
      const lon = parseFloat(pt.getAttribute('lon') ?? '0');
      const eleNode = pt.querySelector('ele');
      const ele = eleNode ? parseFloat(eleNode.textContent ?? '0') : undefined;
      coordinates.push([lon, lat, ele]);
    });
  }

  // Calculate distance (haversine)
  let distance = 0;
  let elevationGain = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1, ele1] = coordinates[i - 1];
    const [lon2, lat2, ele2] = coordinates[i];

    // Haversine
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    distance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Elevation gain
    if (ele1 !== undefined && ele2 !== undefined && ele2 > ele1) {
      elevationGain += ele2 - ele1;
    }
  }

  return {
    coordinates,
    distance_km: Math.round(distance * 10) / 10,
    elevation_gain: Math.round(elevationGain),
  };
}

export default function GPXUpload({ folder, onParsed, existingUrl }: GPXUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [stats, setStats] = useState<{ distance_km: number; elevation_gain: number; points: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.gpx')) {
      setError('Зөвхөн .gpx файл upload хийнэ');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Файлын хэмжээ 10MB-ээс хэтэрч байна');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Read and parse GPX
      const text = await file.text();
      const { coordinates, distance_km, elevation_gain } = parseGPX(text);

      if (coordinates.length < 2) {
        throw new Error('GPX файлд хангалттай цэг олдсонгүй');
      }

      // Upload to storage
      const storagePath = `${folder}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('routes')
        .upload(storagePath, file, { contentType: 'application/gpx+xml', upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('routes').getPublicUrl(storagePath);

      setFileName(file.name);
      setStats({ distance_km, elevation_gain, points: coordinates.length });

      onParsed({
        coordinates,
        distance_km,
        elevation_gain,
        gpx_url: urlData.publicUrl,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = () => {
    setFileName(null);
    setStats(null);
    setError(null);
  };

  return (
    <div>
      {!fileName && !existingUrl ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer"
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-2" />
              <span className="text-sm text-gray-500">GPX файл уншиж байна...</span>
            </>
          ) : (
            <>
              <FileUp className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-gray-700">GPX файл upload хийх</span>
              <span className="text-xs text-gray-400 mt-1">Strava, Garmin, Komoot-оос export хийсэн .gpx файл</span>
            </>
          )}
        </button>
      ) : (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileUp className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium text-primary-800">{fileName ?? 'GPX файл'}</span>
            </div>
            <button type="button" onClick={clear} className="p-1 text-gray-400 hover:text-red-500 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          {stats && (
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-primary-700">
                <Ruler className="w-3.5 h-3.5" /> {stats.distance_km} км
              </span>
              <span className="flex items-center gap-1 text-primary-700">
                <Mountain className="w-3.5 h-3.5" /> {stats.elevation_gain} м
              </span>
              <span className="flex items-center gap-1 text-primary-700">
                <MapPin className="w-3.5 h-3.5" /> {stats.points} цэг
              </span>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".gpx"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
