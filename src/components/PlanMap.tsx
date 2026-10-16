import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from '../lib/routing';
import { SavedStreets } from './SavedStreets';

const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--cobalt').trim() || '#1F4FE0';
const flagIcon = (label: string) => L.divIcon({
  className: 'plan-flag', iconSize: [0, 0],
  html: `<div style="transform:translate(-4px,-38px);display:flex;align-items:flex-end;gap:0">
    <div style="width:3px;height:38px;background:#0E1B33;border-radius:2px"></div>
    <div style="margin-bottom:22px;background:#FFB627;color:#2A1B00;font:800 12px/1 system-ui,sans-serif;padding:4px 7px;border-radius:0 6px 6px 0;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25)">${label}</div></div>`
});

function Taps({ onTap }: { onTap?: (p: LatLng) => void }) {
  useMapEvents({ click: e => onTap?.([e.latlng.lat, e.latlng.lng]) });
  return null;
}
/** keeps the map sized to its container and fits the given points when they change */
function Fit({ points, center }: { points: LatLng[]; center: LatLng | null }) {
  const map = useMap(), lastKey = useRef('');
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(map.getContainer()); return () => ro.disconnect();
  }, [map]);
  useEffect(() => {
    const key = points.length ? `${points.length}:${points[0]}:${points[points.length - 1]}` : `c${center}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map(p => L.latLng(p[0], p[1]))), { padding: [28, 28], animate: true });
    else if (center) map.setView(center, Math.max(map.getZoom(), 15), { animate: true });
  }, [map, points, center]);
  return null;
}

export interface MapOption { coords: LatLng[]; active: boolean; onPick?: () => void }

/** Map for planning: tap to add points, shows the route, other suggestions, the start and the goal flag */
export default function PlanMap({ center, start, waypoints = [], route = [], options = [], goal, goalLabel, onTap, className = '' }: {
  center: LatLng | null; start: LatLng | null; waypoints?: LatLng[]; route?: LatLng[]; options?: MapOption[];
  goal?: LatLng | null; goalLabel?: string; onTap?: (p: LatLng) => void; className?: string;
}) {
  const col = accent();
  const fitTo = route.length > 1 ? route : options.find(o => o.active)?.coords ?? [];
  return (
    <div className={`isolate overflow-hidden rounded-[20px] ${className}`}>
      <MapContainer center={center ?? [12.5, 122]} zoom={center ? 15 : 5} className="h-full w-full" zoomControl={false} attributionControl>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Routes: OSRM/FOSSGIS`} />
        <SavedStreets />
        <Taps onTap={onTap} />
        <Fit points={fitTo} center={center} />
        {options.filter(o => !o.active).map((o, i) => (
          <Polyline key={`o${i}`} positions={o.coords} pathOptions={{ color: col, weight: 4, opacity: 0.35 }} eventHandlers={{ click: () => o.onPick?.() }} />
        ))}
        {options.filter(o => o.active).map((o, i) => (
          <Polyline key={`a${i}`} positions={o.coords} pathOptions={{ color: col, weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
        ))}
        {route.length > 1 && <Polyline positions={route} pathOptions={{ color: col, weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />}
        {waypoints.map((p, i) => <CircleMarker key={`w${i}`} center={p} radius={6} pathOptions={{ color: '#fff', weight: 2.5, fillColor: col, fillOpacity: 1 }} />)}
        {start && (
          <CircleMarker center={start} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#0E1B33', fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -8]} permanent className="plan-start">Start</Tooltip>
          </CircleMarker>
        )}
        {goal && <Marker position={goal} icon={flagIcon(goalLabel ?? 'Goal')} interactive={false} />}
      </MapContainer>
    </div>
  );
}
