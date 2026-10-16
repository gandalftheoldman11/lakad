import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Badge } from './Badge';
import { BADGES, type Element } from '../lib/badges';
import { tapFeel } from '../lib/alerts';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const v = (o: Record<string, string | number>) => o as CSSProperties;

/** One particle shape per element, drawn around (0,0) */
function Particle({ el, color, i }: { el: Element; color: string; i: number }) {
  switch (el) {
    case 'frost':
      return <path d="M0 -6 V6 M-5.2 -3 L5.2 3 M-5.2 3 L5.2 -3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />;
    case 'ember':
    case 'fire':
      return <><circle r={i % 3 ? 5 : 7} fill={color} opacity=".3" /><circle r={i % 3 ? 2.6 : 3.4} fill={color} /><circle r="1.2" fill="#FFF6D5" /></>;
    case 'leaf':
      return <><path d="M0 -7 C 5.5 -3 5.5 3 0 7 C -5.5 3 -5.5 -3 0 -7 Z" fill={color} /><path d="M0 -6.5 V6.5" stroke="#fff" strokeOpacity=".5" strokeWidth="1" /></>;
    case 'water':
      return i % 2
        ? <circle r="4" fill={color} fillOpacity=".25" stroke={color} strokeWidth="1.5" />
        : <path d="M0 -6 C 3.5 -1 4 2 0 5 C -4 2 -3.5 -1 0 -6 Z" fill={color} />;
    case 'storm':
      return <g strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M-8 0 L-3 -3 L1 2 L5 -2 L9 1" stroke={color} strokeWidth="4" opacity=".3" /><path d="M-8 0 L-3 -3 L1 2 L5 -2 L9 1" stroke="#fff" strokeWidth="1.4" /></g>;
    case 'wind':
      return <path d="M-9 3 C -4 -3 4 -3 9 2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />;
    case 'cosmic':
      return <path d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill={i % 3 ? color : '#fff'} />;
  }
}

/** Particles flying outward from the centre, plus a shockwave ring. Remount (new key) to replay. */
export function Burst({ level, big = false }: { level: number; big?: boolean }) {
  const b = BADGES[Math.max(0, Math.min(BADGES.length - 1, level - 1))];
  const n = big ? 22 : 12, dist = big ? 92 : 64;
  return (
    <svg viewBox="-100 -100 200 200" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <circle className="burst-ring" r="30" fill="none" stroke={b.colors.fx} strokeWidth={big ? 4 : 3} />
      {big && <circle className="burst-ring" style={{ animationDelay: '.12s' }} r="30" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2" />}
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
        const d = dist * (0.72 + ((i * 37) % 10) / 30);
        const deg = (a * 180) / Math.PI;
        return (
          <g key={i} className="burst-p" style={v({ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, '--rot': `${(i % 2 ? 1 : -1) * 90}deg`, '--dur': `${big ? 1.15 : 0.85}s`, animationDelay: `${(i % 4) * 0.025}s` })}>
            <g transform={b.element === 'storm' || b.element === 'wind' ? `rotate(${deg})` : `scale(${big ? 1.25 : 1})`}>
              <Particle el={b.element} color={b.colors.fx} i={i} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** Your own badge: tap it for a squash-and-bounce, a light buzz and a burst of its element */
export function TappableBadge({ level, size, label }: { level: number; size: number; label?: string }) {
  const [shot, setShot] = useState(0);
  const tap = () => { setShot(x => x + 1); void tapFeel(); };
  return (
    <button type="button" onClick={tap} aria-label={label ?? `${BADGES[level - 1]?.name} badge. Tap for a burst.`}
      className="relative inline-grid shrink-0 place-items-center outline-none [-webkit-tap-highlight-color:transparent]">
      <span key={`b${shot}`} className={shot ? 'bdg-tap' : ''}><Badge level={level} size={size} /></span>
      {shot > 0 && !reducedMotion() && <span key={`p${shot}`} className="pointer-events-none absolute -inset-[45%]"><Burst level={level} /></span>}
    </button>
  );
}

/** The level-up stage: an entrance in the badge's element, then a big burst as it lands */
export function LevelUpStage({ level, size, children }: { level: number; size: number; children?: ReactNode }) {
  const b = BADGES[Math.max(0, Math.min(BADGES.length - 1, level - 1))];
  const [landed, setLanded] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setLanded(true); void tapFeel(); }, 520); return () => clearTimeout(t); }, []);
  const still = reducedMotion();
  const fx = b.colors.fx;
  return (
    <div className="relative grid h-[300px] place-items-center overflow-hidden">
      {/* backdrop per element */}
      {b.element === 'cosmic' && (
        <svg viewBox="0 0 200 200" className="bdg-rays absolute h-[300px] w-[300px] opacity-70" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => <path key={i} d="M100 100 L95 0 L105 0 Z" fill={fx} opacity={i % 2 ? 0.2 : 0.4} transform={`rotate(${i * 22.5} 100 100)`} />)}
        </svg>
      )}
      {b.element === 'fire' && !still && (
        <svg viewBox="0 0 200 200" className="absolute h-[300px] w-[300px]" aria-hidden="true">
          <defs><radialGradient id="luFlame" cx="50%" cy="100%" r="100%"><stop offset="0" stopColor="#FFF2A8" /><stop offset=".45" stopColor="#FFB13D" /><stop offset="1" stopColor="#FF4D1F" stopOpacity="0" /></radialGradient></defs>
          {[[-48, 70], [-26, 96], [0, 118], [26, 96], [48, 70]].map(([dx, h], i) => (
            <path key={i} className="lu-flame" style={{ animationDelay: `${0.1 + i * 0.06}s` }}
              d={`M${100 + dx - 18} 170 C ${100 + dx - 22} ${170 - h * 0.5} ${100 + dx - 4} ${170 - h * 0.8} ${100 + dx} ${170 - h} C ${100 + dx + 4} ${170 - h * 0.8} ${100 + dx + 22} ${170 - h * 0.5} ${100 + dx + 18} 170 Z`} fill="url(#luFlame)" />
          ))}
        </svg>
      )}
      {b.element === 'water' && !still && (
        <svg viewBox="0 0 200 200" className="absolute h-[300px] w-[300px]" aria-hidden="true">
          {[0, 0.25, 0.5].map(d => <ellipse key={d} className="lu-ripple" style={{ animationDelay: `${0.45 + d}s` }} cx="100" cy="100" rx="50" ry="50" fill="none" stroke={fx} strokeWidth="3" />)}
        </svg>
      )}
      {b.element === 'storm' && !still && (
        <>
          <svg viewBox="0 0 200 300" className="lu-strike absolute top-0 h-[300px] w-[200px]" aria-hidden="true">
            <path d="M104 0 L92 60 L108 70 L88 140 L104 148 L96 190" fill="none" stroke={fx} strokeWidth="10" strokeLinejoin="round" opacity=".35" />
            <path d="M104 0 L92 60 L108 70 L88 140 L104 148 L96 190" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
          </svg>
          <div className="lu-flash pointer-events-none absolute inset-0 bg-white" />
        </>
      )}
      {(b.element === 'frost' || b.element === 'leaf' || b.element === 'ember' || b.element === 'wind') && (
        <div className="lu-glow absolute h-[220px] w-[220px] rounded-full" style={{ background: `radial-gradient(circle, ${fx}66 0%, ${fx}00 70%)` }} />
      )}

      <div className="bdg-pop relative"><TappableBadge level={level} size={size} /></div>
      {landed && !still && <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="relative" style={{ width: size * 1.9, height: size * 1.9 }}><Burst level={level} big /></div></div>}
      {children}
    </div>
  );
}
