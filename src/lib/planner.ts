import type { LatLng, FootRoute, Router } from './routing';
import { hav } from './geo';

const R = 6371000, rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
/** point `dist` metres from `p` on compass bearing `brg` (degrees) */
export function dest([lat, lng]: LatLng, brg: number, dist: number): LatLng {
  const d = dist / R, b = rad(brg), φ1 = rad(lat), λ1 = rad(lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(b));
  const λ2 = λ1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
  return [deg(φ2), ((deg(λ2) + 540) % 360) - 180];
}

export function lineLength(c: LatLng[]) { let d = 0; for (let i = 1; i < c.length; i++) d += hav(c[i - 1], c[i]); return d; }

/** The exact point along a route where you'll have walked `meters` (null if the route is shorter) */
export function pointAt(c: LatLng[], meters: number): LatLng | null {
  let d = 0;
  for (let i = 1; i < c.length; i++) {
    const s = hav(c[i - 1], c[i]);
    if (d + s >= meters) { const t = s ? (meters - d) / s : 0; return [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]; }
    d += s;
  }
  return null;
}

export interface LoopOption { heading: number; route: FootRoute; error: number }
const NAMES = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const headingName = (h: number) => NAMES[Math.round((((h % 360) + 360) % 360) / 45) % 8];

/**
 * A loop that starts and ends at `start`, heading off toward `heading`, sized to `target` metres.
 * Waypoints sit on a circle through the start; the circle is resized from the real path distance
 * until the loop is within `tolerance` of the target (paths are longer than straight lines, so the
 * first guess allows for that).
 */
export async function fitLoop(router: Router, start: LatLng, target: number, heading: number, tolerance = 0.03, tries = 4, signal?: AbortSignal, extraTries = 0): Promise<LoopOption> {
  const tried: { r: number; d: number }[] = [];
  let radius = target / (2 * Math.PI) / 1.3, best: LoopOption | null = null;
  const shape = (rad: number, turn = 0, skew = 0) => {
    const centre = dest(start, heading + turn, rad), back = heading + turn + 180;
    return [90 - skew, 180, 270 + skew].map(a => dest(centre, back + a, rad));
  };
  for (let i = 0; i < tries; i++) {
    const wps = shape(radius);
    const route = await router([start, ...wps, start], signal);
    const error = (route.distance - target) / target;
    if (!best || Math.abs(error) < Math.abs(best.error)) best = { heading, route, error };
    if (Math.abs(error) <= tolerance) break;
    tried.push({ r: radius, d: route.distance });
    if (tried.length >= 2) {
      // path length ≈ a·radius + b (b = fixed extra like reaching the nearest path): solve for the target
      const [p, q] = tried.slice(-2), slope = (q.d - p.d) / (q.r - p.r);
      const next = slope > 0 ? q.r + (target - q.d) / slope : radius * (target / route.distance);
      radius = Math.max(radius * 0.25, Math.min(radius * 2.5, next));
    } else {
      radius *= Math.max(0.4, Math.min(2, target / route.distance));
    }
    if (radius < 40) radius = 40;
  }
  // when routes are free (on the phone), try nearby sizes and slightly turned shapes and keep the closest
  if (best && Math.abs(best.error) > tolerance && extraTries > 0) {
    const base = tried.length ? tried.reduce((a, b) => (Math.abs(b.d - target) < Math.abs(a.d - target) ? b : a)).r : radius;
    for (let k = 0; k < extraTries && Math.abs(best.error) > tolerance; k++) {
      if (signal?.aborted) break;
      const rad = base * (0.8 + 0.4 * ((k * 7) % extraTries) / extraTries), turn = ((k % 5) - 2) * 9, skew = ((k % 3) - 1) * 12;
      const route = await router([start, ...shape(rad, turn, skew), start], signal);
      const error = (route.distance - target) / target;
      if (Math.abs(error) < Math.abs(best.error)) best = { heading, route, error };
    }
  }
  return best!;
}

/** Three loops in different directions, reported as each one is ready */
export async function suggestLoops(router: Router, start: LatLng, target: number, onOption: (o: LoopOption) => void, signal?: AbortSignal, extraTries = 0) {
  const first = Math.floor(Math.random() * 8) * 45;
  for (const h of [first, first + 120, first + 240]) {
    if (signal?.aborted) return;
    try { onOption(await fitLoop(router, start, target, h % 360, 0.03, 4, signal, extraTries)); } catch (e) { if (signal?.aborted) return; throw e; }
  }
}
