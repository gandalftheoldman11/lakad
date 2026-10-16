import { useId, type CSSProperties } from 'react';
import { BADGES, type Element } from '../lib/badges';

/*
 * Lakad level badges: flat, vibrant hexagon frames with a footprint in the middle.
 * Every level has the three-block bottom band; higher levels add side ears, a crystal on top,
 * two-tone corner spikes, flat layered wings, a crown and an aura. Each level also has an
 * element effect (frost, ember, leaf, water, storm, wind, fire, cosmic). Animations live in
 * index.css (.bdg-*, .fx-*) and switch off with Reduce Motion.
 */

const CX = 80, CY = 62, R = 44;
const P = (r: number, i: number, cy = CY): [number, number] => {
  const a = (Math.PI / 180) * (60 * i - 90);
  return [CX + r * Math.cos(a), cy + r * Math.sin(a)];
};
const pts = (arr: [number, number][]) => arr.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
const hex = (r: number, cy = CY) => pts([0, 1, 2, 3, 4, 5].map(i => P(r, i, cy)));

/** footprint: arched sole and five toes */
function FootShape({ fill }: { fill: string }) {
  return (
    <>
      <path d="M2 -10 C 10.5 -10 12.8 -3 11.2 5 C 10.2 10 7.2 12 6.6 15.5 C 6 19.5 4 23.5 -0.5 23.5 C -6.2 23.5 -8.8 19 -7.8 13 C -7 9 -4.6 7.4 -5.6 3 C -6.6 -2.4 -6.6 -10 2 -10 Z" fill={fill} />
      <ellipse cx="-5.4" cy="-15.6" rx="3.9" ry="4.7" fill={fill} />
      <ellipse cx="1.2" cy="-18.4" rx="3.1" ry="3.8" fill={fill} />
      <ellipse cx="6.5" cy="-16.8" rx="2.7" ry="3.3" fill={fill} />
      <ellipse cx="10.6" cy="-13.2" rx="2.2" ry="2.8" fill={fill} />
      <ellipse cx="13.4" cy="-8.6" rx="1.9" ry="2.3" fill={fill} />
    </>
  );
}

