import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';
import { supabasePublic } from '../../lib/supabase';
import type { RouteDifficultyLabel, RouteDiscipline } from '../../types/database.types';

// Default Leaflet icon CDN fix
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const ULAANBAATAR: L.LatLngExpression = [47.9184, 106.9177];
const DEFAULT_ZOOM = 9;
const DEBOUNCE_MS = 300;

interface BboxRouteRow {
  id: string;
  title: string;
  distance_km: number;
  elevation_gain_m: number;
  difficulty_label: RouteDifficultyLabel | null;
  discipline: RouteDiscipline;
  region: string | null;
  cover_photo_path: string | null;
  start_lat: number;
  start_lng: number;
  path_geojson: { coordinates?: Array<[number, number]> } | null;
}

interface RouteBrowseMapProps {
  selectedRouteId?: string | null;
  onRouteSelect?: (id: string) => void;
  className?: string;
}

const DIFFICULTY_COLOR: Record<RouteDifficultyLabel, string> = {
  easy:     '#22c55e',
  moderate: '#eab308',
  hard:     '#f97316',
  expert:   '#ef4444',
};

export default function RouteBrowseMap({ selectedRouteId, onRouteSelect, className = '' }: RouteBrowseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const debounceRef = useRef<number | null>(null);
  const popupRef = useRef<L.Popup | null>(null);

  const [routes, setRoutes] = useState<BboxRouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [popup, setPopup] = useState<{ route: BboxRouteRow; latlng: L.LatLng } | null>(null);

  // ----------------------------------------------------------
  // Init map once
  // ----------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView(ULAANBAATAR, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);

    layerRef.current = L.layerGroup().addTo(mapRef.current);

    const fetchInBbox = async () => {
      const map = mapRef.current;
      if (!map) return;
      const b = map.getBounds();
      setLoading(true);

      const { data, error } = await supabasePublic.rpc('routes_in_bbox' as never, {
        p_min_lat: b.getSouth(),
        p_min_lng: b.getWest(),
        p_max_lat: b.getNorth(),
        p_max_lng: b.getEast(),
        p_limit: 100,
      } as never);
      setLoading(false);
      if (error) {
        console.error('[routes_in_bbox]', error.message);
        return;
      }
      setRoutes((data as unknown as BboxRouteRow[]) ?? []);
    };

    const onMoveEnd = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(fetchInBbox, DEBOUNCE_MS);
    };

    mapRef.current.on('moveend', onMoveEnd);
    // Initial load
    fetchInBbox();

    return () => {
      mapRef.current?.off('moveend', onMoveEnd);
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  // ----------------------------------------------------------
  // Render routes when data changes
  // ----------------------------------------------------------
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    layer.clearLayers();

    routes.forEach((r) => {
      const isSelected = selectedRouteId === r.id;
      const color = r.difficulty_label ? DIFFICULTY_COLOR[r.difficulty_label] : '#6b7280';

      // Draw polyline if we have geometry
      const coords = r.path_geojson?.coordinates;
      if (coords && coords.length >= 2) {
        const latlngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
        const polyline = L.polyline(latlngs, {
          color,
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 0.95 : 0.7,
        });
        polyline.on('click', (e) => {
          setPopup({ route: r, latlng: e.latlng });
          onRouteSelect?.(r.id);
        });
        polyline.addTo(layer);
      }

      // Start marker
      const marker = L.circleMarker([r.start_lat, r.start_lng], {
        radius: isSelected ? 9 : 6,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      });
      marker.on('click', (e) => {
        setPopup({ route: r, latlng: e.latlng });
        onRouteSelect?.(r.id);
      });
      marker.addTo(layer);
    });
  }, [routes, selectedRouteId, onRouteSelect]);

  // ----------------------------------------------------------
  // Open Leaflet popup with React content
  // ----------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (popupRef.current) {
      map.closePopup(popupRef.current);
      popupRef.current = null;
    }
    if (!popup) return;

    const div = document.createElement('div');
    div.style.minWidth = '180px';
    div.innerHTML = `
      <div style="font-weight:600;font-size:14px;color:#111827;margin-bottom:4px">${escapeHtml(popup.route.title)}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:6px">
        ${Number(popup.route.distance_km).toFixed(1)} км · ${popup.route.elevation_gain_m} м
        ${popup.route.region ? ` · ${escapeHtml(popup.route.region)}` : ''}
      </div>
      <a href="/routes/${popup.route.id}" style="
        display:inline-block;font-size:12px;font-weight:500;
        color:#2e7d32;text-decoration:none;
      ">Үзэх →</a>
    `;
    popupRef.current = L.popup({ closeButton: true, autoPan: true })
      .setLatLng(popup.latlng)
      .setContent(div)
      .openOn(map);

    return () => {
      if (popupRef.current) {
        map.closePopup(popupRef.current);
        popupRef.current = null;
      }
    };
  }, [popup]);

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: '500px' }} />
      {loading && (
        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-600 shadow-md flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Уншиж байна...
        </div>
      )}
      {routes.length === 0 && !loading && (
        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-500 shadow-md">
          Энэ хэсэгт маршрут алга
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-600 shadow-md">
        {routes.length} маршрут харагдаж байна
      </div>
    </div>
  );
}

// Tiny utility for the L.popup HTML — minimal escape since we don't render markdown.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

