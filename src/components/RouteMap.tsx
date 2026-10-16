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

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Draws the route from start to finish once the map has settled, then reveals the finish dot */
function DrawIn({ duration = 1300 }: { duration?: number }) {
  const map = useMap();
  useEffect(() => {
    const box = map.getContainer();
    const reveal = () => { box.classList.remove('animate-route'); box.querySelectorAll('.lakad-end').forEach(e => e.classList.add('route-end')); };
    if (reducedMotion()) { reveal(); return; }
    let done = false;
    const t = setTimeout(() => {
      const paths = [...box.querySelectorAll<SVGPathElement>('path.lakad-route')];
      const lens = paths.map(p => p.getTotalLength());
      const total = lens.reduce((a, b) => a + b, 0) || 1;
      let at = 0;
      paths.forEach((p, i) => {
        const L = lens[i], d = (L / total) * duration;
        p.style.transition = 'none'; p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = `${L}`;
        p.getBoundingClientRect();   // apply the start state before animating
        p.style.transition = `stroke-dashoffset ${d}ms ${i === 0 ? 'cubic-bezier(.3,.1,.3,1)' : 'linear'} ${at}ms`;
        p.style.strokeDashoffset = '0';
        at += d;
      });
      box.classList.remove('animate-route');
      setTimeout(() => {
        if (done) return;
        paths.forEach(p => { p.style.transition = ''; p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
        box.querySelectorAll('.lakad-end').forEach(e => e.classList.add('route-end'));
      }, duration + 60);
    }, 320);
    return () => { done = true; clearTimeout(t); };
  }, [map, duration]);
  return null;
}

/** Real map with OpenStreetMap tiles. Shown only to the activity's owner. */
export default function RouteMap({ route, follow, here, className = '', animate }: { route: RoutePoint[]; follow?: boolean; here?: [number, number, number] | null; className?: string; animate?: boolean }) {
  if (route.length < 1 && !here) return null;
  const segs = segments(route).map(s => s.map(p => [p[0], p[1]] as LatLngExpression));
  const first = route[0], last = route[route.length - 1];
  const center = here ?? last;
  return (
    <div className={`overflow-hidden rounded-[22px] ${className}`}>
      <MapContainer center={[center[0], center[1]]} zoom={16} className={`h-full w-full ${animate && route.length > 1 ? 'animate-route' : ''}`} attributionControl zoomControl={!follow} scrollWheelZoom={false}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {segs.map((s, i) => <Polyline key={i} positions={s} className="lakad-route" pathOptions={{ color: '#1F4FE0', weight: 5, lineCap: 'round', lineJoin: 'round' }} />)}
        {first && <CircleMarker center={[first[0], first[1]]} radius={6} pathOptions={{ color: '#1F4FE0', fillColor: '#FFFFFF', fillOpacity: 1, weight: 3 }} />}
        {here && here[2] <= 500 && <Circle center={[here[0], here[1]]} radius={here[2]} pathOptions={{ color: '#1F4FE0', weight: 1, fillColor: '#1F4FE0', fillOpacity: 0.12 }} />}
        {here
          ? <CircleMarker center={[here[0], here[1]]} radius={8} pathOptions={{ color: '#FFFFFF', fillColor: '#1F4FE0', fillOpacity: 1, weight: 3 }} />
          : last && <CircleMarker center={[last[0], last[1]]} radius={7} className="lakad-end" pathOptions={{ color: '#FFB627', fillColor: '#FFB627', fillOpacity: 1, weight: 2 }} />}
        <Fit route={route} follow={follow} here={here} />
        {animate && route.length > 1 && <DrawIn />}
      </MapContainer>
    </div>
  );
}
