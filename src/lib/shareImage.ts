import type { Activity, Settings } from '../types';
import { fmtDist, fmtInt, fmtPace, fmtTime, unitL } from './format';
import { project, trimRoute } from './geo';
import { BADGES, type Element } from './badges';

export type ShareStyle = 'night' | 'sunrise' | 'level' | 'sticker';
export type ShareFormat = 'post' | 'story';
export const SHARE_SIZES: Record<ShareFormat, [number, number]> = { post: [1080, 1350], story: [1080, 1920] };

interface Theme {
  bg: ((x: CanvasRenderingContext2D, w: number, h: number) => void) | null;
  contour: string | null;
  text: string;
  muted: string;
  rule: string;
  route: [string, string];   // start → end colour along the route
  glow: string | null;
  under: string | null;      // outline under the route for contrast
  startFill: string;
  endFill: string;
  textShadow: string | null;
  halo?: string;             // soft ring around the finish dot (defaults to the dot colour)
}

const THEMES: Record<Exclude<ShareStyle, 'level'>, Theme> = {
  // "Blue": plain Lakad blue, white route, yellow finish dot (the original Lakad look)
  night: {
    bg: (x, w, h) => { x.fillStyle = '#1F4FE0'; x.fillRect(0, 0, w, h); },
    contour: null,
    text: '#FFFFFF', muted: 'rgba(255,255,255,0.78)', rule: 'rgba(255,255,255,0.28)',
    route: ['#FFFFFF', '#FFFFFF'], glow: null, under: null,
    startFill: '#1F4FE0', endFill: '#FFB627', textShadow: null, halo: 'rgba(255,255,255,0.22)'
  },
  sunrise: {
    bg: (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w * 0.25, h);
      g.addColorStop(0, '#FFD173'); g.addColorStop(0.55, '#FFB039'); g.addColorStop(1, '#F58A2E');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const r = x.createRadialGradient(w * 0.15, h * 0.1, 0, w * 0.15, h * 0.1, w);
      r.addColorStop(0, 'rgba(255,248,226,0.55)'); r.addColorStop(1, 'rgba(255,248,226,0)');
      x.fillStyle = r; x.fillRect(0, 0, w, h);
    },
    contour: 'rgba(14,27,51,0.075)',
    text: '#0E1B33', muted: 'rgba(14,27,51,0.62)', rule: 'rgba(14,27,51,0.18)',
    route: ['#0E1B33', '#1F4FE0'], glow: null, under: 'rgba(255,250,236,0.85)',
    startFill: '#FFF8E6', endFill: '#1F4FE0', textShadow: null
  },
  sticker: {
    bg: null, contour: null,
    text: '#FFFFFF', muted: 'rgba(255,255,255,0.86)', rule: 'rgba(255,255,255,0.45)',
    route: ['#FFFFFF', '#FFB627'], glow: 'rgba(0,0,0,0.35)', under: 'rgba(0,0,0,0.28)',
    startFill: '#FFFFFF', endFill: '#FFB627', textShadow: 'rgba(0,0,0,0.45)'
  }
};

/** "Your level" style: the badge's own colours, a glow in its element colour */
function levelTheme(level: number): Theme {
  const c = BADGES[Math.max(0, Math.min(BADGES.length - 1, level - 1))].colors;
  return {
    bg: (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w * 0.3, h);
      g.addColorStop(0, c.panelTop ?? c.faceDark); g.addColorStop(1, c.panelBottom ?? c.face);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const r = x.createRadialGradient(w * 0.8, h * 0.18, 0, w * 0.8, h * 0.18, w * 0.85);
      r.addColorStop(0, hexA(c.fx, 0.38)); r.addColorStop(1, hexA(c.fx, 0));
      x.fillStyle = r; x.fillRect(0, 0, w, h);
      const v = x.createLinearGradient(0, h * 0.55, 0, h);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.28)');
      x.fillStyle = v; x.fillRect(0, h * 0.55, w, h * 0.45);
    },
    contour: null,   // replaced by soft glows + fine grain (atmosphere)
    text: '#FFFFFF', muted: 'rgba(255,255,255,0.78)', rule: 'rgba(255,255,255,0.26)',
    route: ['#FFFFFF', '#FFFFFF'], glow: hexA(c.fx, 0.9), under: null,
    startFill: c.panelTop ?? c.faceDark, endFill: c.spike ?? c.gemLight, textShadow: null, halo: 'rgba(255,255,255,0.25)'
  };
}
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- element decorations for the "your level" card ----------
   Composed around the badge (top right) so the route and numbers stay clean.
   Each element: a soft glow behind the badge + a few well-drawn shapes in graded sizes. */

