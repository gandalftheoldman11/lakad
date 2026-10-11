import type { Activity, Settings } from '../types';
import { dateLabel, fmtDist, fmtInt, fmtPace, fmtTime, typeWord, unitL } from './format';
import { fitPath, project } from './geo';

/** 1080x1350 share card (Instagram portrait size) */
export async function renderShareCard(a: Activity, s: Settings): Promise<Blob> {
  try { await document.fonts.ready; } catch { /* noop */ }
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const font = (w: number, px: number) => `${w} ${px}px "Archivo Variable", Archivo, system-ui, sans-serif`;
  x.fillStyle = '#1F4FE0'; x.fillRect(0, 0, W, H);
  if ('fontStretch' in x) (x as unknown as { fontStretch: string }).fontStretch = 'expanded';
  x.fillStyle = '#FFFFFF'; x.font = font(800, 44); x.fillText('Lakad', 80, 120);
  x.globalAlpha = 0.8; x.font = font(500, 36); x.fillText(`${typeWord(a.type)} · ${dateLabel(a.start)}`, 80, 180); x.globalAlpha = 1;
  const f = fitPath(project(a.route), 920, 560, 30);
  if (f) {
    x.save(); x.translate(80, 240);
    x.strokeStyle = '#FFFFFF'; x.lineWidth = 12; x.lineCap = 'round'; x.lineJoin = 'round';
    x.stroke(new Path2D(f.d));
    x.fillStyle = '#FFB627'; x.beginPath(); x.arc(f.end[0], f.end[1], 18, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  x.fillStyle = '#FFFFFF'; x.font = font(900, 230); x.fillText(fmtDist(a.distance, s.units), 70, 1050);
  x.font = font(700, 48); x.fillText(unitL(s.units), 84, 1115);
  [[fmtTime(a.duration), 'time'], [fmtPace(a.duration, a.distance, s.units), `pace /${unitL(s.units)}`], [fmtInt(a.steps), 'steps']].forEach(([v, l], i) => {
    x.fillStyle = '#FFFFFF'; x.font = font(800, 60); x.fillText(v, 80 + i * 330, 1235);
    x.globalAlpha = 0.75; x.font = font(500, 32); x.fillText(l, 80 + i * 330, 1280); x.globalAlpha = 1;
  });
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Image failed'))), 'image/png'));
}
