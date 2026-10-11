import type { Activity, ActivityType, DayEntry, Settings } from '../types';
import { addDays, sod } from './format';

/** Step length from height: ~0.414 x height walking, ~0.65 x height running (common research estimates) */
export function strideFromHeight(type: ActivityType, s: Settings) {
  const h = (s.height || 165) / 100;
  return type === 'run' ? h * 0.65 : h * 0.414;
}
/** Your step length: learned from your own GPS recordings when available, otherwise estimated from height */
export function strideM(type: ActivityType, s: Settings) {
  const v = type === 'run' ? s.strideRun : s.strideWalk;
  return v > 0 ? v : strideFromHeight(type, s);
}

/**
 * Calories from ACSM metabolic equations (gross VO2 in ml/kg/min; 1 L O2 ≈ 5 kcal).
 * Walking: 3.5 + 0.1·v + 1.8·v·grade. Running: 3.5 + 0.2·v + 0.9·v·grade. v in m/min.
 */
export function calories(a: Pick<Activity, 'type' | 'duration' | 'distance' | 'elevGain'>, s: Settings): number | null {
  if (!s.weight || !a.duration || !a.distance) return null;
  const min = a.duration / 60, v = a.distance / min;
  const g = a.elevGain && a.distance ? Math.min(a.elevGain / a.distance, 0.15) : 0;
  const run = a.type === 'run' && v > 100;
  const vo2 = run ? 3.5 + 0.2 * v + 0.9 * v * g : 3.5 + 0.1 * v + 1.8 * v * g;
  return Math.round((vo2 * s.weight * min) / 1000 * 5);
}

export function actStepsByDay(acts: Activity[]) {
  const m = new Map<number, number>();
  for (const a of acts) { const k = sod(a.start); m.set(k, (m.get(k) || 0) + (a.steps || 0)); }
  return m;
}
/** Daily total = higher of entered phone/watch total and sum of recorded activities */
export function stepsByDay(acts: Activity[], days: Record<number, DayEntry>) {
  const m = actStepsByDay(acts);
  for (const d of Object.values(days)) if (d.steps > 0) m.set(d.date, Math.max(m.get(d.date) || 0, d.steps));
  return m;
}
export function streak(map: Map<number, number>, goal: number) {
  let d = sod(Date.now()), n = 0;
  if ((map.get(d) || 0) < goal) d = addDays(d, -1);
  while ((map.get(d) || 0) >= goal) { n++; d = addDays(d, -1); }
  return n;
}
export function sumWhere(acts: Activity[], s: Settings, fn: (a: Activity) => boolean) {
  let dist = 0, dur = 0, steps = 0, count = 0, kcal = 0, elev = 0;
  for (const a of acts) if (fn(a)) {
    dist += a.distance || 0; dur += a.duration || 0; steps += a.steps || 0; count++;
    kcal += calories(a, s) || 0; elev += a.elevGain || 0;
  }
  return { dist, dur, steps, count, kcal, elev };
}
export function stepsBetween(map: Map<number, number>, from: number, to: number) {
  let s = 0;
  for (const [d, v] of map) if (d >= from && d < to) s += v;
  return s;
}