function Sparkle({ x, y, s = 1, delay = 0, color = '#FFFFFF' }: { x: number; y: number; s?: number; delay?: number; color?: string }) {
  return (
    <path className="bdg-twinkle" style={{ animationDelay: `${delay}s` }} transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -6 C0.7 -1.4 1.4 -0.7 6 0 C1.4 0.7 0.7 1.4 0 6 C-0.7 1.4 -1.4 0.7 -6 0 C-1.4 -0.7 -0.7 -1.4 0 -6 Z" fill={color} />
  );
}

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Element particles around the badge (only when animated) */
function Effects({ el, color }: { el: Element; color: string }) {
  switch (el) {
    case 'frost':
      return (
        <g className="fx">
          {[[24, 0, 1], [42, 2.1, 1], [118, 0.9, -1], [136, 3, -1], [80, 4.2, 1], [60, 1.5, -1], [100, 3.6, 1]].map(([x, d, dir], i) => (
            <g key={i} className="fx-fall" style={v({ '--x': `${x}px`, '--drift': `${dir * 10}px`, animationDelay: `${d}s` })}>
              <path d="M0 -6 V6 M-5.2 -3 L5.2 3 M-5.2 3 L5.2 -3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
            </g>
          ))}
        </g>
      );
    case 'ember':
    case 'fire':
      return (
        <g className="fx">
          {[[30, 0, -6], [44, 0.6, 5], [116, 1.2, -5], [130, 1.8, 7], [56, 2.4, 6], [104, 3, -7], [80, 3.5, 3], [36, 1.6, 8], [124, 2.9, -8]].map(([x, d, dr], i) => (
            <g key={i} className="fx-rise" style={v({ '--x': `${x}px`, '--drift': `${dr}px`, animationDelay: `${d}s` })}>
              <circle r={i % 3 ? 5 : 6.5} fill={color} opacity=".25" />
              <circle r={i % 3 ? 2.2 : 3} fill={color} />
              <circle r={i % 3 ? 1 : 1.3} fill="#FFF6D5" />
            </g>
          ))}
        </g>
      );
    case 'leaf':
      return (
        <g className="fx">
          {[[28, 0, 10], [132, 1.1, -10], [46, 2.2, 8], [114, 3.2, -8], [80, 4, 6], [38, 3.7, -6]].map(([x, d, dr], i) => (
            <g key={i} className="fx-rise fx-leaf" style={v({ '--x': `${x}px`, '--drift': `${dr}px`, animationDelay: `${d}s` })}>
              <path d="M0 -7 C 5.5 -3 5.5 3 0 7 C -5.5 3 -5.5 -3 0 -7 Z" fill={color} />
              <path d="M0 -6.5 V6.5" stroke="#fff" strokeOpacity=".55" strokeWidth="1" />
            </g>
          ))}
        </g>
      );
    case 'water':
      return (
        <g className="fx">
          {[[28, 0, 4], [44, 0.8, 3], [116, 1.6, 4.5], [132, 2.3, 3], [80, 3.1, 3.5], [60, 2, 2.6], [100, 3.6, 3]].map(([x, d, r], i) => (
            <circle key={i} className="fx-rise fx-bubble" r={r} fill={color} fillOpacity=".2" stroke={color} strokeWidth="1.4" style={v({ '--x': `${x}px`, '--drift': `${i % 2 ? 4 : -4}px`, animationDelay: `${d}s` })} />
          ))}
        </g>
      );
    case 'storm':
      return (
        <g className="fx" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {[
            ['M30 22 L36 30 L32 34 L40 44 L37 48 L44 56', 0],
            ['M130 20 L124 30 L129 35 L121 44 L125 49 L117 58', 0.85],
            ['M28 100 L36 94 L33 89 L42 84', 1.6],
            ['M132 98 L124 93 L128 88 L118 83', 2.3],
            ['M70 4 L76 10 L72 13 L80 18 L77 22 L84 26', 1.15]
          ].map(([d, delay], i) => (
            <g key={i} className="fx-bolt" style={{ animationDelay: `${delay}s` }}>
              <path d={d as string} stroke={color} strokeWidth="5" opacity=".25" />
              <path d={d as string} stroke={color} strokeWidth="2.2" opacity=".8" />
              <path d={d as string} stroke="#fff" strokeWidth=".9" />
            </g>
          ))}
        </g>
      );
    case 'wind':
      return (
        <g className="fx" fill="none" stroke={color} strokeLinecap="round">
          {[['M12 40 C 40 26 70 30 96 22', 0, 2], ['M150 78 C 122 90 96 88 66 98', 1.2, 1.6], ['M18 96 C 36 104 52 104 66 100', 2.3, 1.3]].map(([d, delay, w], i) => (
            <path key={i} className="fx-wind" d={d as string} strokeWidth={w as number} pathLength={100} style={{ animationDelay: `${delay}s` }} />
          ))}
        </g>
      );
    case 'cosmic':
      return (
        <g className="fx">
          <g className="fx-orbit" style={{ transformOrigin: `${CX}px ${CY}px` }}>
            {[0, 120, 240].map(a => {
              const r = (Math.PI / 180) * a;
              return <path key={a} transform={`translate(${CX + 66 * Math.cos(r)} ${CY + 30 * Math.sin(r)})`} d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill={color} />;
            })}
          </g>
          <g className="fx-orbit fx-orbit-rev" style={{ transformOrigin: `${CX}px ${CY}px` }}>
            {[60, 200, 320].map(a => {
              const r = (Math.PI / 180) * a;
              return <circle key={a} cx={CX + 58 * Math.cos(r)} cy={CY + 40 * Math.sin(r)} r="1.6" fill="#fff" />;
            })}
          </g>
        </g>
      );
  }
}

