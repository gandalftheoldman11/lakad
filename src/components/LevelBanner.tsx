import type { CSSProperties, ReactNode } from 'react';
import { Badge } from './Badge';
import { Particle } from './BadgeFx';
import { BADGES } from '../lib/badges';

/*
 * The top of a friend's profile card, styled by their level. Effects grow with level:
 *   Starter–Walker      clean banner in the level's colours with its badge
 *   Hiker–Trailblazer   + the level's element decorations (still)
 *   Pathfinder–Summit   + the decorations gently move
 *   Legend              + a slow golden shimmer around the card
 * Movement switches off with Reduce Motion (index.css).
 */

const v = (o: Record<string, string | number>) => o as CSSProperties;
/** decoration spots in a 360 x 200 banner: [x, y, size, rotation] — composed around the badge, clear of the centre */
const SPOTS: [number, number, number, number][] = [
  [64, 52, 1.5, 20], [100, 132, 1.1, -30], [42, 150, 0.9, 60], [118, 34, 0.8, -10],
  [296, 48, 1.4, -25], [262, 140, 1.15, 35], [318, 150, 0.9, -60], [244, 30, 0.75, 15]
];

export function LevelBanner({ level, animate = true, children }: { level: number; animate?: boolean; children?: ReactNode }) {
  const L = Math.max(1, Math.min(BADGES.length, level));
  const b = BADGES[L - 1], c = b.colors;
  const deco = L >= 4, moving = animate && L >= 6, legend = L >= 8;
  const id = `lb${L}`;
  const banner = (
    <div className="relative h-[200px] overflow-hidden rounded-[24px]" style={{ background: `linear-gradient(150deg, ${c.panelTop ?? c.faceDark}, ${c.panelBottom ?? c.face})` }}>
      <svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id={`${id}g`} cx="50%" cy="48%" r="50%"><stop offset="0" stopColor={c.fx} stopOpacity=".45" /><stop offset="1" stopColor={c.fx} stopOpacity="0" /></radialGradient>
          <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" /></linearGradient>
        </defs>
        {/* soft contour lines, like the share cards */}
        {[0, 1, 2, 3, 4].map(i => <ellipse key={i} cx="180" cy="100" rx={70 + i * 34} ry={44 + i * 22} fill="none" stroke="#fff" strokeOpacity={0.07 - i * 0.008} strokeWidth="1.2" />)}
        <circle cx="180" cy="96" r="120" fill={`url(#${id}g)`} />
        {/* Legend: golden rays turning slowly behind the badge */}
        {legend && (
          <g className={moving ? 'bdg-rays' : ''} style={{ transformOrigin: '180px 96px' }} opacity=".5">
            {Array.from({ length: 16 }, (_, i) => <path key={i} d="M180 96 L172 -60 L188 -60 Z" fill={c.fx} opacity={i % 2 ? 0.25 : 0.5} transform={`rotate(${i * 22.5} 180 96)`} />)}
          </g>
        )}
        {/* the level's element, arranged around the badge */}
        {deco && SPOTS.map(([x, y, s, r], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <g className={moving ? (b.element === 'storm' ? 'fx-bolt' : 'fc-float') : ''} style={v({ animationDelay: `${(i * 0.37) % 2.4}s`, '--fc-rot': `${r}deg` })}>
              <g transform={`rotate(${r}) scale(${s * 1.6})`} opacity={moving ? 1 : 0.85}><Particle el={b.element} color={c.fx} i={i} /></g>
            </g>
          </g>
        ))}
        <rect width="360" height="200" fill={`url(#${id}v)`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center pb-2">
        <Badge level={L} size={L >= 6 ? 210 : 150} animate={moving} title={`${b.name} badge`} />
      </div>
      {children}
    </div>
  );
  if (!legend) return banner;
  // Legend: a slow golden shimmer runs around the card's edge
  return <div className={`rounded-[26px] p-[2.5px] ${moving ? 'legend-ring' : ''}`} style={{ background: moving ? undefined : 'linear-gradient(135deg,#FFE27A,#F2A100,#FFE27A)' }}>{banner}</div>;
}
