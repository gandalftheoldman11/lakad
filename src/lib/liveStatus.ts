import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isAndroidApp, isIOSApp } from './platform';

/**
 * Live stats on the lock screen while recording:
 * - iPhone app: a Live Activity (lock screen + Dynamic Island), ticking timer drawn by iOS itself
 * - Android app: a silent, ongoing notification that updates every few seconds
 * - Web: not possible (browsers can't draw on the lock screen)
 */
export interface LiveStats {
  activity: 'Walk' | 'Run';
  distance: string;      // "2.34"
  unit: string;          // "km"
  steps: string;         // "3,120"
  pace: string;          // "7:45" or "–"
  time: string;          // "28:15" (Android text)
  movingSeconds: number;
  paused: boolean;
}

interface LiveActivityPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(o: LiveStats): Promise<{ started: boolean; error?: string }>;
  update(o: LiveStats): Promise<void>;
  end(o: Partial<LiveStats> & { immediate: boolean }): Promise<void>;
}
const LakadLiveActivity = registerPlugin<LiveActivityPlugin>('LakadLiveActivity');

const NOTIF_ID = 4242;
const CHANNEL = 'lakad-live';
const MIN_INTERVAL = 5000;   // iOS and Android both rate-limit frequent updates

let active = false;
export const liveActive = () => active;
let lastSent = 0;
let lastKey = '';
let lastPaused: boolean | null = null;
let pending: LiveStats | null = null;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let channelReady = false;

async function ensureChannel() {
  if (channelReady) return;
  try {
    // Low importance: no sound, no pop-up, still shown on the lock screen. Visibility public: shows the numbers when locked.
    await LocalNotifications.createChannel({ id: CHANNEL, name: 'Live recording stats', description: 'Distance, time and steps while Lakad is recording', importance: 2, visibility: 1, vibration: false });
    channelReady = true;
  } catch { /* older Android: default channel */ }
}

async function send(s: LiveStats) {
  lastSent = Date.now();
  lastKey = `${s.distance}|${s.steps}|${s.pace}|${s.paused}|${s.time}`;
  lastPaused = s.paused;
  try {
    if (isIOSApp) await LakadLiveActivity.update(s);
    else if (isAndroidApp) {
      await LocalNotifications.schedule({ notifications: [{
        id: NOTIF_ID,
        channelId: CHANNEL,
        title: s.paused ? `${s.activity} paused · ${s.time}` : `${s.activity} · ${s.time}`,
        body: `${s.distance} ${s.unit} · ${s.steps} steps · ${s.pace} /${s.unit}`,
        largeBody: `${s.distance} ${s.unit}  ·  ${s.steps} steps\nAverage pace ${s.pace} /${s.unit}  ·  Moving time ${s.time}`,
        ongoing: true,
        autoCancel: false,
        smallIcon: 'ic_tracking',
        iconColor: '#1F4FE0'
      }] });
    }
  } catch { /* a missed update is harmless; the next one replaces it */ }
}

export async function startLive(s: LiveStats) {
  if (!isIOSApp && !isAndroidApp) return;
  active = true; lastSent = 0; lastKey = ''; pending = null;
  try {
    if (isIOSApp) { await LakadLiveActivity.start(s); lastSent = Date.now(); lastPaused = s.paused; return; }
    await ensureChannel();
    await send(s);
  } catch { /* lock-screen stats are a convenience; recording continues regardless */ }
}

/** Call as often as you like; sends at most every 5 s, immediately when paused/resumed */
export function updateLive(s: LiveStats) {
  if (!active) return;
  const key = `${s.distance}|${s.steps}|${s.pace}|${s.paused}|${s.time}`;
  if (key === lastKey) return;
  const pausedChanged = lastPaused !== s.paused;
  // On iPhone the timer ticks by itself, so only distance/steps/pace/paused changes need sending
  if (isIOSApp && !pausedChanged && key.split('|').slice(0, 4).join('|') === lastKey.split('|').slice(0, 4).join('|')) return;
  if (pausedChanged || Date.now() - lastSent >= MIN_INTERVAL) { clearTimeout(flushTimer); pending = null; void send(s); return; }
  pending = s;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { if (pending && active) { const p = pending; pending = null; void send(p); } }, MIN_INTERVAL - (Date.now() - lastSent));
}

/** finished = keep the final result on the iPhone lock screen for 5 minutes; otherwise remove right away */
export async function endLive(final?: LiveStats, finished = false) {
  clearTimeout(flushTimer); pending = null;
  const wasActive = active;
  active = false;
  try {
    if (isIOSApp) await LakadLiveActivity.end({ ...(final || {}), immediate: !finished || !final });
    else if (isAndroidApp && (wasActive || !final)) await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
  } catch { /* nothing to end */ }
}
