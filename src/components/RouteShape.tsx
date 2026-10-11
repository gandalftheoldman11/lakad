import { fitPath, project, type XY } from '../lib/geo';
import type { RoutePoint } from '../types';

/** Lightweight route drawing (no map tiles). Accepts GPS points or a pre-normalised shape. */
export function RouteShape({ route, shape, w, h, pad = 10, stroke = 4 }: { route?: RoutePoint[]; shape?: [number, number][]; w: number; h: number; pad?: number; stroke?: number }) {
  const xy: XY[] | null = route ? project(route) : shape && shape.length > 1 ? shape.map(([x, y]) => [x, y] as XY) : null;
  const f = fitPath(xy, w, h, pad);
  if (!f) return null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden="true">
      <path d={f.d} fill="none" stroke="var(--cobalt)" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={f.start[0]} cy={f.start[1]} r={stroke * 1.3} fill="var(--surface)" stroke="var(--cobalt)" strokeWidth={stroke * 0.7} />
      <circle cx={f.end[0]} cy={f.end[1]} r={stroke * 1.4} fill="var(--mango)" />
    </svg>
  );
}
