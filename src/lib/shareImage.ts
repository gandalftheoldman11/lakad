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
    route: ['#FFFFFF', '#FFFFFF'], glow: 'rgba(0,0,0,0.35)', under: 'rgba(0,0,0,0.28)',   // plain white; the soft shadow keeps it visible on bright photos
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

/**
 * Cinematic "ground" along the bottom edge in the level's element: a soft, out-of-focus back layer,
 * crisper shapes in front, light rising from the edge and a few particles catching it.
 * Story size has room under the stats, so the effect is fuller there; Post keeps it low and soft.
 */
function groundFx(x: CanvasRenderingContext2D, el: Element, W: number, H: number, c: { fx: string; panelTop?: string; faceDark: string }, seed: number, story: boolean) {
  const r = rng(seed), k = story ? 1 : 0.62, top = H - (story ? 330 : 200), base = H;
  const clear = H - (story ? 238 : 52);   // stats labels end here: sparks, rain and specks stay below
  const deep = c.panelTop ?? c.faceDark;
  const blur = (px: number) => { try { x.filter = px ? `blur(${px}px)` : 'none'; } catch { /* older browsers: draw sharp */ } };
  x.save();
  // light rising from the bottom edge
  const haze = x.createLinearGradient(0, base, 0, top - 80);
  haze.addColorStop(0, hexA(c.fx, 0.42 * k)); haze.addColorStop(0.45, hexA(c.fx, 0.14 * k)); haze.addColorStop(1, hexA(c.fx, 0));
  x.globalCompositeOperation = 'screen'; x.fillStyle = haze; x.fillRect(0, top - 80, W, base - top + 80);
  x.globalCompositeOperation = 'source-over';
  const wave = (y0: number, amp: number, len: number, ph: number) => (xx: number) => y0 + Math.sin(xx / len + ph) * amp + Math.sin(xx / (len * 0.43) + ph * 2.1) * amp * 0.35;
  const fillUnder = (f: (xx: number) => number, fill: string | CanvasGradient) => { x.beginPath(); x.moveTo(0, base); for (let xx = 0; xx <= W; xx += 8) x.lineTo(xx, f(xx)); x.lineTo(W, base); x.closePath(); x.fillStyle = fill; x.fill(); };
  const bokeh = (n: number, y1: number, y2: number, rMin: number, rMax: number, col: string, a: number) => {
    for (let i = 0; i < n; i++) { const px = r() * W, py = y1 + r() * (y2 - y1), rad = rMin + r() * (rMax - rMin);
      const g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, hexA('#FFFFFF', a)); g.addColorStop(0.3, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill(); } };
  const h = base - top;
  switch (el) {
    case 'fire': case 'ember': {
      if (el === 'fire') {
        for (const [layer, hh, a, bl] of [[0, 1, 0.55, 14], [1, 0.72, 0.9, 3]] as const) {
          blur(bl); x.globalCompositeOperation = 'screen';
          const n = layer ? 16 : 10;
          for (let i = 0; i < n; i++) {
            const cx = (i + r() * 0.8) * (W / n), fw = W / n * (1.3 + r() * 0.8), fh = h * hh * k * (0.5 + r() * 0.6);
            const g = x.createLinearGradient(0, base, 0, base - fh);
            g.addColorStop(0, hexA('#FFE9A8', a)); g.addColorStop(0.35, hexA('#FF9A3D', a * 0.85)); g.addColorStop(0.75, hexA('#E2402B', a * 0.45)); g.addColorStop(1, hexA('#E2402B', 0));
            x.fillStyle = g; x.beginPath(); x.moveTo(cx - fw / 2, base);
            x.bezierCurveTo(cx - fw * 0.55, base - fh * 0.5, cx - fw * 0.1, base - fh * 0.75, cx + (r() - 0.5) * fw * 0.3, base - fh);
            x.bezierCurveTo(cx + fw * 0.1, base - fh * 0.7, cx + fw * 0.55, base - fh * 0.45, cx + fw / 2, base); x.closePath(); x.fill();
          }
        }
        blur(0);
      }
      if (el === 'ember') {
        // a smouldering bed of embers along the edge, lit from within
        blur(10); x.globalCompositeOperation = 'screen';
        const bed = x.createLinearGradient(0, base, 0, base - h * 0.45 * k); bed.addColorStop(0, hexA('#FF8A3D', 0.85)); bed.addColorStop(0.5, hexA('#E2402B', 0.35)); bed.addColorStop(1, hexA('#E2402B', 0));
        fillUnder(wave(base - h * 0.32 * k, 16, 110, r() * 6), bed); blur(2);
        for (let i = 0; i < 90; i++) { const px = r() * W, py = base - r() * h * 0.22 * k, rad = 2 + r() * 5; x.fillStyle = hexA(r() > 0.6 ? '#FFE7A0' : '#FF9A3D', 0.5 + r() * 0.5); x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill(); }
        blur(0);
      }
      // sparks rising with short light trails
      x.globalCompositeOperation = 'screen';
      for (let i = 0; i < (el === 'fire' ? 26 : 60); i++) {
        const px = r() * W, py = clear + 20 + r() * (base - clear - 20), len = 10 + r() * (el === 'ember' ? 50 : 34), rad = (2 + r() * 4) * (el === 'ember' ? 1.3 : 1), sway = (r() - 0.5) * 14;
        const g = x.createLinearGradient(px, py + len, px + sway, py); g.addColorStop(0, hexA(c.fx, 0)); g.addColorStop(1, hexA('#FFE7A0', 0.9));
        x.strokeStyle = g; x.lineWidth = rad * 0.9; x.lineCap = 'round'; x.beginPath(); x.moveTo(px - sway * 0.3, py + len); x.quadraticCurveTo(px, py + len * 0.4, px + sway, py); x.stroke();
      }
      bokeh(el === 'ember' ? 16 : 10, clear + 10, base, el === 'ember' ? 12 : 8, el === 'ember' ? 36 : 22, el === 'ember' ? '#FF9A3D' : c.fx, (el === 'ember' ? 0.5 : 0.35) * k);
      break;
    }
    case 'frost': {
      blur(22); fillUnder(wave(base - h * 0.5 * k, 22, 140, r() * 6), hexA('#FFFFFF', 0.42)); blur(10); fillUnder(wave(base - h * 0.32 * k, 16, 120, r() * 6), hexA('#EAF7FF', 0.5)); blur(0);
      const drift = x.createLinearGradient(0, base - h * 0.3 * k, 0, base); drift.addColorStop(0, hexA('#F4FBFF', 0.85)); drift.addColorStop(1, hexA('#CFE8FA', 0.95));
      fillUnder(wave(base - h * 0.2 * k, 14, 190, r() * 6), drift);
      x.globalCompositeOperation = 'screen'; bokeh(40, clear, base - 30, 3, 9, '#FFFFFF', 0.75); bokeh(8, clear, base, 14, 30, '#DFF3FF', 0.25);
      break;
    }
    case 'leaf': {
      x.globalCompositeOperation = 'screen'; bokeh(9, base - h * 0.55, base - h * 0.2, 30, 60, '#E8FF9C', 0.25); x.globalCompositeOperation = 'source-over';
      for (const [layer, col, hh] of [[0, hexA(deep, 0.65), 0.55], [1, hexA('#04210E', 0.92), 0.36]] as const) {
        if (!layer) blur(4);
        const n = Math.round(W / (layer ? 7 : 11));
        x.fillStyle = col;
        for (let i = 0; i < n; i++) {
          const bx = (i + r()) * (W / n), bh = h * hh * k * (0.35 + r() * 0.9), lean = (r() - 0.5) * bh * 0.5, bw = 3 + r() * 5;
          x.beginPath(); x.moveTo(bx - bw, base); x.quadraticCurveTo(bx + lean * 0.3, base - bh * 0.6, bx + lean, base - bh); x.quadraticCurveTo(bx + lean * 0.4 + bw * 0.3, base - bh * 0.55, bx + bw, base); x.fill();
        }
        blur(0);
      }
      x.fillStyle = hexA('#04210E', 0.92); x.fillRect(0, base - 6, W, 6);
      for (let i = 0; i < 7; i++) { const px = r() * W, py = clear + 20 + r() * (base - clear) * 0.5; x.save(); x.translate(px, py); x.rotate(r() * 6); x.scale(2.6, 2.6);
        const g = x.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, '#E9FFC8'); g.addColorStop(1, c.fx); x.fillStyle = g; x.globalAlpha = 0.85;
        x.beginPath(); x.moveTo(0, -7); x.bezierCurveTo(5.5, -3, 5.5, 3, 0, 7); x.bezierCurveTo(-5.5, 3, -5.5, -3, 0, -7); x.fill(); x.restore(); }
      break;
    }
    case 'water': {
      const layers: [number, number, number, number][] = [[0.62, 22, 0.28, 10], [0.42, 18, 0.5, 4], [0.22, 14, 0.85, 0]];
      layers.forEach(([hh, amp, a, bl], i) => {
        blur(bl); const f = wave(base - h * hh * k, amp, 120 + i * 40, r() * 6);
        const g = x.createLinearGradient(0, base - h * hh * k - amp, 0, base); g.addColorStop(0, hexA(c.fx, a)); g.addColorStop(1, hexA(deep, Math.min(1, a + 0.2)));
        fillUnder(f, g); blur(0);
        x.globalCompositeOperation = 'screen'; x.strokeStyle = hexA('#FFFFFF', 0.35 + i * 0.15); x.lineWidth = 2;
        x.beginPath(); for (let xx = 0; xx <= W; xx += 8) (xx ? x.lineTo(xx, f(xx)) : x.moveTo(xx, f(xx))); x.stroke(); x.globalCompositeOperation = 'source-over';
        for (let j = 0; j < 8; j++) { const px = r() * W, py = f(px) + 2; const g2 = x.createRadialGradient(px, py, 0, px, py, 16); g2.addColorStop(0, 'rgba(255,255,255,.9)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g2; x.fillRect(px - 16, py - 16, 32, 32); }
      });
      x.globalCompositeOperation = 'screen'; bokeh(12, clear, base - h * 0.3, 4, 10, '#BDEBFF', 0.55);
      break;
    }
    case 'storm': {
      const puffs = Array.from({ length: 10 }, (_, i) => [(i / 9) * W + (r() - 0.5) * 80, base - h * (0.2 + r() * 0.3) * k, 120 + r() * 100] as const);
      // lit rims first, then the dark cloud bodies over them
      blur(26); x.globalCompositeOperation = 'screen';
      for (const [cx, cy, rad] of puffs) { x.fillStyle = hexA(c.fx, 0.45); x.beginPath(); x.arc(cx, cy - 18, rad, 0, Math.PI * 2); x.fill(); }
      blur(14); x.globalCompositeOperation = 'source-over';
      for (const [cx, cy, rad] of puffs) { x.fillStyle = 'rgba(16,6,34,.88)'; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill(); }
      blur(0);
      // lightning glowing inside the clouds
      x.globalCompositeOperation = 'screen';
      for (const [gx, gr] of [[W * (0.18 + r() * 0.15), 260], [W * (0.68 + r() * 0.12), 320]] as const) { const gy = base - h * 0.32 * k, g = x.createRadialGradient(gx, gy, 0, gx, gy, gr); g.addColorStop(0, 'rgba(246,228,255,.95)'); g.addColorStop(0.3, hexA(c.fx, 0.55)); g.addColorStop(1, hexA(c.fx, 0)); x.fillStyle = g; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2); }
      const bolt = (sx: number, sy: number, steps: number, wdt: number) => { x.lineWidth = wdt; let bx = sx, by = sy; x.beginPath(); x.moveTo(bx, by); const pts: [number, number][] = [];
        for (let i = 0; i < steps; i++) { bx += (r() - 0.5) * 60; by += h * 0.075 * k; x.lineTo(bx, by); pts.push([bx, by]); } x.stroke(); return pts; };
      x.strokeStyle = 'rgba(255,255,255,.97)'; x.shadowColor = '#F2D4FF'; x.shadowBlur = 26; x.lineJoin = 'round'; x.lineCap = 'round';
      const main = bolt(W * (0.66 + r() * 0.08), base - h * 0.62 * k, 7, 4.5);
      bolt(main[2][0], main[2][1], 3, 2.2); bolt(main[4][0], main[4][1], 2, 1.6);
      x.shadowBlur = 0;
      x.strokeStyle = 'rgba(225,205,255,.28)'; x.lineWidth = 2;
      for (let i = 0; i < 90; i++) { const px = r() * W, py = clear + r() * (base - clear); x.beginPath(); x.moveTo(px, py); x.lineTo(px - 10, py + 38); x.stroke(); }
      break;
    }
    case 'wind': {
      const dune = x.createLinearGradient(0, base - h * 0.3 * k, 0, base); dune.addColorStop(0, hexA('#FFFFFF', 0.4)); dune.addColorStop(1, hexA('#FFFFFF', 0.16));
      blur(6); fillUnder(wave(base - h * 0.28 * k, 26, 260, r() * 6), dune); blur(0);
      x.globalCompositeOperation = 'screen'; x.lineCap = 'round';
      for (let i = 0; i < 24; i++) {
        const y0 = base - h * (0.06 + r() * 0.8) * k, x0 = -100 + r() * W * 0.4, len = W * (0.5 + r() * 0.7), amp = 20 + r() * 44, w = 2 + r() * 5;
        const g = x.createLinearGradient(x0, 0, x0 + len, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.4, `rgba(255,255,255,${0.45 + r() * 0.45})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        if (i < 8) { blur(5); }
        x.strokeStyle = g; x.lineWidth = i < 8 ? w * 2.4 : w; x.beginPath(); x.moveTo(x0, y0); x.bezierCurveTo(x0 + len * 0.3, y0 - amp, x0 + len * 0.6, y0 + amp, x0 + len, y0 - amp * 0.4); x.stroke(); blur(0);
      }
      // blowing sand: short streaks along the wind
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2;
      for (let i = 0; i < 40; i++) { const px = r() * W, py = base - r() * h * 0.6 * k, l = 8 + r() * 22; x.beginPath(); x.moveTo(px, py); x.lineTo(px + l, py - l * 0.18); x.stroke(); }
      bokeh(14, clear, base, 2, 5, '#FFFFFF', 0.7);
      break;
    }
    case 'cosmic': {
      // stars above, then a glowing planet horizon
      x.globalCompositeOperation = 'screen'; bokeh(40, clear, base - h * 0.25, 1.5, 4, '#FFF6D0', 0.9);
      const R = W * 2.2, cx = W * 0.5, cy = base - h * 0.32 * k + R;
      const atm = x.createRadialGradient(cx, cy, R - 6, cx, cy, R + 120); atm.addColorStop(0, hexA('#FFE27A', 0.95)); atm.addColorStop(0.08, hexA(c.fx, 0.55)); atm.addColorStop(1, hexA(c.fx, 0));
      x.fillStyle = atm; x.fillRect(0, top - 140, W, base - top + 140);
      x.globalCompositeOperation = 'source-over';
      const planet = x.createLinearGradient(0, cy - R, 0, base); planet.addColorStop(0, hexA(deep, 0.95)); planet.addColorStop(1, hexA('#02130A', 0.98));
      x.fillStyle = planet; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
      x.globalCompositeOperation = 'screen'; x.strokeStyle = hexA('#FFF1B0', 0.9); x.lineWidth = 3; x.shadowColor = '#FFE27A'; x.shadowBlur = 24;
      x.beginPath(); x.arc(cx, cy, R, Math.PI * 1.25, Math.PI * 1.75); x.stroke(); x.shadowBlur = 0;
      break;
    }
  }
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
  if (isLevel) {
    const lb = BADGES[Math.max(0, Math.min(BADGES.length - 1, lvl - 1))];
    atmosphere(x, W, H, lb.colors.fx, lb.colors.faceDark, seedOf(a.id) + 3);
    groundFx(x, lb.element, W, H, lb.colors, seedOf(a.id) + 11, format === 'story');
  }
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
