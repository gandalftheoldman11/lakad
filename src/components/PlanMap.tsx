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

function Taps({ onTap, off }: { onTap?: (p: LatLng) => void; off?: boolean }) {
  useMapEvents({ click: e => { if (!off) onTap?.([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

/**
 * Freehand drawing: with Draw on, one finger traces the way you want to walk (the map doesn't pan);
 * a short touch counts as a tap. A second finger (pinch to zoom) cancels the stroke.
 */
function Freehand({ on, onStroke, onTap }: { on: boolean; onStroke?: (pts: LatLng[]) => void; onTap?: (p: LatLng) => void }) {
  const map = useMap();
  // latest callbacks without re-attaching listeners (which would cancel a stroke in progress)
  const cb = useRef({ onStroke, onTap }); cb.current = { onStroke, onTap };
  useEffect(() => {
    if (!on) return;
    map.dragging.disable(); map.doubleClickZoom.disable();
    const el = map.getContainer(), col = accent();
    const down = new Set<number>();
    let pts: L.Point[] = [], line: L.Polyline | null = null, active = -1;
    const ll = (p: L.Point) => map.containerPointToLatLng(p);
    const cancel = () => { line?.remove(); line = null; pts = []; active = -1; };
    const start = (e: PointerEvent) => {
      down.add(e.pointerId);
      if (down.size > 1) { cancel(); return; }   // pinch: let the map zoom
      const t = e.target as HTMLElement;
      // controls and route points (for dragging) keep their own touch; the last point is where you continue drawing from
      if (t.closest('.leaflet-control, [data-map-button]') || (t.closest('.leaflet-marker-icon') && !t.closest('.plan-pt-last'))) return;
      e.stopPropagation(); e.preventDefault();
      active = e.pointerId; pts = [map.mouseEventToContainerPoint(e as unknown as MouseEvent)];
      line = L.polyline([ll(pts[0])], { color: col, weight: 5, opacity: 0.6, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(map);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== active || !line) return;
      const p = map.mouseEventToContainerPoint(e as unknown as MouseEvent);
      if (p.distanceTo(pts[pts.length - 1]) < 5) return;
      pts.push(p); line.addLatLng(ll(p));
    };
    const end = (e: PointerEvent) => {
      down.delete(e.pointerId);
      if (e.pointerId !== active) return;
      const travel = pts.reduce((d, p, i) => (i ? d + p.distanceTo(pts[i - 1]) : 0), 0);
      const done = pts.map(p => { const q = ll(p); return [q.lat, q.lng] as LatLng; });
      cancel();
      if (travel < 14) { if (done.length) cb.current.onTap?.(done[0]); } else cb.current.onStroke?.(done);
    };
    el.addEventListener('pointerdown', start); el.addEventListener('pointermove', move);
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    el.style.touchAction = 'none'; el.style.cursor = 'crosshair';
    return () => {
      cancel(); map.dragging.enable(); map.doubleClickZoom.enable();
      el.removeEventListener('pointerdown', start); el.removeEventListener('pointermove', move);
      removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
      el.style.touchAction = ''; el.style.cursor = '';
    };
  }, [map, on]);
  return null;
}

/** a route point you can drag to adjust the route */
const pointIcon = (_n: number, last = false) => L.divIcon({ className: `plan-pt${last ? ' plan-pt-last' : ''}`, iconSize: [30, 30], iconAnchor: [15, 15],
  // a small dot with a generous invisible touch area; the last point gets a ring: draw on from here
  html: last
    ? `<span style="display:grid;place-items:center;width:30px;height:30px"><span style="width:20px;height:20px;border-radius:50%;background:#fff;border:5px solid ${accent()};box-shadow:0 0 0 4px ${accent()}33,0 2px 6px rgba(0,0,0,.3);box-sizing:border-box"></span></span>`
    : `<span style="display:grid;place-items:center;width:30px;height:30px"><span style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid ${accent()};box-shadow:0 1px 4px rgba(0,0,0,.3);box-sizing:border-box"></span></span>` });
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
    // leave room at the top for the Draw / Move switch
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map(p => L.latLng(p[0], p[1]))), { paddingTopLeft: [28, 68], paddingBottomRight: [28, 30], animate: true });
    else if (center) map.setView(center, Math.max(map.getZoom(), 15), { animate: true });
  }, [map, points, center]);
  return null;
}

export interface MapOption { coords: LatLng[]; active: boolean; onPick?: () => void }

/** Map for planning: tap to add points, shows the route, other suggestions, the start and the goal flag */
export default function PlanMap({ center, start, waypoints = [], route = [], options = [], goal, goalLabel, onTap, className = '', drawing = false, onStroke, onMovePoint }: {
  center: LatLng | null; start: LatLng | null; waypoints?: LatLng[]; route?: LatLng[]; options?: MapOption[];
  goal?: LatLng | null; goalLabel?: string; onTap?: (p: LatLng) => void; className?: string;
  drawing?: boolean; onStroke?: (pts: LatLng[]) => void; onMovePoint?: (i: number, p: LatLng) => void;
}) {
  const col = accent();
  const fitTo = route.length > 1 ? route : options.find(o => o.active)?.coords ?? [];
  return (
    <div className={`isolate overflow-hidden rounded-[20px] ${className}`}>
      <MapContainer center={center ?? [12.5, 122]} zoom={center ? 15 : 5} className="h-full w-full" zoomControl={false} attributionControl>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Routes: OSRM/FOSSGIS`} />
        <SavedStreets />
        <Taps onTap={onTap} off={drawing} />
        <Freehand on={drawing} onStroke={onStroke} onTap={onTap} />
        <Fit points={fitTo} center={center} />
        {options.filter(o => !o.active).map((o, i) => (
          <Polyline key={`o${i}`} positions={o.coords} pathOptions={{ color: col, weight: 4, opacity: 0.35 }} eventHandlers={{ click: () => o.onPick?.() }} />
        ))}
        {options.filter(o => o.active).map((o, i) => (
          <Polyline key={`ac${i}`} positions={o.coords} interactive={false} pathOptions={{ color: '#0E1B33', opacity: 0.55, weight: 9.5, lineCap: 'round', lineJoin: 'round' }} />
        ))}
        {options.filter(o => o.active).map((o, i) => (
          <Polyline key={`a${i}`} positions={o.coords} pathOptions={{ color: col, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />
        ))}
        {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#0E1B33', opacity: 0.55, weight: 9.5, lineCap: 'round', lineJoin: 'round' }} interactive={false} />}
        {route.length > 1 && <Polyline positions={route} pathOptions={{ color: col, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />}
        {waypoints.length <= 40
          ? waypoints.map((p, i) => <Marker key={`w${i}-${p[0]}-${p[1]}-${i === waypoints.length - 1 && drawing}`} position={p} icon={pointIcon(i + 1, i === waypoints.length - 1 && drawing)} draggable={!!onMovePoint && !(i === waypoints.length - 1 && drawing)} keyboard={false}
              eventHandlers={{ dragend: e => { const q = (e.target as L.Marker).getLatLng(); onMovePoint?.(i, [q.lat, q.lng]); } }} />)
          : waypoints.map((p, i) => <CircleMarker key={`w${i}`} center={p} radius={4} pathOptions={{ color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 }} />)}
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
