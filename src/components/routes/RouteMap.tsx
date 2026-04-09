import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Tables } from '../../types/database.types';

type Route = Tables<'routes'>;

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface RouteMapProps {
  routes: Route[];
  selectedRouteId?: string | null;
  onRouteSelect?: (routeId: string) => void;
  className?: string;
  /** GPX track coordinates [lng, lat, elevation?][] */
  gpxTrack?: [number, number, number?][];
}

const DEFAULT_CENTER: L.LatLngExpression = [47.9184, 106.9177];
const DEFAULT_ZOOM = 11;

export default function RouteMap({ routes, selectedRouteId, onRouteSelect, className = '', gpxTrack }: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Route markers
  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current!.removeLayer(layer);
      }
    });

    routes.forEach((route, i) => {
      const lat = 47.9184 + (i * 0.02) - 0.04;
      const lng = 106.9177 + (i * 0.03) - 0.06;
      const isSelected = selectedRouteId === route.id;

      const icon = L.divIcon({
        html: `<div style="
          width: ${isSelected ? '32px' : '24px'};
          height: ${isSelected ? '32px' : '24px'};
          background: ${isSelected ? '#2e7d32' : '#43a047'};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
          font-weight: bold;
        ">${route.difficulty}</div>`,
        className: '',
        iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
        iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current!);

      marker.bindPopup(`
        <div style="min-width: 180px">
          <strong style="font-size: 14px">${route.title}</strong>
          <div style="color: #666; font-size: 12px; margin-top: 4px">
            ${route.distance_km} км · ${route.elevation_gain} м өндөршил
          </div>
          <div style="color: #888; font-size: 11px; margin-top: 2px">
            Үнэлгээ: ${Number(route.avg_rating).toFixed(1)} ★
          </div>
        </div>
      `);

      if (onRouteSelect) {
        marker.on('click', () => onRouteSelect(route.id));
      }
    });
  }, [routes, selectedRouteId, onRouteSelect]);

  // GPX track line
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove previous track
    if (trackLayerRef.current) {
      mapRef.current.removeLayer(trackLayerRef.current);
      trackLayerRef.current = null;
    }

    if (!gpxTrack || gpxTrack.length < 2) return;

    // Convert [lng, lat] to [lat, lng] for Leaflet
    const latLngs: L.LatLngExpression[] = gpxTrack.map(([lng, lat]) => [lat, lng]);

    // Draw track polyline
    trackLayerRef.current = L.polyline(latLngs, {
      color: '#2e7d32',
      weight: 4,
      opacity: 0.8,
      smoothFactor: 1,
    }).addTo(mapRef.current);

    // Start/End markers
    const startLatLng = latLngs[0] as [number, number];
    const endLatLng = latLngs[latLngs.length - 1] as [number, number];

    L.marker(startLatLng, {
      icon: L.divIcon({
        html: '<div style="width:12px;height:12px;background:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    }).addTo(mapRef.current).bindPopup('Эхлэх цэг');

    L.marker(endLatLng, {
      icon: L.divIcon({
        html: '<div style="width:12px;height:12px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    }).addTo(mapRef.current).bindPopup('Дуусах цэг');

    // Fit map to track bounds
    mapRef.current.fitBounds(trackLayerRef.current.getBounds(), { padding: [40, 40] });
  }, [gpxTrack]);

  return (
    <div ref={containerRef} className={`w-full rounded-xl overflow-hidden ${className}`} style={{ minHeight: '400px' }} />
  );
}
