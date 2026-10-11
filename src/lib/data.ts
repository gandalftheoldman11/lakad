import { get, set } from 'idb-keyval';
import type { Activity, DayEntry, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { createStore } from './store';

interface DataState {
  ready: boolean;
  all: Activity[];          // includes tombstones (deleted) for sync
  acts: Activity[];         // visible, newest first
  days: Record<number, DayEntry>;
  settings: Settings;
}
export const data = createStore<DataState>({ ready: false, all: [], acts: [], days: {}, settings: DEFAULT_SETTINGS });

const visible = (all: Activity[]) => all.filter(a => !a.deleted).sort((a, b) => b.start - a.start);
let onChange: (() => void) | null = null;
/** Sync layer registers here to push changes after local writes */
export function setChangeHook(fn: () => void) { onChange = fn; }

async function persist() {
  const s = data.get();
  try { await Promise.all([set('acts', s.all), set('days', s.days), set('settings', s.settings)]); }
  catch (e) { console.error('Local save failed', e); }
}

export async function loadData() {
  try {
    const [all, days, settings] = await Promise.all([get<Activity[]>('acts'), get<Record<number, DayEntry>>('days'), get<Settings>('settings')]);
    const a = all || [];
    data.set({ ready: true, all: a, acts: visible(a), days: days || {}, settings: { ...DEFAULT_SETTINGS, ...(settings || {}) } });
  } catch {
    data.set({ ready: true });
  }
}

/** Replace everything (used by sync merge) */
export async function replaceAll(all: Activity[], days: Record<number, DayEntry>, settings: Settings) {
  data.set({ all, acts: visible(all), days, settings });
  await persist();
}

export async function saveActivity(a: Activity) {
  const stamped = { ...a, updatedAt: Date.now() };
  const all = data.get().all.filter(x => x.id !== a.id).concat(stamped);
  data.set({ all, acts: visible(all) });
  await persist(); onChange?.();
  return stamped;
}
export async function deleteActivity(id: string) {
  const all = data.get().all.map(x => (x.id === id ? { ...x, deleted: true, route: [], note: '', updatedAt: Date.now() } : x));
  data.set({ all, acts: visible(all) });
  await persist(); onChange?.();
}
export async function saveDay(date: number, steps: number) {
  const days = { ...data.get().days, [date]: { date, steps: Math.max(0, Math.round(steps)), updatedAt: Date.now() } };
  data.set({ days });
  await persist(); onChange?.();
}
export async function saveSettings(patch: Partial<Settings>) {
  const settings = { ...data.get().settings, ...patch, updatedAt: Date.now() };
  data.set({ settings });
  await persist(); onChange?.();
}
