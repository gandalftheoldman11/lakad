/**
 * Walking routes along real streets and paths, from the FOSSGIS OpenStreetMap routing server
 * (routing.openstreetmap.de, OSRM with the foot profile). Their terms: free, non-commercial use,
 * about one request per second, and credit to OpenStreetMap and OSRM, which the planner shows.
 */
export type LatLng = [number, number];
export interface FootRoute { coords: LatLng[]; distance: number }
export type Router = (points: LatLng[], signal?: AbortSignal) => Promise<FootRoute>;

export const ROUTING_CREDIT = 'Routes: OSRM by FOSSGIS · © OpenStreetMap contributors';
const BASE = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';

let lastCall = 0;
const cache = new Map<string, FootRoute>();
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** One request per second at most, cached, with a timeout */
export const footRoute: Router = async (points, signal) => {
  const key = points.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).join(';');
  const hit = cache.get(key);
  if (hit) return hit;
  const gap = lastCall + 1100 - Date.now();
  if (gap > 0) await wait(gap);
  lastCall = Date.now();
  const url = `${BASE}${points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';')}?overview=full&geometries=geojson`;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  signal?.addEventListener('abort', () => ctl.abort());
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(res.status === 429 ? 'busy' : 'failed');
    const j = await res.json() as { code: string; routes?: { distance: number; geometry: { coordinates: [number, number][] } }[] };
    if (j.code !== 'Ok' || !j.routes?.length) throw new Error('noroute');
    const r = j.routes[0];
    const out: FootRoute = { distance: r.distance, coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
    cache.set(key, out);
    return out;
  } finally { clearTimeout(t); }
};
