import type { RoutePoint } from '../types';

export function hav(a: readonly number[], b: readonly number[]) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Distance along a route, skipping the gaps created by pauses */
export function routeDistance(route: RoutePoint[]) {
  let d = 0;
  for (let i = 1; i < route.length; i++) if (!route[i][3]) d += hav(route[i - 1], route[i]);
  return d;
}

/** Split route into segments (a new one starts after each pause) */
export function segments(route: RoutePoint[]): RoutePoint[][] {
  const out: RoutePoint[][] = [];
  for (const p of route) {
    if (!out.length || p[3]) out.push([]);
    out[out.length - 1].push(p);
  }
  return out;
}

export type XY = [number, number, number?];
/** Equirectangular projection to local x/y (y grows downward) */
export function project(points: readonly (readonly number[])[]): XY[] | null {
  if (!points || points.length < 2) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity;
  for (const p of points) { minLat = Math.min(minLat, p[0]); maxLat = Math.max(maxLat, p[0]); minLng = Math.min(minLng, p[1]); }
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  return points.map(p => [(p[1] - minLng) * k, maxLat - p[0], p[3] ? 1 : 0]);
}

export function fitPath(xy: XY[] | null, w: number, h: number, pad: number) {
  if (!xy || xy.length < 2) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of xy) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const rw = Math.max(maxX - minX, 1e-9), rh = Math.max(maxY - minY, 1e-9);
  const s = Math.min((w - 2 * pad) / rw, (h - 2 * pad) / rh);
  const ox = (w - rw * s) / 2, oy = (h - rh * s) / 2;
  const pts = xy.map(([x, y, b]) => [ox + (x - minX) * s, oy + (y - minY) * s, b ?? 0] as const);
  const d = pts.map((p, i) => (i === 0 || p[2] ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
  return { d, start: pts[0], end: pts[pts.length - 1] };
}

/** Normalised route shape (0..1000) for sharing. Contains no coordinates. */
export function shapeFromRoute(route: RoutePoint[]): [number, number][] {
  const xy = project(route);
  if (!xy) return [];
  let maxX = 0, maxY = 0;
  for (const [x, y] of xy) { maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const s = 1000 / Math.max(maxX, maxY, 1e-9), step = Math.max(1, Math.ceil(xy.length / 150));
  const out: [number, number][] = [];
  for (let i = 0; i < xy.length; i += step) out.push([Math.round(xy[i][0] * s), Math.round(xy[i][1] * s)]);
  const last = xy[xy.length - 1];
  out.push([Math.round(last[0] * s), Math.round(last[1] * s)]);
  return out;
}

export interface Split { n: number; sec: number; partial?: number }
/** Time for each full unit (km or mile), plus a trailing partial split */
export function splitsOf(route: RoutePoint[], unit: number): Split[] {
  if (!route || route.length < 2) return [];
  const out: Split[] = [];
  let cum = 0, lastT = 0, next = unit;
  for (let i = 1; i < route.length; i++) {
    if (route[i][3]) continue;
    const seg = hav(route[i - 1], route[i]);
    if (!seg) continue;
    const t0 = route[i - 1][2], t1 = route[i][2];
    while (cum + seg >= next) {
      const t = t0 + (t1 - t0) * ((next - cum) / seg);
      out.push({ n: out.length + 1, sec: t - lastT });
      lastT = t; next += unit;
    }
    cum += seg;
  }
  const rem = cum - (next - unit);
  if (rem > unit * 0.1) out.push({ n: out.length + 1, sec: route[route.length - 1][2] - lastT, partial: rem / unit });
  return out;
}

/** Keep at most `max` points, always keeping pause boundaries and the last point */
export function thinRoute(route: RoutePoint[], max = 600): RoutePoint[] {
  if (route.length <= max) return route;
  const k = Math.ceil(route.length / max);
  return route.filter((p, i) => i % k === 0 || p[3] || (i + 1 < route.length && route[i + 1][3]) || i === route.length - 1);
}

/**
 * Privacy zone: removes the first and last `meters` of a route (measured along the path),
 * so shared images, GPX files and feed posts don't reveal where you start and finish, often your home.
 * Routes shorter than both zones plus 50 m are hidden completely.
 */
export function trimRoute(route: RoutePoint[], meters: number): RoutePoint[] {
  if (!meters || route.length < 2) return route;
  const cum = [0];
  for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + (route[i][3] ? 0 : hav(route[i - 1], route[i])));
  const total = cum[cum.length - 1];
  if (total < meters * 2 + 50) return [];
  const kept = route.filter((_, i) => cum[i] >= meters && cum[i] <= total - meters);
  if (kept.length && kept[0][3]) kept[0] = [kept[0][0], kept[0][1], kept[0][2]];
  return kept.length > 1 ? kept : [];
}