/** soft out-of-focus light dot */
function bokeh(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, a: number) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, hexA('#FFFFFF', a)); g.addColorStop(0.25, hexA(color, a)); g.addColorStop(1, hexA(color, 0));
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
}
/** big soft glow */
function glow(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, a: number) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, hexA(color, a)); g.addColorStop(0.5, hexA(color, a * 0.35)); g.addColorStop(1, hexA(color, 0));
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
}
/** six-armed snow crystal with side branches */
function snowflake(x: CanvasRenderingContext2D, cx: number, cy: number, size: number, rot: number, a: number) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.globalAlpha = a;
  x.strokeStyle = '#FFFFFF'; x.lineCap = 'round'; x.lineWidth = Math.max(1.6, size * 0.09);
  x.shadowColor = 'rgba(200,235,255,.9)'; x.shadowBlur = size * 0.5;
  for (let i = 0; i < 6; i++) {
    x.rotate(Math.PI / 3);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -size);
    for (const [t, l] of [[0.45, 0.32], [0.72, 0.22]]) {
      x.moveTo(0, -size * t); x.lineTo(-size * l, -size * (t + l * 0.8));
      x.moveTo(0, -size * t); x.lineTo(size * l, -size * (t + l * 0.8));
    }
    x.stroke();
  }
  x.restore();
}
/** leaf with a gradient, midrib and stem */
function leaf(x: CanvasRenderingContext2D, cx: number, cy: number, size: number, rot: number, color: string, a: number) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.globalAlpha = a;
  const g = x.createLinearGradient(-size * 0.4, -size, size * 0.4, size);
  g.addColorStop(0, '#E9FFC8'); g.addColorStop(0.5, color); g.addColorStop(1, '#2E9E46');
  x.fillStyle = g; x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = size * 0.3; x.shadowOffsetY = size * 0.08;
  x.beginPath(); x.moveTo(0, -size); x.bezierCurveTo(size * 0.62, -size * 0.45, size * 0.55, size * 0.5, 0, size * 0.8);
  x.bezierCurveTo(-size * 0.55, size * 0.5, -size * 0.62, -size * 0.45, 0, -size); x.fill();
  x.shadowColor = 'transparent';
  x.strokeStyle = 'rgba(255,255,255,.65)'; x.lineWidth = Math.max(1.2, size * 0.06); x.lineCap = 'round';
  x.beginPath(); x.moveTo(0, -size * 0.85); x.quadraticCurveTo(size * 0.06, 0, 0, size * 1.05); x.stroke();
  x.lineWidth = Math.max(0.8, size * 0.035);
  for (const t of [-0.45, -0.1, 0.25]) { x.beginPath(); x.moveTo(0, size * t); x.lineTo(size * 0.32, size * (t - 0.22)); x.moveTo(0, size * t); x.lineTo(-size * 0.32, size * (t - 0.22)); x.stroke(); }
  x.restore();
}
/** glowing line: wide soft glow, then a bright core */
function lightLine(x: CanvasRenderingContext2D, path: [number, number][], color: string, width: number, a: number) {
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.globalAlpha = a;
  const draw = () => { x.beginPath(); path.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); };
  x.strokeStyle = hexA(color, 0.28); x.lineWidth = width * 5; x.shadowColor = color; x.shadowBlur = width * 8; draw();
  x.shadowBlur = 0; x.strokeStyle = hexA(color, 0.85); x.lineWidth = width * 1.8; draw();
  x.strokeStyle = '#FFFFFF'; x.lineWidth = width * 0.7; draw();
  x.restore();
}
/** branching lightning bolt from (sx,sy) toward an angle */
function bolt(x: CanvasRenderingContext2D, sx: number, sy: number, ang: number, len: number, color: string, r: () => number) {
  const main: [number, number][] = [[sx, sy]], segs = 7;
  for (let i = 1; i <= segs; i++) {
    const d = (len / segs) * i, jit = (r() - 0.5) * len * 0.14;
    main.push([sx + Math.cos(ang) * d - Math.sin(ang) * jit, sy + Math.sin(ang) * d + Math.cos(ang) * jit]);
  }
  lightLine(x, main, color, 2.6, 1);
  for (const k of [2, 4]) {           // two side branches
    const [bx, by] = main[k], ba = ang + (k === 2 ? 0.55 : -0.5), bl = len * 0.32;
    const br: [number, number][] = [[bx, by]];
    for (let i = 1; i <= 3; i++) { const d = (bl / 3) * i, j = (r() - 0.5) * bl * 0.25; br.push([bx + Math.cos(ba) * d - Math.sin(ba) * j, by + Math.sin(ba) * d + Math.cos(ba) * j]); }
    lightLine(x, br, color, 1.6, 0.85);
  }
}
/** long flowing ribbon that fades at both ends */
function ribbon(x: CanvasRenderingContext2D, p: [number, number][], width: number, a: number) {
  x.save();
  const g = x.createLinearGradient(p[0][0], p[0][1], p[3][0], p[3][1]);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, `rgba(255,255,255,${a})`); g.addColorStop(0.7, `rgba(255,255,255,${a * 0.8})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.strokeStyle = g; x.lineWidth = width; x.lineCap = 'round';
  x.beginPath(); x.moveTo(p[0][0], p[0][1]); x.bezierCurveTo(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]); x.stroke();
  x.restore();
}
/** four-point star */
function star(x: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string, a: number) {
  x.save(); x.translate(cx, cy); x.globalAlpha = a; x.fillStyle = color; x.shadowColor = color; x.shadowBlur = s * 1.2;
  x.beginPath(); x.moveTo(0, -s); x.quadraticCurveTo(s * 0.12, -s * 0.12, s, 0); x.quadraticCurveTo(s * 0.12, s * 0.12, 0, s);
  x.quadraticCurveTo(-s * 0.12, s * 0.12, -s, 0); x.quadraticCurveTo(-s * 0.12, -s * 0.12, 0, -s); x.fill();
  x.restore();
}

function drawElement(x: CanvasRenderingContext2D, el: Element, color: string, W: number, _H: number, seed: number, badge: [number, number]) {
  const r = rng(seed), [bx, by] = badge, u = W / 1080;
  /** points on an arc around the badge (angles in degrees, 0 = right, 90 = down) */
  const arc = (deg: number, rad: number): [number, number] => [bx + Math.cos((deg * Math.PI) / 180) * rad * u, by + Math.sin((deg * Math.PI) / 180) * rad * u];
  x.save();
  switch (el) {
    case 'frost': {
      glow(x, bx, by, 300 * u, '#CFF0FF', 0.45);
      ([[150, 225, 36, 0.95], [178, 255, 22, 0.8], [203, 215, 27, 0.85], [124, 255, 16, 0.65], [160, 340, 14, 0.55], [196, 330, 12, 0.5]] as const)
        .forEach(([d, rad, sz, a]) => { const [px, py] = arc(d, rad); snowflake(x, px, py, sz * u, r() * 0.5, a); });
      break;
    }
    case 'ember': case 'fire': {
      glow(x, bx, by + 20 * u, 320 * u, el === 'fire' ? '#FF7A2E' : '#FF9A4D', 0.5);
      if (el === 'fire') {
        x.save(); x.translate(bx, by + 80 * u);
        ([[-78, 170], [-40, 240], [0, 290], [40, 240], [78, 170]] as const).forEach(([dx, h]) => {
          const g = x.createLinearGradient(0, 0, 0, -h * u); g.addColorStop(0, 'rgba(255,77,31,0)'); g.addColorStop(0.25, 'rgba(255,120,40,.55)'); g.addColorStop(0.7, 'rgba(255,200,90,.35)'); g.addColorStop(1, 'rgba(255,240,170,0)');
          x.fillStyle = g; x.beginPath(); x.moveTo((dx - 38) * u, 0); x.bezierCurveTo((dx - 44) * u, -h * 0.5 * u, (dx - 6) * u, -h * 0.82 * u, dx * u, -h * u);
          x.bezierCurveTo((dx + 6) * u, -h * 0.82 * u, (dx + 44) * u, -h * 0.5 * u, (dx + 38) * u, 0); x.closePath(); x.fill();
        });
        x.restore();
      }
      // embers rising in a gentle S past the badge, big and soft near, small and crisp far
      ([[140, 240, 22, 0.75], [160, 300, 14, 0.6], [182, 225, 10, 0.85], [202, 275, 17, 0.55], [120, 215, 8, 0.9], [175, 345, 12, 0.7], [110, 305, 26, 0.35]] as const)
        .forEach(([d, rad, sz, a]) => { const [px, py] = arc(d, rad); bokeh(x, px, py, sz * u, color, a); });
      break;
    }
    case 'leaf': {
      glow(x, bx, by, 300 * u, '#D8FF9C', 0.35);
      ([[150, 225, 32, -0.6, 0.95], [178, 250, 21, -1.2, 0.85], [203, 215, 24, 0.4, 0.85], [124, 255, 16, 1.1, 0.75], [165, 335, 15, -2, 0.65]] as const)
        .forEach(([d, rad, sz, rot, a]) => { const [px, py] = arc(d, rad); leaf(x, px, py, sz * u, rot, color, a); });
      break;
    }
    case 'water': {
      glow(x, bx, by, 300 * u, '#7FD8FF', 0.4);
      x.save(); x.strokeStyle = 'rgba(190,235,255,.55)';
      [150, 205, 265].forEach((rad, i) => { x.globalAlpha = 0.55 - i * 0.15; x.lineWidth = (3 - i * 0.7) * u; x.beginPath(); x.ellipse(bx, by + 30 * u, rad * u, rad * 0.32 * u, 0, 0, Math.PI * 2); x.stroke(); });
      x.restore();
      // bubbles rising along an arc to the left of the badge
      ([[150, 235, 16], [168, 275, 10], [186, 250, 7], [135, 285, 21], [200, 295, 6], [120, 240, 9]] as const).forEach(([d, rad, sz]) => {
        const [px, py] = arc(d, rad);
        x.save(); x.lineWidth = Math.max(1.4, sz * 0.14) * u; x.strokeStyle = 'rgba(220,245,255,.85)';
        const g = x.createRadialGradient(px - sz * 0.3 * u, py - sz * 0.3 * u, 0, px, py, sz * u); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(160,220,255,.08)');
        x.fillStyle = g; x.beginPath(); x.arc(px, py, sz * u, 0, Math.PI * 2); x.fill(); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(px - sz * 0.35 * u, py - sz * 0.35 * u, sz * 0.18 * u, 0, Math.PI * 2); x.fill();
        x.restore();
      });
      break;
    }
    case 'storm': {
      glow(x, bx, by, 330 * u, '#C77BFF', 0.5);
      bolt(x, ...arc(165, 115), Math.PI * 0.86, 240 * u, '#E9B8FF', r);
      bolt(x, ...arc(205, 115), Math.PI * 1.12, 150 * u, '#E9B8FF', r);
      ([[140, 270, 5], [195, 235, 4], [160, 345, 6]] as const).forEach(([d, rad, sz]) => { const [px, py] = arc(d, rad); star(x, px, py, sz * u, '#F6D8FF', 0.9); });
      break;
    }
    case 'wind': {
      glow(x, bx, by, 300 * u, '#DDF3FF', 0.35);
      // long ribbons sweeping across the top area, behind the badge
      const W2 = W;
      ribbon(x, [[W2 * 0.34, by - 20 * u], [W2 * 0.52, by - 110 * u], [W2 * 0.7, by + 60 * u], [W2 * 1.0, by - 40 * u]], 7 * u, 0.9);
      ribbon(x, [[W2 * 0.4, by + 120 * u], [W2 * 0.56, by + 40 * u], [W2 * 0.76, by + 190 * u], [W2 * 1.0, by + 110 * u]], 5 * u, 0.75);
      ribbon(x, [[W2 * 0.5, by + 250 * u], [W2 * 0.64, by + 200 * u], [W2 * 0.82, by + 300 * u], [W2 * 1.0, by + 240 * u]], 3.5 * u, 0.55);
      break;
    }
    case 'cosmic': {
      glow(x, bx, by, 360 * u, '#FFE27A', 0.45);
      x.save(); x.translate(bx, by);
      for (let i = 0; i < 18; i++) {
        x.rotate((Math.PI * 2) / 18);
        const g = x.createLinearGradient(0, 0, 0, -340 * u); g.addColorStop(0, hexA(color, i % 2 ? 0.16 : 0.28)); g.addColorStop(1, hexA(color, 0));
        x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(-14 * u, -340 * u); x.lineTo(14 * u, -340 * u); x.closePath(); x.fill();
      }
      x.restore();
      ([[150, 235, 17], [178, 215, 10], [205, 240, 12], [125, 225, 8], [165, 325, 10], [195, 310, 7], [112, 305, 6]] as const)
        .forEach(([d, rad, sz]) => { const [px, py] = arc(d, rad); star(x, px, py, sz * u, '#FFF1B0', 0.95); });
      break;
    }
  }
  x.restore();
}

/** The badge drawn as an image (rendered from the same artwork the app uses) */
const badgeCache = new Map<number, Promise<HTMLImageElement>>();
export function loadBadgeImage(level: number): Promise<HTMLImageElement> {
  if (!badgeCache.has(level)) {
    badgeCache.set(level, (async () => {
      const [{ renderToStaticMarkup }, { createElement }, { Badge }] = await Promise.all([import('react-dom/server'), import('react'), import('../components/Badge')]);
      let svg = renderToStaticMarkup(createElement(Badge, { level, size: 400, animate: false }));
      if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await img.decode();
      return img;
    })());
  }
  return badgeCache.get(level)!;
}

const FONT = '"Archivo Variable", Archivo, system-ui, -apple-system, "Segoe UI", sans-serif';
const font = (x: CanvasRenderingContext2D, weight: number, px: number, wide = false) => {
  x.font = `${weight} ${px}px ${FONT}`;
  if ('fontStretch' in x) (x as unknown as { fontStretch: string }).fontStretch = wide ? 'ultra-expanded' : 'normal';
  if ('letterSpacing' in x) (x as unknown as { letterSpacing: string }).letterSpacing = wide ? `${-px * 0.02}px` : '0px';
};

function seedOf(id: string) { let h = 2166136261; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) % 2147483646 + 1; }
function rng(seed: number) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/**
 * Level card background depth: a few large soft glows in the level's tones (placed per activity),
 * a gentle vignette, and a fine film grain that keeps gradients smooth after phones compress the image.
 */
function atmosphere(x: CanvasRenderingContext2D, w: number, h: number, light: string, deep: string, seed: number) {
  const r = rng(seed);
  x.save();
  // soft glows: one large near the top, one low on the opposite side, one small accent
  const glows: [number, number, number, string, number][] = [
    [w * (0.15 + r() * 0.25), h * (0.08 + r() * 0.12), w * 0.75, light, 0.28],
    [w * (0.65 + r() * 0.3), h * (0.55 + r() * 0.25), w * 0.85, light, 0.18],
    [w * (0.3 + r() * 0.4), h * (0.35 + r() * 0.2), w * 0.45, '#FFFFFF', 0.06]
  ];
  x.globalCompositeOperation = 'screen';
  for (const [cx, cy, rad, col, a] of glows) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, hexA(col, a)); g.addColorStop(0.55, hexA(col, a * 0.35)); g.addColorStop(1, hexA(col, 0));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  // vignette: slightly deeper edges pull the eye to the route and numbers
  x.globalCompositeOperation = 'multiply';
  const v = x.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, hexA(deep, 0.55));
  x.fillStyle = v; x.fillRect(0, 0, w, h);
  // fine grain
  x.globalCompositeOperation = 'soft-light';
  const tile = document.createElement('canvas'); tile.width = tile.height = 160;
  const t = tile.getContext('2d')!, img = t.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) { const n = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = n; img.data[i + 3] = 34; }
  t.putImageData(img, 0, 0);
  x.fillStyle = x.createPattern(tile, 'repeat')!; x.fillRect(0, 0, w, h);
  x.restore();
}

/** Topographic contour lines from a smooth random field (marching squares), unique per activity */
function contours(x: CanvasRenderingContext2D, w: number, h: number, color: string, seed: number) {
  const r = rng(seed), waves = Array.from({ length: 5 }, () => ({ kx: (r() - 0.5) * 0.012, ky: (r() - 0.5) * 0.012, p: r() * 6.28, a: 0.5 + r() }));
  const cell = 14, cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1, f = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let v = 0; const px = i * cell, py = j * cell;
    for (const q of waves) v += q.a * Math.sin(px * q.kx + py * q.ky + q.p);
    f[j * cols + i] = v;
  }
  x.save(); x.strokeStyle = color; x.lineWidth = 2; x.lineCap = 'round';
  x.beginPath();
  for (let lv = -3; lv <= 3; lv += 0.32) {
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = f[j * cols + i], b = f[j * cols + i + 1], c = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
      const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const X = i * cell, Y = j * cell, t = (p: number, q: number) => (lv - p) / (q - p);
      const top: [number, number] = [X + cell * t(a, b), Y], right: [number, number] = [X + cell, Y + cell * t(b, c)];
      const bottom: [number, number] = [X + cell * t(d, c), Y + cell], left: [number, number] = [X, Y + cell * t(a, d)];
      const seg = (p: [number, number], q: [number, number]) => { x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); };
      switch (idx) {
        case 1: case 14: seg(left, bottom); break;
        case 2: case 13: seg(bottom, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(top, right); break;
        case 5: seg(left, top); seg(bottom, right); break;
        case 6: case 9: seg(top, bottom); break;
        case 7: case 8: seg(left, top); break;
        case 10: seg(top, right); seg(left, bottom); break;
      }
    }
  }
  x.stroke(); x.restore();
}

/** Route points fitted into a box, keeping aspect; null when there is no route */
function fitRoute(route: Activity['route'], bx: number, by: number, bw: number, bh: number) {
  const xy = project(route);
  if (!xy || xy.length < 2) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of xy) { minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); }
  const rw = Math.max(maxX - minX, 1e-9), rh = Math.max(maxY - minY, 1e-9), s = Math.min(bw / rw, bh / rh);
  const ox = bx + (bw - rw * s) / 2, oy = by + (bh - rh * s) / 2;
  return xy.map(([px, py, br]) => [ox + (px - minX) * s, oy + (py - minY) * s, br ?? 0] as [number, number, number]);
}

const lerpColor = (c1: string, c2: string, t: number) => {
  const p = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
};

function drawRoute(x: CanvasRenderingContext2D, pts: [number, number, number][], th: Theme, width: number) {
  const path = new Path2D();
  pts.forEach(([px, py, br], i) => (i === 0 || br ? path.moveTo(px, py) : path.lineTo(px, py)));
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
  if (th.glow) { x.shadowColor = th.glow; x.shadowBlur = width * 3.2; x.strokeStyle = th.route[0]; x.globalAlpha = 0.55; x.lineWidth = width; x.stroke(path); x.globalAlpha = 1; x.shadowBlur = 0; }
  if (th.under) { x.strokeStyle = th.under; x.lineWidth = width + 10; x.stroke(path); }
  const n = pts.length;
  if (th.route[0] === th.route[1]) { x.strokeStyle = th.route[0]; x.lineWidth = width; x.stroke(path); }
  // otherwise the colour shifts from start to finish
  else for (let i = 1; i < n; i++) {
    if (pts[i][2]) continue;
    x.strokeStyle = lerpColor(th.route[0], th.route[1], i / (n - 1));
    x.lineWidth = width;
    x.beginPath(); x.moveTo(pts[i - 1][0], pts[i - 1][1]); x.lineTo(pts[i][0], pts[i][1]); x.stroke();
  }
  const [sx, sy] = pts[0], [ex, ey] = pts[n - 1];
  x.fillStyle = th.startFill; x.strokeStyle = th.route[0]; x.lineWidth = width * 0.55;
  x.beginPath(); x.arc(sx, sy, width * 1.05, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = th.halo ?? th.endFill; x.globalAlpha = th.halo ? 1 : 0.25;
  x.beginPath(); x.arc(ex, ey, width * 2.6, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
  x.fillStyle = th.endFill;
  x.beginPath(); x.arc(ex, ey, width * 1.35, 0, Math.PI * 2); x.fill();
  x.restore();
}

/** The Lakad mark: route line ending in a dot */
function drawMark(x: CanvasRenderingContext2D, px: number, py: number, size: number, line: string, dot: string) {
  const s = size / 24;
  x.save(); x.translate(px, py); x.scale(s, s);
  x.strokeStyle = line; x.lineWidth = 3; x.lineCap = 'round';
  x.stroke(new Path2D('M3 18c4-1 5-9 9-9s5 8 9 7'));
  x.fillStyle = dot; x.beginPath(); x.arc(21, 16, 2.8, 0, Math.PI * 2); x.fill();
  x.restore();
}

export function shareTitle(a: Activity) {
  if (a.note) return a.note;
  const h = new Date(a.start).getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${part} ${a.type === 'run' ? 'run' : 'walk'}`;
}

