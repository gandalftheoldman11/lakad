import type { ActivityType, Units } from '../types';

export const DAY = 86_400_000;
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const sod = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const ymd = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const hm = (t: number) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
export const newId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const unitM = (u: Units) => (u === 'mi' ? 1609.344 : 1000);
export const unitL = (u: Units) => (u === 'mi' ? 'mi' : 'km');
export const unitWord = (u: Units, n: number) => (u === 'mi' ? (n === 1 ? 'mile' : 'miles') : n === 1 ? 'kilometer' : 'kilometers');

export function fmtDist(m: number, u: Units) {
  const v = (m || 0) / unitM(u);
  return v.toFixed(v >= 100 ? 0 : 2);
}
export const fmtInt = (n: number | null | undefined) => Math.round(n || 0).toLocaleString();
export function fmtTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${pad2(m)}:${pad2(r)}` : `${m}:${pad2(r)}`;
}
export function fmtDur(sec: number) {
  const t = Math.round(sec);
  if (t === 0) return '0m';
  if (t < 600) return `${Math.floor(t / 60)}m ${t % 60}s`;
  const h = Math.floor(t / 3600), m = Math.round((t % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
/** seconds per unit, or null when not meaningful */
export function paceSec(sec: number, m: number, u: Units): number | null {
  if (!m || m < 20 || !sec) return null;
  const p = sec / (m / unitM(u));
  return p > 3600 ? null : p;
}
export function fmtP(p: number | null) {
  if (p == null) return '–';
  const s = Math.round(p);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}
export const fmtPace = (sec: number, m: number, u: Units) => fmtP(paceSec(sec, m, u));
export const dateLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const timeLabel = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
export const typeWord = (t: ActivityType) => (t === 'run' ? 'Run' : 'Walk');
export function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
/** Calendar-correct day arithmetic (safe across daylight-saving changes) */
export function addDays(t: number, n: number) {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}
export function weekStart(t: number) {
  const d = new Date(sod(t));
  return addDays(d.getTime(), -((d.getDay() + 6) % 7)); // Monday
}
