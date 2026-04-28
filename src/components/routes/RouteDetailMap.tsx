import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRouteHover } from '../../hooks/useRouteHover';
import type { RouteClimb } from '../../types/database.types';

// Leaflet default icon CDN fix
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface RouteDetailMapProps {
  /** [lng, lat][] — full route geometry from get_route_path_geojson */
  coords: Array<[number, number]>;
  /** Total km from routes.distance_km — used to map hoveredKm to a position on the polyline */
  totalKm: number;
  climbs?: RouteClimb[];
  className?: string;
}

const HAVERSINE_R = 6_371_000;
function haversineMeters(a: [number, number], b: [number, number]): number {
  // [lng, lat]
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * HAVERSINE_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function RouteDetailMap({ coords, totalKm, climbs = [], className = '' }: RouteDetailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null);
  const cumDistRef = useRef<number[]>([]);
  const { hoveredKm } = useRouteHover();

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (coords.length < 2) return;

    const latLngs: L.LatLngExpression[] = coords.map(([lng, lat]) => [lat, lng]);

    mapRef.current = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);

    // Polyline
    const polyline = L.polyline(latLngs, {
      color: '#2e7d32',
      weight: 5,
      opacity: 0.85,
      smoothFactor: 1,
    }).addTo(mapRef.current);

    // Start / End markers
    L.marker(latLngs[0], {
      icon: L.divIcon({
        html: '<div style="width:14px;height:14px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    }).addTo(mapRef.current).bindPopup('Эхлэх цэг');

    L.marker(latLngs[latLngs.length - 1], {
      icon: L.divIcon({
        html: '<div style="width:14px;height:14px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    }).addTo(mapRef.current).bindPopup('Дуусах цэг');

    // Pre-compute cumulative distances along the polyline for hover→latlng mapping
    const cum: number[] = [0];
    for (let i = 1; i < coords.length; i++) {
      cum.push(cum[i - 1] + haversineMeters(coords[i - 1], coords[i]));
    }
    cumDistRef.current = cum;

    // Climb markers
    if (climbs.length > 0 && totalKm > 0) {
      const totalM = cum[cum.length - 1];
      climbs.forEach((c, idx) => {
        const targetM = (c.start_km / totalKm) * totalM;
        const pos = pointAtDistance(coords, cum, targetM);
        if (!pos) return;
        L.marker([pos[1], pos[0]], {
          icon: L.divIcon({
            html: `<div style="
              width: 22px; height: 22px; background: #f59e0b;
              border: 2px solid white; border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex; align-items: center; justify-content: center;
              color: white; font-weight: 700; font-size: 11px;
            ">${idx + 1}</div>`,
            className: '',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        }).addTo(mapRef.current!).bindPopup(
          `<strong>Авирах ${idx + 1}</strong><br>` +
          `${c.length_km}км · ${c.gain_m}м · ${c.avg_grade}%<br>` +
          `Cat ${c.category}`,
        );
      });
    }

    // Fit to polyline
    mapRef.current.fitBounds(polyline.getBounds(), { padding: [40, 40] });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      hoverMarkerRef.current = null;
    };
    // We intentionally re-init only if `coords` reference changes
  }, [coords, totalKm, climbs]);

  // React to hovered km — render/remove a yellow dot at the matching position
  useEffect(() => {
    if (!mapRef.current) return;
    const cum = cumDistRef.current;
    const totalM = cum.length > 0 ? cum[cum.length - 1] : 0;

    if (hoveredKm == null || totalKm <= 0 || totalM <= 0) {
      if (hoverMarkerRef.current) {
        mapRef.current.removeLayer(hoverMarkerRef.current);
        hoverMarkerRef.current = null;
      }
      return;
    }

    const targetM = Math.min(Math.max(0, hoveredKm * 1000), totalM);
    const pos = pointAtDistance(coords, cum, targetM);
    if (!pos) return;

    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.setLatLng([pos[1], pos[0]]);
    } else {
      hoverMarkerRef.current = L.circleMarker([pos[1], pos[0]], {
        radius: 8,
        color: '#fde68a',
        weight: 3,
        fillColor: '#f59e0b',
        fillOpacity: 1,
      }).addTo(mapRef.current);
    }
  }, [hoveredKm, coords, totalKm]);

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-2xl overflow-hidden ${className}`}
      style={{ minHeight: '420px' }}
    />
  );
}

// Find the [lng, lat] point along `coords` at cumulative distance `targetM`.
function pointAtDistance(
  coords: Array<[number, number]>,
  cum: number[],
  targetM: number,
): [number, number] | null {
  if (coords.length < 2) return null;
  // Binary search for segment
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < targetM) lo = mid + 1;
    else hi = mid;
  }
  const idx = Math.max(1, lo);
  const segLen = cum[idx] - cum[idx - 1];
  const t = segLen > 0 ? (targetM - cum[idx - 1]) / segLen : 0;
  const [lng1, lat1] = coords[idx - 1];
  const [lng2, lat2] = coords[idx];
  return [lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t];
}
