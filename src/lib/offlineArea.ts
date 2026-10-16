import { get, set, del } from 'idb-keyval';
import { createStore } from './store';
import type { LatLng, FootRoute, Router } from './routing';
import { footRoute } from './routing';

/*
 * Offline walking routes.
 * "Save my area" downloads every walkable street and path within a radius from OpenStreetMap
 * (Overpass API, fair use) and keeps it on the phone. Routes inside that area are then found on the
 * phone itself (A* search over the street network): instant, no data needed, no server load.
 * The same data draws a simple street map when map images can't load.
 */

const OVERPASS = 'https://overpass-api.de/api/interpreter';
export const AREA_RADIUS = 15000;
/** street classes for drawing: 0 = main road, 1 = street, 2 = path */
export type StreetClass = 0 | 1 | 2;

export interface SavedArea {
  center: LatLng; radius: number; savedAt: number;
  lat: Float64Array; lng: Float64Array;          // node coordinates
  adjStart: Uint32Array; adjTo: Uint32Array; adjLen: Float32Array;   // edges (compressed lists)
  ways: { cls: StreetClass; nodes: Uint32Array }[];                 // for drawing
  bytes: number;
}

export const offline = createStore({ area: null as SavedArea | null, loaded: false, saving: false, progress: '' as string, error: '' as string, online: typeof navigator === 'undefined' ? true : navigator.onLine });
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => offline.set({ online: true }));
  window.addEventListener('offline', () => offline.set({ online: false }));
}

const R = 6371000, toRad = Math.PI / 180;
function dist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dp = (lat2 - lat1) * toRad, dl = (lng2 - lng1) * toRad;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Overpass answer → compact street network */
export function buildArea(osm: { elements: { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }[] }, center: LatLng, radius: number): SavedArea {
  const idx = new Map<number, number>(), lat: number[] = [], lng: number[] = [];
  for (const e of osm.elements) if (e.type === 'node' && e.lat != null && e.lon != null) { idx.set(e.id, lat.length); lat.push(e.lat); lng.push(e.lon); }
  const nbrs: { to: number; len: number }[][] = lat.map(() => []);
  const ways: SavedArea['ways'] = [];
  for (const e of osm.elements) {
    if (e.type !== 'way' || !e.nodes) continue;
    const h = e.tags?.highway ?? '';
    const cls: StreetClass = /^(primary|secondary|tertiary|trunk)/.test(h) ? 0 : /^(footway|path|steps|pedestrian|track|cycleway|bridleway)$/.test(h) ? 2 : 1;
    const ns = e.nodes.map(id => idx.get(id)).filter((i): i is number => i != null);
    if (ns.length < 2) continue;
    ways.push({ cls, nodes: Uint32Array.from(ns) });
    for (let k = 1; k < ns.length; k++) {
      const a = ns[k - 1], b = ns[k], len = dist(lat[a], lng[a], lat[b], lng[b]);
      nbrs[a].push({ to: b, len }); nbrs[b].push({ to: a, len });
    }
  }
  const adjStart = new Uint32Array(lat.length + 1); let total = 0;
  nbrs.forEach((l, i) => { adjStart[i] = total; total += l.length; }); adjStart[lat.length] = total;
  const adjTo = new Uint32Array(total), adjLen = new Float32Array(total);
  nbrs.forEach((l, i) => l.forEach((e, j) => { adjTo[adjStart[i] + j] = e.to; adjLen[adjStart[i] + j] = e.len; }));
  const area: SavedArea = { center, radius, savedAt: Date.now(), lat: Float64Array.from(lat), lng: Float64Array.from(lng), adjStart, adjTo, adjLen, ways, bytes: 0 };
  area.bytes = lat.length * 16 + total * 8 + ways.reduce((s, w) => s + w.nodes.length * 4 + 8, 0);
  return area;
}

/* ---------- route finding on the phone ---------- */

/** nearest street node, using a coarse grid so it stays fast with tens of thousands of nodes */
const grids = new WeakMap<SavedArea, Map<string, number[]>>();
const CELL = 0.002;   // about 220 m
function grid(a: SavedArea) {
  let g = grids.get(a);
  if (!g) {
    g = new Map();
    for (let i = 0; i < a.lat.length; i++) {
      if (a.adjStart[i + 1] === a.adjStart[i]) continue;   // not on any street
      const k = `${Math.floor(a.lat[i] / CELL)},${Math.floor(a.lng[i] / CELL)}`;
      (g.get(k) ?? g.set(k, []).get(k)!).push(i);
    }
    grids.set(a, g);
  }
  return g;
}
export function nearestNode(a: SavedArea, [plat, plng]: LatLng, maxM = 400): number | null {
  const g = grid(a), ci = Math.floor(plat / CELL), cj = Math.floor(plng / CELL);
  let best = -1, bestD = Infinity;
  for (let r = 0; r <= 2; r++) {
    for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      for (const i of g.get(`${ci + di},${cj + dj}`) ?? []) { const d = dist(plat, plng, a.lat[i], a.lng[i]); if (d < bestD) { bestD = d; best = i; } }
    }
    if (best >= 0 && bestD < CELL * 111000 * r) break;
  }
  return best >= 0 && bestD <= maxM ? best : null;
}

