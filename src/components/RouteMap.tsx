import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import type { RoutePoint } from '../types';
import { segments } from '../lib/geo';

function Fit({ route, follow, here }: { route: RoutePoint[]; follow?: boolean; here?: [number, number, number] | null }) {
  const map = useMap();
  // Re-measure whenever the container changes size (maps inside opening dialogs start at 0x0)
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  useEffect(() => {
    map.invalidateSize({ animate: false });
    if (follow) {
      const p = here ?? route[route.length - 1];
      if (p) map.setView([p[0], p[1]], Math.max(map.getZoom(), 16), { animate: true });
      return;
    }
    if (!route.length) return;
    const b: LatLngBoundsExpression = route.map(p => [p[0], p[1]] as [number, number]);
    map.fitBounds(b, { padding: [24, 24], maxZoom: 17 });
  }, [map, route, follow, here]);
  return null;
}

/** Real map with OpenStreetMap tiles. Shown only to the activity's owner. */
export default function RouteMap({ route, follow, here, className = '' }: { route: RoutePoint[]; follow?: boolean; here?: [number, number, number] | null; className?: string }) {
  if (route.length < 1 && !here) return null;
  const segs = segments(route).map(s => s.map(p => [p[0], p[1]] as LatLngExpression));
  const first = route[0], last = route[route.length - 1];
  const center = here ?? last;
  return (
    <div className={`overflow-hidden rounded-[18px] border border-line ${className}`}>
      <MapContainer center={[center[0], center[1]]} zoom={16} className="h-full w-full" attributionControl zoomControl={!follow} scrollWheelZoom={false}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {segs.map((s, i) => <Polyline key={i} positions={s} pathOptions={{ color: '#1F4FE0', weight: 5, lineCap: 'round', lineJoin: 'round' }} />)}
        {first && <CircleMarker center={[first[0], first[1]]} radius={6} pathOptions={{ color: '#1F4FE0', fillColor: '#FFFFFF', fillOpacity: 1, weight: 3 }} />}
        {here && here[2] <= 500 && <Circle center={[here[0], here[1]]} radius={here[2]} pathOptions={{ color: '#1F4FE0', weight: 1, fillColor: '#1F4FE0', fillOpacity: 0.12 }} />}
        {here
          ? <CircleMarker center={[here[0], here[1]]} radius={8} pathOptions={{ color: '#FFFFFF', fillColor: '#1F4FE0', fillOpacity: 1, weight: 3 }} />
          : last && <CircleMarker center={[last[0], last[1]]} radius={7} pathOptions={{ color: '#FFB627', fillColor: '#FFB627', fillOpacity: 1, weight: 2 }} />}
        <Fit route={route} follow={follow} here={here} />
      </MapContainer>
    </div>
  );
}
