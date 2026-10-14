import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { App as CapApp } from '@capacitor/app';
import { data, saveDay } from './data';
import { addDays, sod } from './format';
import { isIOSApp } from './platform';
import { createStore } from './store';

/**
 * iPhone app only: reads each of the last 7 days' step totals from the iPhone's own step counter
 * (the same counter the Health app uses), so daily steps fill in without typing, including steps
 * taken when you weren't recording. Android's step counter can't look back in time, so there it
 * stays a manual entry.
 */
export const phoneSteps = createStore({ available: isIOSApp, lastSync: 0, error: '' as string });

let running = false, last = 0;
export async function syncPhoneSteps(force = false) {
  if (!isIOSApp || running || (!force && Date.now() - last < 30_000)) return;
  running = true; last = Date.now();
  try {
    const p = await CapacitorPedometer.checkPermissions();
    if (p.activityRecognition !== 'granted') { phoneSteps.set({ error: 'permission' }); return; }
    const today = sod(Date.now());
    for (let i = 0; i < 7; i++) {
      const start = addDays(today, -i), end = i === 0 ? Date.now() : addDays(start, 1);
      const m = await CapacitorPedometer.getMeasurement({ start, end });
      const steps = Math.round(m.numberOfSteps ?? 0);
      const cur = data.get().days[start];
      // Keep a higher number you typed yourself (e.g. from a watch worn without the phone)
      const update = steps > 0 && (!cur || (cur.auto ? cur.steps !== steps : steps > cur.steps));
      if (update) await saveDay(start, steps, true);
    }
    phoneSteps.set({ lastSync: Date.now(), error: '' });
  } catch {
    phoneSteps.set({ error: 'unavailable' });
  } finally {
    running = false;
  }
}

export function initPhoneSteps() {
  if (!isIOSApp) return;
  void syncPhoneSteps(true);
  // refresh whenever you come back to the app
  void CapApp.addListener('appStateChange', s => { if (s.isActive) void syncPhoneSteps(); });
}