/** A* shortest walking path between two nodes; returns node list or null */
function astar(a: SavedArea, s: number, t: number): number[] | null {
  if (s === t) return [s];
  const n = a.lat.length, g = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const h = (i: number) => dist(a.lat[i], a.lng[i], a.lat[t], a.lng[t]);
  // binary heap of [f, node]
  const hf: number[] = [], hn: number[] = [];
  const push = (f: number, v: number) => { hf.push(f); hn.push(v); let i = hf.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [hf[p], hf[i]] = [hf[i], hf[p]]; [hn[p], hn[i]] = [hn[i], hn[p]]; i = p; } };
  const pop = () => { const v = hn[0], lf = hf.pop()!, ln = hn.pop()!; if (hf.length) { hf[0] = lf; hn[0] = ln; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hf.length && hf[l] < hf[m]) m = l; if (r < hf.length && hf[r] < hf[m]) m = r; if (m === i) break; [hf[m], hf[i]] = [hf[i], hf[m]]; [hn[m], hn[i]] = [hn[i], hn[m]]; i = m; } } return v; };
  g[s] = 0; push(h(s), s);
  while (hf.length) {
    const u = pop();
    if (closed[u]) continue;
    if (u === t) { const path = [t]; let c = t; while (prev[c] >= 0) { c = prev[c]; path.push(c); } return path.reverse(); }
    closed[u] = 1;
    for (let e = a.adjStart[u]; e < a.adjStart[u + 1]; e++) {
      const v = a.adjTo[e], ng = g[u] + a.adjLen[e];
      if (ng < g[v]) { g[v] = ng; prev[v] = u; push(ng + h(v), v); }
    }
  }
  return null;
}

/** true when every point is inside the saved area (with a small margin) */
export function covers(a: SavedArea | null, points: LatLng[]) {
  return !!a && points.every(p => dist(p[0], p[1], a.center[0], a.center[1]) <= a.radius * 0.97);
}

/** Router that works on the phone: same shape as the online one */
export function localRouter(a: SavedArea): Router {
  return async points => {
    const coords: LatLng[] = []; let distance = 0;
    for (let k = 1; k < points.length; k++) {
      const s = nearestNode(a, points[k - 1]), t = nearestNode(a, points[k]);
      if (s == null || t == null) throw new Error('nostreet');
      const path = astar(a, s, t);
      if (!path) throw new Error('noroute');
      // include the short walk from where you are to the first street
      if (k === 1) { const [p0] = points; const d0 = dist(p0[0], p0[1], a.lat[s], a.lng[s]); if (d0 > 5) { coords.push(p0); } }
      for (let i = 0; i < path.length; i++) {
        const p: LatLng = [a.lat[path[i]], a.lng[path[i]]];
        if (coords.length) distance += dist(coords[coords.length - 1][0], coords[coords.length - 1][1], p[0], p[1]);
        if (!(k > 1 && i === 0)) coords.push(p);
      }
    }
    // ...and from the last street point to where you're going
    const pl = points[points.length - 1], last = coords[coords.length - 1];
    if (last && dist(pl[0], pl[1], last[0], last[1]) > 5) { distance += dist(pl[0], pl[1], last[0], last[1]); coords.push(pl); }
    return { coords, distance } as FootRoute;
  };
}

/** Best router right now: on the phone inside your saved area, otherwise the online service */
export const smartRouter: Router = async (points, signal) => {
  const a = offline.get().area;
  if (covers(a, points)) return localRouter(a!)(points, signal);
  if (!navigator.onLine) throw new Error(a ? 'outside' : 'offline');
  return footRoute(points, signal);
};

/* ---------- saving and loading ---------- */

export async function loadArea() {
  try {
    const raw = await get('offlineArea') as (Omit<SavedArea, 'ways'> & { ways: { cls: StreetClass; nodes: Uint32Array }[] }) | undefined;
    offline.set({ area: raw ?? null, loaded: true });
  } catch { offline.set({ loaded: true }); }
}

export async function saveAreaAround(center: LatLng, radius = AREA_RADIUS) {
  offline.set({ saving: true, error: '', progress: 'Downloading streets and paths (can take a minute)…' });
  try {
    // walkable ways with their tags (for street types), then just the coordinates of their nodes
    const q = `[out:json][timeout:180];way["highway"]["highway"!~"^(motorway|motorway_link|trunk_link|construction|proposed|raceway|bus_guideway|elevator|corridor)$"]["foot"!~"^(no)$"]["access"!~"^(private|no)$"](around:${radius},${center[0].toFixed(5)},${center[1].toFixed(5)})->.w;.w out body qt;node(w.w);out skel qt;`;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 200000);
    const res = await fetch(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: q }), signal: ctl.signal }).finally(() => clearTimeout(t));
    if (!res.ok) throw new Error(res.status === 429 || res.status === 504 ? 'busy' : 'failed');
    const json = await res.json();
    offline.set({ progress: 'Preparing your area…' });
    const area = buildArea(json, center, radius);
    if (area.lat.length < 10) throw new Error('empty');
    await set('offlineArea', area);
    offline.set({ area, saving: false, progress: '' });
    return area;
  } catch (e) {
    const m = (e as Error).message;
    offline.set({ saving: false, progress: '', error: m === 'busy' ? 'The map download service is busy. Try again in a minute.' : m === 'empty' ? 'No streets found around here.' : 'Couldn’t download your area. Check your connection.' });
    throw e;
  }
}

export async function deleteArea() { try { await del('offlineArea'); } catch { /* noop */ } offline.set({ area: null }); }