export function Badge({ level, size = 96, animate = true, title }: { level: number; size?: number; animate?: boolean; title?: string }) {
  const L = Math.max(1, Math.min(BADGES.length, Math.round(level)));
  const b = BADGES[L - 1];
  const c = b.colors;
  const id = useId().replace(/:/g, '');
  const g = (n: string) => `url(#${n}${id})`;
  const [vx, vy, vw, vh] = L >= 6 ? [6, -6, 148, 150] : [22, -6, 116, 150];
  const top = P(R, 0);

  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} width={size} height={(size * vh) / vw} role="img" aria-label={title ?? `${b.name} badge`}
      className={`bdg ${animate ? 'bdg-on' : ''} bdg-l${L}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`rim${id}`} x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stopColor={c.rimTop} /><stop offset="1" stopColor={c.rimBottom} /></linearGradient>
        <linearGradient id={`side${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.rimBottom} /><stop offset="1" stopColor={c.base} /></linearGradient>
        <linearGradient id={`bevel${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.bevelBottom} /><stop offset="1" stopColor={c.bevelTop} /></linearGradient>
        <linearGradient id={`face${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.panelTop ?? c.faceDark} /><stop offset="1" stopColor={c.panelBottom ?? c.face} /></linearGradient>
        <linearGradient id={`foot${id}`} x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stopColor={c.footTop} /><stop offset="1" stopColor={c.footBottom} /></linearGradient>
        <linearGradient id={`gem${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.gemLight} /><stop offset="1" stopColor={c.gemDark} /></linearGradient>
        <linearGradient id={`wing${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={c.wingBottom ?? c.rimBottom} /><stop offset=".55" stopColor={c.wingTop ?? c.rimTop} /><stop offset="1" stopColor="#FFFFFF" /></linearGradient>
        <linearGradient id={`sweep${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".6" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <radialGradient id={`glow${id}`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor={c.glow ?? c.rimTop} stopOpacity=".7" /><stop offset=".6" stopColor={c.glow ?? c.rimTop} stopOpacity=".25" /><stop offset="1" stopColor={c.glow ?? c.rimTop} stopOpacity="0" /></radialGradient>
        <radialGradient id={`flame${id}`} cx="50%" cy="100%" r="100%"><stop offset="0" stopColor="#FFF2A8" /><stop offset=".45" stopColor="#FFB13D" /><stop offset="1" stopColor="#FF4D1F" stopOpacity="0" /></radialGradient>
        <clipPath id={`clip${id}`}><polygon points={hex(R - 13)} /></clipPath>
      </defs>

      {/* ---------- behind the badge ---------- */}
      {L >= 7 && <circle className="bdg-glow" cx={CX} cy={CY + 4} r="74" fill={g('glow')} />}
      {L === 8 && animate && (
        <g className="bdg-rays" style={{ transformOrigin: `${CX}px ${CY}px` }} opacity=".55">
          {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${CX} ${CY} L${CX - 5} ${CY - 82} L${CX + 5} ${CY - 82} Z`} fill={c.fx} opacity={i % 2 ? 0.35 : 0.7} transform={`rotate(${i * 30} ${CX} ${CY})`} />)}
        </g>
      )}
      {L === 7 && (
        <g className={animate ? 'fx-flames' : ''} style={{ transformOrigin: `${CX}px ${CY + 40}px` }}>
          {[[-30, 46, -14], [-14, 62, -4], [0, 72, 0], [14, 62, 4], [30, 46, 14]].map(([dx, h, tilt], i) => (
            <path key={i} className="fx-flame" style={{ animationDelay: `${i * 0.18}s` }}
              d={`M${CX + dx - 12} ${CY + 12} C ${CX + dx - 14} ${CY - h * 0.4} ${CX + dx + tilt - 4} ${CY - h * 0.7} ${CX + dx + tilt} ${CY - h} C ${CX + dx + tilt + 4} ${CY - h * 0.7} ${CX + dx + 14} ${CY - h * 0.4} ${CX + dx + 12} ${CY + 12} Z`}
              fill={g('flame')} opacity=".9" />
          ))}
        </g>
      )}

      {/* element particles behind the badge, so they seem to come off it */}
      {animate && b.element !== 'storm' && b.element !== 'wind' && <Effects el={b.element} color={c.fx} />}

      {/* wings (L6+): three rounded feathers per side that curve upward at the tips */}
      {L >= 6 && (
        <g className="bdg-wings" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          {[1, -1].map(side => (
            <g key={side} transform={`translate(${CX} 0) scale(${side} 1) translate(${-CX} 0)`}>
              {[[2, 23, 12, 9, c.wingBottom], [1, 30, 13, -1, c.wingMid ?? c.wingBottom], [0, 36, 14, -12, c.wingTop]].map(([k, len, t, dy, col]) => {
                const L2 = len as number, T = t as number;
                const d = `M0 ${-T / 2} Q ${L2 * 0.6} ${-T / 2 - 2} ${L2} ${-T / 2 - 7} Q ${L2 + T * 0.62} ${-T / 2 - 7 + T * 0.55} ${L2 - 3} ${T / 2 - 4} Q ${L2 * 0.55} ${T / 2 + 1} 0 ${T / 2} Z`;
                return (
                  <g key={k as number} transform={`translate(${CX + R * 0.78} ${CY + (dy as number)})`}>
                    <path d={d} fill={(col as string) ?? c.rimTop} />
                    <path d={`M2 ${-T / 2 + 2} Q ${L2 * 0.6} ${-T / 2} ${L2 - 1} ${-T / 2 - 4.5}`} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.8" strokeLinecap="round" />
                    <path d={`M0 ${T / 2 - 3} Q ${L2 * 0.55} ${T / 2 - 1.5} ${L2 - 4} ${T / 2 - 6}`} fill="none" stroke="#000" strokeOpacity=".12" strokeWidth="2.2" strokeLinecap="round" />
                  </g>
                );
              })}
            </g>
          ))}
        </g>
      )}

      {/* bottom band: the lower half of the badge, dropped lower and split into three pieces (all levels) */}
      {(() => {
        const D = 14, lowL = P(R + 1.5, 4), lowR = P(R + 1.5, 2), bot = P(R + 1.5, 3);
        const at = (p: [number, number], q: [number, number], t: number): [number, number] => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
        const dn = (p: [number, number], k = D): [number, number] => [p[0], p[1] + k];
        const up = (p: [number, number]): [number, number] => [p[0], p[1] - 10];
        const l1 = at(lowL, bot, 0.6), r1 = at(bot, lowR, 0.4), g = 0.12;   // clear gaps between the three pieces
        const lEnd = at(lowL, bot, 0.6 - g), rStart = at(bot, lowR, 0.4 + g);
        const left = [up(lowL), up(lEnd), dn(lEnd), dn(lowL)];
        const right = [up(rStart), up(lowR), dn(lowR), dn(rStart)];
        const mid = [up(l1), up(bot), up(r1), dn(r1, D + 1), dn(bot, D + 1), dn(l1, D + 1)];
        return (
          <g strokeLinejoin="round">
            <polygon points={pts(left as [number, number][])} fill={c.tab ?? c.rimBottom} stroke={c.tab ?? c.rimBottom} strokeWidth="1.2" />
            <polygon points={pts(right as [number, number][])} fill={c.tab ?? c.rimBottom} stroke={c.tab ?? c.rimBottom} strokeWidth="1.2" />
            <polygon points={pts([right[2], right[3], dn(rStart, D - 5), dn(lowR, D - 5)] as [number, number][])} fill="#000" opacity=".12" />
            <polygon points={pts(mid as [number, number][])} fill={c.tabMid ?? c.rimTop} stroke={c.tabMid ?? c.rimTop} strokeWidth="1.2" />
            <polygon points={pts([up(bot), up(r1), dn(r1, D + 1), dn(bot, D + 1)] as [number, number][])} fill="#000" opacity=".1" />
          </g>
        );
      })()}

      {/* side ears on the left and right edges (L2+) */}
      {(L === 2 || L === 3) && [-1, 1].map(sd => (
        <rect key={sd} x={sd < 0 ? CX - R * 0.866 - 6 : CX + R * 0.866} y={CY - 9} width="6" height="18" rx="1.5" fill={c.tab ?? c.rimBottom} />
      ))}

      {/* ---------- frame: wide, each side a slightly different shade, light lines on both edges ---------- */}
      <polygon points={hex(R)} fill={g('rim')} stroke={g('rim')} strokeWidth="3" strokeLinejoin="round" />
      {[['#fff', .26], ['#fff', .1], ['#000', .04], ['#000', .12], ['#000', .06], ['#fff', .16]].map(([col, op], i) => (
        <polygon key={i} points={pts([P(R, i), P(R, (i + 1) % 6), P(R - 13, (i + 1) % 6), P(R - 13, i)])} fill={col as string} opacity={op as number} />
      ))}
      <polygon points={hex(R - 1.5)} fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.3" strokeLinejoin="round" />
      <polygon points={hex(R - 11)} fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" strokeLinejoin="round" />
      {/* one large inner panel */}
      <polygon points={hex(R - 13)} fill={g('face')} stroke="#000" strokeOpacity=".25" strokeWidth="1" strokeLinejoin="round" />

      {/* corner spikes, sitting on the frame corners and pointing outward:
          lower two at L4, all four sides from L5. Flat two-tone like the frame. */}
      {(() => {
        // where the spikes go: Hiker = middle of both sides + bottom point, Trailblazer/Legend = four corners,
        // Summit = middle of both sides. Each points straight out from the centre.
        const spots: [number, number, number][] = [];
        const side = (sd: number) => spots.push([CX + sd * (R * 0.866 + 1), CY, sd > 0 ? 0 : 180]);
        const corner = (i: number) => { const [x, y] = P(R + 1, i); spots.push([x, y, 60 * i - 90]); };
        if (L === 4) { side(-1); side(1); const [x, y] = P(R + 1, 3); spots.push([x, y, 90]); }
        if (L === 5 || L === 8) [1, 2, 4, 5].forEach(corner);
        if (L === 7) { side(-1); side(1); }
        return spots.map(([x, y, ang], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${ang})`}>
            <polygon points="-4,-7.5 11,0 -4,0" fill={c.spike ?? c.gemLight} stroke={c.spike ?? c.gemLight} strokeWidth="1.5" strokeLinejoin="round" />
            <polygon points="-4,0 11,0 -4,7.5" fill={c.spikeDark ?? c.gemDark} stroke={c.spikeDark ?? c.gemDark} strokeWidth="1.5" strokeLinejoin="round" />
          </g>
        ));
      })()}

      {/* light sweep across the face (L4+) */}
      {L >= 4 && animate && (
        <g clipPath={`url(#clip${id})`}>
          <rect className="bdg-sweep" x={CX - 64} y={CY - 40} width="26" height="80" fill={g('sweep')} transform={`rotate(22 ${CX} ${CY})`} />
        </g>
      )}
      {/* glossy reflection on the upper part of the face */}
      <path d={`M${CX - 25} ${CY - 12} L${CX} ${CY - 27} L${CX + 25} ${CY - 12} C ${CX + 12} ${CY - 17} ${CX - 12} ${CY - 17} ${CX - 25} ${CY - 12} Z`} fill="#fff" opacity=".22" />

      {/* polished footprint */}
      <g transform={`translate(${CX - 2} ${CY + (L >= 8 ? 6 : 2)}) rotate(-10) scale(${L >= 8 ? 0.98 : 1.16})`}>
        <g transform="translate(1.2 2)" opacity=".5"><FootShape fill={c.footShade} /></g>
        <FootShape fill={g('foot')} />
        <ellipse cx="0.4" cy="-3.5" rx="2.8" ry="5.2" fill="#fff" opacity=".45" />
        <ellipse cx="-5.8" cy="-16.6" rx="1.3" ry="1.6" fill="#fff" opacity=".6" />
      </g>

      {/* cut crystal on the top corner (L3+) */}
      {L >= 3 && (
        <g transform={`translate(${CX} ${top[1] + 1})`}>
          <polygon points="0,-16 8.5,-8.5 8.5,6 0,13 -8.5,6 -8.5,-8.5" fill={c.base} stroke={c.base} strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="0,-15 7,-8 7,5 0,11 -7,5 -7,-8" fill={g('gem')} stroke={c.gemDark} strokeWidth="1" strokeLinejoin="round" />
          <polygon points="0,-15 -7,-8 -7,5 0,11" fill="#000" opacity=".12" />
          <polygon points="0,-15 3,-8 3,5 0,11 -1,5 -1,-8" fill="#fff" opacity=".5" />
        </g>
      )}
      {/* Legend: gold crown resting on the footprint */}
      {L >= 8 && (
        <g transform={`translate(${CX + 1} ${CY - 14}) scale(.78)`}>
          <path d="M-17 7 L-19 -8 L-9 -1 L0 -13 L9 -1 L19 -8 L17 7 Z" fill="#FFCF40" stroke="#A86A00" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M-17 7 L-19 -8 L-9 -1 L0 -13 L0 7 Z" fill="#fff" opacity=".25" />
          <rect x="-17" y="6" width="34" height="6" rx="2" fill="#F2A900" stroke="#A86A00" strokeWidth="1.4" />
          <circle cx="0" cy="-13" r="2.6" fill="#FF5F6D" stroke="#fff" strokeWidth=".8" />
          <circle cx="-19" cy="-8" r="2" fill="#4CC9F0" stroke="#fff" strokeWidth=".7" />
          <circle cx="19" cy="-8" r="2" fill="#4CC9F0" stroke="#fff" strokeWidth=".7" />
          <circle cx="0" cy="9" r="2" fill="#43CF6B" />
        </g>
      )}

      {/* sparkles */}
      {L >= 2 && <Sparkle x={CX - 15} y={CY - 16} s={0.75} color="#fff" />}
      {L >= 3 && <Sparkle x={CX + 17} y={CY + 11} s={0.55} delay={0.7} />}
      {L >= 4 && <Sparkle x={CX + 38} y={CY - 38} s={0.9} delay={1.3} color={c.spark ?? '#fff'} />}
      {L >= 6 && <Sparkle x={CX - 40} y={CY + 34} s={0.85} delay={0.4} color={c.spark ?? '#fff'} />}
      {L >= 7 && <Sparkle x={CX - 50} y={CY - 34} s={1.1} delay={1.8} color="#FFE7A0" />}
      {L >= 8 && <Sparkle x={CX + 52} y={CY + 30} s={1.2} delay={1} color="#FFE7A0" />}

      {/* element effects that sit in front */}
      {animate && (b.element === 'storm' || b.element === 'wind') && <Effects el={b.element} color={c.fx} />}
    </svg>
  );
}