function fitText(x: CanvasRenderingContext2D, text: string, max: number) {
  if (x.measureText(text).width <= max) return text;
  let t = text; while (t.length > 1 && x.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

export function drawShareCard(c: HTMLCanvasElement, a: Activity, s: Settings, style: ShareStyle, format: ShareFormat, extra: { level?: number; badge?: HTMLImageElement | null } = {}) {
  const isLevel = style === 'level', lvl = extra.level ?? 1;
  const [W, H] = SHARE_SIZES[format], th = isLevel ? levelTheme(lvl) : THEMES[style], M = 84;
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, W, H);
  th.bg?.(x, W, H);
  if (th.contour) contours(x, W, H, th.contour, seedOf(a.id));
  if (isLevel) { const lc = BADGES[Math.max(0, Math.min(BADGES.length - 1, lvl - 1))].colors; atmosphere(x, W, H, lc.fx, lc.faceDark, seedOf(a.id) + 3); }
  const badgeSize = format === 'story' ? 330 : 280, badgeAt: [number, number] = [W - M - badgeSize / 2 + 30, (format === 'story' ? 150 : 0) + 30 + badgeSize * 0.45];
  if (isLevel) { const lv = BADGES[Math.max(0, Math.min(BADGES.length - 1, lvl - 1))]; drawElement(x, lv.element, lv.colors.fx, W, H, seedOf(a.id) + 7, badgeAt); }
  x.textBaseline = 'alphabetic';
  if (th.textShadow) { x.shadowColor = th.textShadow; x.shadowBlur = 18; x.shadowOffsetY = 2; }

  // Stories: keep clear of the app controls Instagram/Facebook draw over the top and bottom
  const story = format === 'story', hy = story ? 150 : 0;
  // Header: mark + wordmark, date on the right
  drawMark(x, M, 92 + hy, 56, style === 'sunrise' ? '#0E1B33' : '#FFFFFF', style === 'sunrise' ? '#1F4FE0' : '#FFB627');
  const dateX = isLevel ? M : W - M, dateY = isLevel ? 78 : 0;
  x.fillStyle = th.text; font(x, 900, 46, true); x.fillText('Lakad', M + 68, 136 + hy);
  const d = new Date(a.start);
  x.textAlign = isLevel ? 'left' : 'right'; font(x, 600, 30); x.fillStyle = th.text;
  x.fillText(d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), dateX, 112 + hy + dateY);
  x.fillStyle = th.muted; font(x, 500, 28);
  x.fillText(d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), dateX, 150 + hy + dateY);
  // your badge in the top corner, with its level name
  if (isLevel && extra.badge) {
    const img = extra.badge, w = badgeSize * (img.width / img.height > 1.15 ? 1.3 : 1), h = w * (img.height / img.width);
    x.drawImage(img, badgeAt[0] - w / 2, badgeAt[1] - h / 2 + 6, w, h);
    x.textAlign = 'center'; font(x, 800, format === 'story' ? 38 : 34, true); x.fillStyle = th.text;
    x.fillText(BADGES[Math.max(0, Math.min(BADGES.length - 1, lvl - 1))].name, badgeAt[0], badgeAt[1] + h / 2 + 36);
  }
  x.textAlign = 'left';

  // Footer block (measured from the bottom)
  const u = s.units;
  const statsY = H - (story ? 300 : 120), distY = statsY - (story ? 150 : 118), titleY = distY - (story ? 270 : 238);
  x.fillStyle = th.text; font(x, 700, story ? 48 : 42);
  x.fillText(fitText(x, shareTitle(a), W - 2 * M), M, titleY);

  const dist = fmtDist(a.distance, u);
  font(x, 900, story ? 250 : 220, true); x.fillStyle = th.text;
  x.fillText(dist, M - 8, distY);
  const dw = x.measureText(dist).width;
  font(x, 700, story ? 60 : 52, true); x.fillStyle = th.muted;
  x.fillText(unitL(u), M + dw + 14, distY);

  // Stats row with a hairline above
  x.shadowBlur = 0; x.fillStyle = th.rule; x.fillRect(M, statsY - 96, W - 2 * M, 2);
  if (th.textShadow) x.shadowBlur = 18;
  const stats: [string, string][] = [
    [fmtTime(a.duration), 'Time'],
    [fmtPace(a.duration, a.distance, u), `Pace /${unitL(u)}`],
    [fmtInt(a.steps), 'Steps'],
    [a.elevGain != null ? `${fmtInt(a.elevGain)} m` : '–', 'Climb']
  ];
  const colW = (W - 2 * M) / stats.length;
  stats.forEach(([v, l], i) => {
    const cx = M + i * colW;
    x.fillStyle = th.text; font(x, 800, story ? 50 : 46, true); x.fillText(fitText(x, v, colW - 16), cx, statsY - 14);
    x.fillStyle = th.muted; font(x, 500, story ? 28 : 26); x.fillText(l, cx, statsY + 28);
  });
  x.shadowBlur = 0; x.shadowOffsetY = 0;

  // Route fills the space between header and title
  const top = 200 + hy, bottom = titleY - (story ? 110 : 90);
  const shared = trimRoute(a.route, s.privacyTrim ?? 200);
  const rTop = isLevel ? badgeAt[1] + badgeSize * 0.6 : top + 10;
  const pts = fitRoute(shared, M + 10, rTop, W - 2 * M - 20, Math.max(120, bottom - rTop - 10));
  const lw = story ? 15 : 13;
  if (pts) drawRoute(x, pts, th, lw);
  else {
    // indoor or manual entry: the Lakad mark, large
    const size = Math.min(W - 2 * M, bottom - top) * 0.62;
    drawMark(x, (W - size) / 2, top + (bottom - top - size) / 2, size, th.route[0], th.endFill);
    x.fillStyle = th.muted; font(x, 600, 30); x.textAlign = 'center';
    x.fillText(a.indoor ? 'Indoor' : a.route.length > 1 ? 'Route hidden for privacy' : 'Added by hand', W / 2, bottom - 10); x.textAlign = 'left';
  }
  return c;
}

export async function renderShareCard(a: Activity, s: Settings, style: ShareStyle = 'night', format: ShareFormat = 'post'): Promise<Blob> {
  try { await document.fonts.ready; } catch { /* noop */ }
  const c = drawShareCard(document.createElement('canvas'), a, s, style, format);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Image failed'))), 'image/png'));
}
