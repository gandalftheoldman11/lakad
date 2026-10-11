import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { Activity, DayEntry, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { supabase } from './supabase';
import { account, loadProfile } from './account';
import { data, replaceAll, setChangeHook } from './data';

let running: Promise<void> | null = null;
let again = false;

/** Two-way merge: newest updatedAt wins for every activity, day entry and the settings */
export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  running = doSync().finally(() => {
    running = null;
    if (again) { again = false; void syncNow(); }
  });
  return running;
}

/** Supabase returns at most 1000 rows per request, so page through everything */
async function fetchAll<T>(table: string, cols: string, uid: string): Promise<T[]> {
  if (!supabase) return [];
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: rows, error } = await supabase.from(table).select(cols).eq('user_id', uid).order(table === 'day_steps' ? 'date' : 'id').range(from, from + 999);
    if (error) throw error;
    out.push(...((rows || []) as T[]));
    if (!rows || rows.length < 1000) return out;
  }
}

async function doSync() {
  const session = account.get().session;
  if (!supabase || !session) return;
  const uid = session.user.id;
  account.set({ syncing: true, syncError: '' });
  try {
    // A different account signed in on this device: start from that account's data, don't merge the previous person's
    const owner = await idbGet<string>('owner').catch(() => undefined);
    if (owner && owner !== uid) await replaceAll([], {}, DEFAULT_SETTINGS);
    if (owner !== uid) await idbSet('owner', uid).catch(() => {});

    const [raRows, rdRows, rs] = await Promise.all([
      fetchAll<{ id: string; data: Activity; updated_ms: number }>('activities', 'id,data,updated_ms', uid),
      fetchAll<{ date: number; steps: number; updated_ms: number }>('day_steps', 'date,steps,updated_ms', uid),
      supabase.from('settings').select('data,updated_ms').eq('user_id', uid).maybeSingle()
    ]);
    if (rs.error) throw rs.error;
    const ra = { data: raRows }, rd = { data: rdRows };

    const local = data.get();
    // Activities
    const remote = new Map(ra.data.map(r => [r.id, { data: r.data, updated_ms: Number(r.updated_ms) }]));
    const merged = new Map<string, Activity>();
    const push: Activity[] = [];
    for (const a of local.all) {
      const r = remote.get(a.id);
      if (!r || a.updatedAt > r.updated_ms) { merged.set(a.id, a); push.push(a); }
      else merged.set(a.id, { ...r.data, updatedAt: r.updated_ms });
    }
    for (const [id, r] of remote) if (!merged.has(id)) merged.set(id, { ...r.data, updatedAt: r.updated_ms });

    // Day entries
    const days: Record<number, DayEntry> = { ...local.days };
    const pushDays: DayEntry[] = [];
    const rDays = new Map(rd.data.map(r => [Number(r.date), { steps: r.steps, updated_ms: Number(r.updated_ms) }]));
    for (const d of Object.values(local.days)) {
      const r = rDays.get(d.date);
      if (!r || d.updatedAt > r.updated_ms) pushDays.push(d);
    }
    for (const [date, r] of rDays) {
      const l = days[date];
      if (!l || r.updated_ms > l.updatedAt) days[date] = { date, steps: r.steps, updatedAt: r.updated_ms };
    }

    // Settings
    let settings: Settings = local.settings;
    let pushSettings = false;
    if (rs.data && Number(rs.data.updated_ms) > local.settings.updatedAt) settings = { ...DEFAULT_SETTINGS, ...(rs.data.data as Settings), updatedAt: rs.data.updated_ms };
    else if (!rs.data || local.settings.updatedAt > Number(rs.data.updated_ms)) pushSettings = local.settings.updatedAt > 0;

    // Push local changes
    for (let i = 0; i < push.length; i += 100) {
      const rows = push.slice(i, i + 100).map(a => ({ user_id: uid, id: a.id, data: a, updated_ms: a.updatedAt }));
      const { error } = await supabase.from('activities').upsert(rows);
      if (error) throw error;
    }
    if (pushDays.length) {
      const { error } = await supabase.from('day_steps').upsert(pushDays.map(d => ({ user_id: uid, date: d.date, steps: d.steps, updated_ms: d.updatedAt })));
      if (error) throw error;
    }
    if (pushSettings) {
      const { error } = await supabase.from('settings').upsert({ user_id: uid, data: local.settings, updated_ms: local.settings.updatedAt });
      if (error) throw error;
    }
    // Apply merge only if nothing changed locally while we were syncing
    if (data.get().all === local.all && data.get().days === local.days && data.get().settings === local.settings) {
      await replaceAll([...merged.values()], days, settings);
    } else again = true;
    account.set({ lastSync: Date.now() });
  } catch (e) {
    account.set({ syncError: navigator.onLine ? 'Sync failed. Your data is safe on this device.' : 'Offline. Changes will sync when you reconnect.' });
    console.warn('Sync failed', e);
  } finally {
    account.set({ syncing: false });
  }
}

let debounce: ReturnType<typeof setTimeout> | undefined;
export function initSync() {
  if (!supabase) return;
  setChangeHook(() => { clearTimeout(debounce); debounce = setTimeout(() => void syncNow(), 1500); });
  supabase.auth.getSession().then(({ data: d }) => {
    account.set({ session: d.session });
    if (d.session) { void loadProfile(); void syncNow(); }
  });
  supabase.auth.onAuthStateChange((event, session) => {
    account.set({ session });
    if (event === 'SIGNED_IN') { void loadProfile(); void syncNow(); }
    if (event === 'SIGNED_OUT') account.set({ displayName: '' });
  });
  window.addEventListener('online', () => void syncNow());
}
