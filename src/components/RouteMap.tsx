import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, ZoomControl, useMap } from 'react-leaflet';
import { IconLocate } from './icons';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import type { RoutePoint } from '../types';
import { segments } from '../lib/geo';
import { SavedStreets } from './SavedStreets';

/** How long the map waits after your last touch before following you again */
export const FOLLOW_RESUME_MS = 15000;

/**
 * While following: touching the map (drag or pinch) pauses following so it doesn't snap back
 * while you look around; `onFree` reports it so a Re-center button can show. Following comes
 * back on its own after FOLLOW_RESUME_MS without a touch.
 */
function TouchPausesFollow({ follow, free, setFree }: { follow?: boolean; free: boolean; setFree: (v: boolean) => void }) {
  const map = useMap(), timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!follow) return;
    const el = map.getContainer();
    const touched = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.('[data-map-button], .leaflet-control-attribution')) return;
      setFree(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFree(false), FOLLOW_RESUME_MS);
    };
    el.addEventListener('pointerdown', touched); el.addEventListener('wheel', touched, { passive: true });
    return () => { el.removeEventListener('pointerdown', touched); el.removeEventListener('wheel', touched); clearTimeout(timer.current); };
  }, [map, follow, setFree]);
  useEffect(() => { if (!free) clearTimeout(timer.current); }, [free]);
  return null;
}

function Fit({ route, follow, here, free }: { route: RoutePoint[]; follow?: boolean; here?: [number, number, number] | null; free?: boolean }) {
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
      if (free) return;   // you're looking around: leave the map where you put it
      const p = here ?? route[route.length - 1];
      if (p) map.setView([p[0], p[1]], map.getZoom(), { animate: true });   // keeps your zoom
      return;
    }
    if (!route.length) return;
    const b: LatLngBoundsExpression = route.map(p => [p[0], p[1]] as [number, number]);
    map.fitBounds(b, { padding: [24, 24], maxZoom: 17 });
  }, [map, route, follow, here, free]);
  return null;
}

const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--cobalt').trim() || '#1F4FE0';
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
export default function RouteMap({ route, follow, here, className = '', animate, plan, goal, zoomButtons, rounded = true }: { route: RoutePoint[]; follow?: boolean; here?: [number, number, number] | null; className?: string; animate?: boolean; plan?: [number, number][]; goal?: [number, number] | null; zoomButtons?: boolean; rounded?: boolean }) {
  const [free, setFree] = useState(false);
  if (route.length < 1 && !here && !plan?.length) return null;
  const segs = segments(route).map(s => s.map(p => [p[0], p[1]] as LatLngExpression));
  const first = route[0], last = route[route.length - 1];
  const center = here ?? last ?? (plan?.length ? [plan[0][0], plan[0][1], 0] as unknown as RoutePoint : undefined)!;
  return (
    <div className={`relative isolate overflow-hidden ${rounded ? 'rounded-[22px]' : ''} ${className}`}>
      <MapContainer center={[center[0], center[1]]} zoom={16} className={`h-full w-full ${animate && route.length > 1 ? 'animate-route' : ''}`} attributionControl zoomControl={!follow && !zoomButtons} scrollWheelZoom={!!follow}>
        {zoomButtons && <ZoomControl position="bottomright" />}
        <TouchPausesFollow follow={follow} free={free} setFree={setFree} />
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {plan && plan.length > 1 && <Polyline positions={plan} pathOptions={{ color: accentColor(), weight: 5, opacity: 0.45, dashArray: '2 10', lineCap: 'round' }} />}
        {goal && <CircleMarker center={goal} radius={8} pathOptions={{ color: '#0E1B33', weight: 2.5, fillColor: '#FFB627', fillOpacity: 1 }} />}
        {segs.map((s, i) => <Polyline key={i} positions={s} className="lakad-route" pathOptions={{ color: accentColor(), weight: 5, lineCap: 'round', lineJoin: 'round' }} />)}
        {first && <CircleMarker center={[first[0], first[1]]} radius={6} pathOptions={{ color: accentColor(), fillColor: '#FFFFFF', fillOpacity: 1, weight: 3 }} />}
        {here && here[2] <= 500 && <Circle center={[here[0], here[1]]} radius={here[2]} pathOptions={{ color: accentColor(), weight: 1, fillColor: accentColor(), fillOpacity: 0.12 }} />}
        {here
          ? <CircleMarker center={[here[0], here[1]]} radius={8} pathOptions={{ color: '#FFFFFF', fillColor: accentColor(), fillOpacity: 1, weight: 3 }} />
          : last && <CircleMarker center={[last[0], last[1]]} radius={7} className="lakad-end" pathOptions={{ color: '#FFB627', fillColor: '#FFB627', fillOpacity: 1, weight: 2 }} />}
        <SavedStreets />
        <Fit route={route} follow={follow} here={here} free={free} />
        {animate && route.length > 1 && <DrawIn />}
      </MapContainer>
      {follow && free && (
        <button data-map-button type="button" onClick={() => setFree(false)}
          className="absolute bottom-3 left-3 z-[650] flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[14px] font-bold text-cobalt shadow-[var(--lift)] active:scale-95">
          <IconLocate size={18} />Re-center
        </button>
      )}
    </div>
  );
}
