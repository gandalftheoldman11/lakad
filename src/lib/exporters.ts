import type { Activity, DayEntry, Settings } from '../types';
import { calories } from './metrics';
import { fmtP, hm, ymd } from './format';
import { segments } from './geo';

const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function activitiesCsv(acts: Activity[], s: Settings) {
  const rows: unknown[][] = [['date', 'start_time', 'type', 'moving_time_s', 'distance_km', 'distance_mi', 'avg_pace_per_km', 'steps', 'steps_source', 'calories_kcal', 'elevation_gain_m', 'note']];
  for (const a of acts) {
    const p = a.distance ? a.duration / (a.distance / 1000) : null;
    rows.push([ymd(a.start), hm(a.start), a.type, a.duration, (a.distance / 1000).toFixed(3), (a.distance / 1609.344).toFixed(3),
      p && p < 3600 ? fmtP(p) : '', a.steps, a.stepsSource, calories(a, s) ?? '', a.elevGain ?? '', a.note]);
  }
  return '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\n');
}

const xmlEsc = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
/** GPX 1.1 track with real timestamps. Opens in Strava, Garmin Connect, Google Earth and most map apps. */
export function activityGpx(a: Activity) {
  // Route point times are moving seconds; rebuild wall-clock-ish times from the start
  const segs = segments(a.route).map(seg => `<trkseg>${seg.map(p =>
    `<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(a.start + p[2] * 1000).toISOString()}</time></trkpt>`).join('')}</trkseg>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Lakad" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${xmlEsc(a.note || (a.type === 'run' ? 'Run' : 'Walk'))}</name><time>${new Date(a.start).toISOString()}</time></metadata>
<trk><name>${xmlEsc(a.note || (a.type === 'run' ? 'Run' : 'Walk'))}</name><type>${a.type === 'run' ? 'running' : 'walking'}</type>${segs}</trk>
</gpx>`;
}

export function backupJson(all: Activity[], days: Record<number, DayEntry>, settings: Settings) {
  return JSON.stringify({ app: 'lakad', version: 2, exportedAt: Date.now(), settings, activities: all.filter(a => !a.deleted), days: Object.values(days) });
}
export function parseBackup(text: string): { activities: Activity[]; days: DayEntry[]; settings?: Partial<Settings> } {
  const d = JSON.parse(text);
  if (d?.app !== 'lakad') throw new Error('not a Lakad backup');
  const raw: unknown[] = Array.isArray(d.activities) ? d.activities : Array.isArray(d.acts) ? d.acts : [];
  const activities: Activity[] = [];
  for (const x of raw as Record<string, unknown>[]) {
    if (!x || typeof x.id !== 'string' || !x.start || !x.duration) continue;
    activities.push({
      id: x.id.slice(0, 60), type: x.type === 'run' ? 'run' : 'walk', start: Number(x.start), duration: Number(x.duration),
      distance: Number(x.distance) || 0, steps: Number(x.steps) || 0,
      stepsSource: (['pedometer', 'sensor', 'estimate', 'manual'] as const).includes(x.stepsSource as never) ? (x.stepsSource as Activity['stepsSource']) : 'manual',
      route: Array.isArray(x.route) ? (x.route as Activity['route']) : [], elevGain: x.elevGain == null ? null : Number(x.elevGain),
      note: String(x.note || '').slice(0, 140), distanceEdited: !!x.distanceEdited, updatedAt: Date.now()
    });
  }
  const days: DayEntry[] = (Array.isArray(d.days) ? d.days : [])
    .filter((x: DayEntry) => x && x.date && x.steps >= 0)
    .map((x: DayEntry) => ({ date: Number(x.date), steps: Number(x.steps), updatedAt: Date.now() }));
  return { activities, days, settings: d.settings };
}
