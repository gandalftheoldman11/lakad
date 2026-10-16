import type { Activity, ActivityType, RoutePoint, StepsSource } from '../types';
import { createStore } from './store';
import { createTracker, type Fix, type Tracker } from './tracker';
import { hav, splitsOf, thinRoute } from './geo';
import { KalmanLatLng } from './gpsFilter';
import { StepDetector } from './stepDetector';
import { createPedometer, type Pedometer } from './pedometer';
import { data, saveActivity, saveSettings } from './data';
import { strideM } from './metrics';
import { fmtDist, fmtInt, fmtPace, fmtTime, newId, paceSec, unitL, unitM, unitWord } from './format';
import { endLive, liveActive, startLive, updateLive, type LiveStats } from './liveStatus';
import { buzz, speak, unlockSpeech } from './alerts';
import { isNative } from './platform';

/** ok ≤20 m · fair ≤50 m (used) · weak >50 m (ignored) · coarse >500 m (Precise Location is off) */
export type GeoState = 'waiting' | 'ok' | 'fair' | 'weak' | 'coarse' | 'blocked' | 'off';
export type MotionState = 'pending' | 'on' | 'denied' | 'none';
const MAX_ACCURACY = 50;
/** Kalman process noise tuned by simulation (see README "How accuracy works") */
const KALMAN_Q = { walk: 2, run: 4 } as const;
const SIGMA_K = 2, MIN_MOVE = 2;

export interface Session {
  type: ActivityType;
  indoor: boolean;      // no GPS: distance from steps × your step length
  startedAt: number;
  acc: number;          // ms of moving time banked before `since`
  since: number;        // ms epoch when current moving stretch began
  paused: boolean;
  auto: boolean;        // paused by auto-pause
  points: RoutePoint[];
  distance: number;
  sensorSteps: number;  // accelerometer detection
  motionEvents: number;
  motion: MotionState;
  hwSteps: number;      // hardware pedometer (native app)
  hw: 'pending' | 'on' | 'denied' | 'none';
  geo: GeoState;
  /** latest position and its accuracy in metres, even if too rough to record */
  here?: [number, number, number] | null;
  /** latest smoothed position; movement since the last route point that's still inside GPS uncertainty */
  tail?: [number, number] | null;
  /** web only: when the screen locked mid-recording (GPS and sensors were frozen) */
  gapFrom?: number | null;
  /** distance bridged across screen-lock gaps (no steps were sensed there) */
  gapDistance?: number;
  fixTotal: number;     // GPS quality bookkeeping
  fixUsed: number;
  fixGood: number;
  brk: boolean;         // next point starts a new segment
  lastMoveAt: number;
  lastSplit: number;
  /** planned route being followed, if any */
  plan?: { coords: [number, number][]; target: number; goalHit?: boolean };
  /** moving seconds at the last km/mile split */
  lastSplitT?: number;
  elevGain: number | null;
  altRef: number | null;
  altEma: number | null;
}

const KEY = 'lakad.recording';
export interface SplitEvent { n: number; sec: number; unit: 'km' | 'mi'; at: number }
export const rec = createStore({ session: null as Session | null, pending: null as Session | null, now: Date.now(), split: null as SplitEvent | null, goalAt: 0 });

let tracker: Tracker | null = null;
let pedometer: Pedometer | null = null;
let hwLast = -1;
let timer: ReturnType<typeof setInterval> | undefined;
let wakeLock: { release(): Promise<void> } | null = null;
let kf: KalmanLatLng | null = null;
const detector = new StepDetector(0.9, 6, 1.4);
// Speed check works on raw fixes with real timestamps: [lat, lng, timeMs, accuracy]
let lastRaw: [number, number, number, number] | null = null;
// Consecutive raw fixes rejected as "impossible jumps" that agree with each other mean the previous fix was bad
let jumpRejects: [number, number][] = [];

export const elapsed = (s: Session, now = Date.now()) => (s.acc + (s.paused ? 0 : now - s.since)) / 1000;

/* ---------------- lock-screen stats (native apps) ---------------- */
function liveStats(s: Session): LiveStats {
  const u = data.get().settings.units, sec = elapsed(s);
  return { activity: s.type === 'run' ? 'Run' : 'Walk', distance: fmtDist(s.distance, u), unit: unitL(u), steps: fmtInt(stepInfo(s).steps),
    pace: fmtPace(sec, s.distance, u), time: fmtTime(sec), movingSeconds: Math.round(sec), paused: s.paused };
}
// Every change to the recording (GPS fix, step, pause, clock tick) refreshes the lock screen; liveStatus throttles it
rec.subscribe(() => { const s = rec.get().session; if (s && liveActive()) updateLive(liveStats(s)); });
const liveWanted = () => data.get().settings.lockScreen !== false;

let lastPersist = 0;
/** Save the in-progress recording so it survives the app closing. Throttled unless forced. */
function persist(force = true) {
  const s = rec.get().session;
  if (!s) return;
  if (!force && Date.now() - lastPersist < 4000) return;
  lastPersist = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, acc: s.paused ? s.acc : s.acc + Date.now() - s.since, since: Date.now(), paused: true })); } catch { /* full or blocked */ }
}
function clearPersisted() { try { localStorage.removeItem(KEY); } catch { /* noop */ } }
/** Fill fields missing from recordings saved by older versions */
function normalise(p: Partial<Session>): Session {
  return { indoor: false, motion: 'pending', hwSteps: 0, hw: 'pending', fixTotal: 0, fixUsed: 0, fixGood: 0, here: null, sensorSteps: 0, motionEvents: 0, gapFrom: null, gapDistance: 0, ...p } as Session;
}
export function loadPending() {
  try { const raw = localStorage.getItem(KEY); if (raw) rec.set({ pending: normalise(JSON.parse(raw)) }); } catch { /* noop */ }
}
function update(patch: Partial<Session>) {
  const s = rec.get().session; if (!s) return;
  rec.set({ session: { ...s, ...patch } });
}

/* ---------------- steps ---------------- */
function onMotion(e: DeviceMotionEvent) {
  const s = rec.get().session;
  const a = e.accelerationIncludingGravity;
  if (!s || !a || a.x == null || a.y == null || a.z == null) return;
  s.motionEvents++;
  if (s.motion !== 'on') s.motion = 'on';
  if (s.paused) return;
  const added = detector.push(e.timeStamp || performance.now(), Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z));
  if (added) s.sensorSteps += added;
}
function onHwSteps(sinceStart: number) {
  const s = rec.get().session; if (!s) return;
  if (s.hw !== 'on') s.hw = 'on';                  // first reading proves the counter works
  if (hwLast < 0) { hwLast = sinceStart; return; }
  const delta = sinceStart - hwLast;
  hwLast = sinceStart;
  if (delta > 0 && !s.paused) s.hwSteps += delta;   // steps while paused don't count
}

/**
 * Best available step count:
 * 1. phone's hardware pedometer (native app), 2. accelerometer detection if it agrees with GPS,
 * 3. GPS distance ÷ your step length.
 */
export function stepInfo(s: Session): { steps: number; src: StepsSource } {
  const stride = strideM(s.type, data.get().settings);
  if (s.hw === 'on') return { steps: s.hwSteps, src: 'pedometer' };
  const sensorOk = s.motionEvents > 40 && s.sensorSteps > 10;
  const gapSteps = Math.round((s.gapDistance || 0) / stride);   // steps the frozen sensor couldn't count
  if (sensorOk && !s.indoor && s.distance - (s.gapDistance || 0) > 300 && s.fixUsed > 30) {
    const len = (s.distance - (s.gapDistance || 0)) / s.sensorSteps;
    // e.g. the screen was off and the sensor stopped: GPS distance is more trustworthy
    if (len < stride * 0.6 || len > stride * 1.6) return { steps: Math.round(s.distance / stride), src: 'estimate' };
  }
  if (sensorOk) return { steps: s.sensorSteps + gapSteps, src: 'sensor' };
  if (s.indoor) return { steps: 0, src: 'estimate' };
  return { steps: Math.round(s.distance / stride), src: 'estimate' };
}
/** Distance implied by counted steps and your step length (null if steps weren't actually counted) */
export function stepDistance(s: Session): number | null {
  const si = stepInfo(s);
  if (si.src !== 'pedometer' && si.src !== 'sensor') return null;
  return si.steps * strideM(s.type, data.get().settings);
}
/** Share of GPS fixes good enough to record (0–1) */
export const gpsQuality = (s: Session) => (s.fixTotal ? s.fixUsed / s.fixTotal : 0);

/* ---------------- GPS ---------------- */
function onFix(f: Fix) {
  const s = rec.get().session; if (!s || s.indoor) return;
  const settings = data.get().settings;
  const geo: GeoState = f.accuracy <= 20 ? 'ok' : f.accuracy <= MAX_ACCURACY ? 'fair' : f.accuracy <= 500 ? 'weak' : 'coarse';
  const here: [number, number, number] = [f.lat, f.lng, Math.round(f.accuracy)];
  const counts = { fixTotal: s.fixTotal + (s.paused ? 0 : 1), fixUsed: s.fixUsed + (!s.paused && f.accuracy <= MAX_ACCURACY ? 1 : 0), fixGood: s.fixGood + (!s.paused && f.accuracy <= 20 ? 1 : 0) };
  if (f.accuracy > MAX_ACCURACY) { update({ geo, here, ...counts }); return; }
  const last = s.points[s.points.length - 1];
  let next: Partial<Session> = { geo, here, ...counts };

  if (s.paused) {
    // Auto-resume when movement is clearly beyond GPS noise. The walk from where you stood counts as distance.
    if (s.auto && last && hav(last, [f.lat, f.lng]) > Math.max(10, f.accuracy)) {
      next = { ...next, paused: false, auto: false, since: Date.now(), lastMoveAt: Date.now() };
      Object.assign(s, next);
      detector.reset();
      kf?.reset();   // jump straight to where you are now instead of lagging behind
    } else { lastRaw = [f.lat, f.lng, f.time || Date.now(), f.accuracy]; update(next); return; }
  }

  // Impossible jump: compare with the previous raw fix using real time (smoothed positions can legitimately catch up fast)
  const tNow = f.time || Date.now();
  let brk = s.brk;
  if (lastRaw && !brk) {
    const dr = hav(lastRaw, [f.lat, f.lng]), dtr = Math.max(1, (tNow - lastRaw[2]) / 1000);
    if (dr / dtr > (s.type === 'run' ? 12 : 7) && dr > f.accuracy + lastRaw[3]) {
      const prev = jumpRejects[jumpRejects.length - 1];
      jumpRejects = prev && hav(prev, [f.lat, f.lng]) < 40 ? [...jumpRejects, [f.lat, f.lng]] : [[f.lat, f.lng]];
      if (jumpRejects.length < 3) { update(next); return; }
      // Three agreeing fixes far from the earlier ones: the earlier fix was wrong. Restart the line here.
      kf?.reset();
      brk = true;
    }
  }
  jumpRejects = [];
  lastRaw = [f.lat, f.lng, tNow, f.accuracy];

  // First good fix after the screen was locked (web): did you move while it was off?
  let gapMoved = false;
  if (s.gapFrom != null) {
    const lastP = s.points[s.points.length - 1];
    const moved = !!lastP && hav(lastP, [f.lat, f.lng]) > Math.max(20, 2 * f.accuracy);
    if (moved) { gapMoved = true; kf?.reset(); next.lastMoveAt = Date.now(); }
    // Stood still: the locked time doesn't count as moving time
    else if (!s.paused) { next.since = s.since + Math.max(0, Date.now() - s.gapFrom); Object.assign(s, { since: next.since }); }
    next.gapFrom = null;
  }

  if (!kf) kf = new KalmanLatLng(KALMAN_Q[s.type]);
  if (s.brk) kf.reset();   // after a manual pause you may be somewhere else: don't smooth across the gap
  // Follow your real pace (≈1.4 × speed matched the tuned walk/run values), e.g. jogging with Walk selected
  kf.setSpeed(Math.min(6, Math.max(KALMAN_Q[s.type], 1.4 * recentSpeed(s))));
  const o = kf.process(f.lat, f.lng, f.accuracy, tNow);
  const t = Math.round(elapsed(s));
  const p: RoutePoint = [+o.lat.toFixed(6), +o.lng.toFixed(6), t];
  next.tail = [p[0], p[1]];
  let distance = s.distance;
  if (last && !brk) {
    const d = hav(last, p);
    if (!gapMoved && d < Math.max(MIN_MOVE, o.sigma * SIGMA_K)) { maybeAutoPause(); update(next); return; } // within GPS uncertainty
    distance += d;
    if (gapMoved) next.gapDistance = (s.gapDistance || 0) + d;   // straight line across the locked stretch
  }
  const point: RoutePoint = brk && last ? [p[0], p[1], p[2], 1] : p;

  // Elevation gain: smoothed, 3 m hysteresis to ignore GPS altitude noise
  let { elevGain, altRef, altEma } = s;
  if (f.altitude != null && (f.altitudeAccuracy == null || f.altitudeAccuracy <= 15)) {
    altEma = altEma == null ? f.altitude : altEma + 0.3 * (f.altitude - altEma);
    if (altRef == null) { altRef = altEma; elevGain = elevGain ?? 0; }
    else if (altEma - altRef >= 3) { elevGain = (elevGain ?? 0) + (altEma - altRef); altRef = altEma; }
    else if (altEma < altRef - 3) altRef = altEma;
  }
  const points = [...s.points, point];
  next.tail = null;
  update({ ...next, points, distance, brk: false, lastMoveAt: Date.now(), elevGain, altRef, altEma, lastSplit: announceSplit(s, distance, points, t, settings.units, settings.voice) });
  persist(false);
}
/** Average speed over the last ~20 s of recorded route (m/s) */
function recentSpeed(s: Session) {
  const pts = s.points; if (pts.length < 2) return 0;
  const end = pts[pts.length - 1]; let d = 0, i = pts.length - 1;
  while (i > 0 && end[2] - pts[i - 1][2] <= 20 && !pts[i][3]) { d += hav(pts[i - 1], pts[i]); i--; }
  const t = end[2] - pts[i][2];
  return t >= 5 ? d / t : 0;
}
/** Add the last few metres still inside GPS uncertainty to the route (on pause and finish) */
function flushTail(atMs = Date.now()) {
  const s = rec.get().session;
  if (!s || s.indoor || !s.tail || !s.points.length) return;
  const last = s.points[s.points.length - 1], tl = hav(last, s.tail);
  const t = Math.max(last[2], Math.round(elapsed(s, atMs)));
  if (tl > 0.5 && tl < 50) update({ distance: s.distance + tl, points: [...s.points, [s.tail[0], s.tail[1], t]], tail: null });
  else update({ tail: null });
}
function announceSplit(s: Session, distance: number, points: RoutePoint[], t: number, units: 'km' | 'mi', voice: boolean) {
  // planned distance reached: say so once
  if (s.plan && !s.plan.goalHit && distance >= s.plan.target) {
    s.plan.goalHit = true;
    rec.set({ goalAt: Date.now() });
    void buzz();
    if (voice) speak(`Goal reached. ${(s.plan.target / unitM(units)).toFixed(s.plan.target % unitM(units) ? 1 : 0)} ${unitWord(units, 2)} done. Great work.`);
  }
  const n = Math.floor(distance / unitM(units));
  if (n <= s.lastSplit) return s.lastSplit;
  void buzz();
  // time for this split; from the route when possible, otherwise from the clock (indoor)
  const sp = points.length > 1 ? splitsOf(points, unitM(units)).filter(x => !x.partial) : [];
  const fromRoute = sp.length >= n ? sp[n - 1].sec : null;
  const splitSec = Math.max(0, fromRoute ?? (t - (s.lastSplitT ?? 0)) / Math.max(1, n - s.lastSplit));
  s.lastSplitT = t;
  rec.set({ split: { n, sec: splitSec, unit: units, at: Date.now() } });
  if (voice) {
    const say = (sec: number) => `${Math.floor(sec / 60)} minutes ${Math.round(sec % 60)} seconds`;
    speak(`${n} ${unitWord(units, n)}. Time ${say(t)}. Last ${unitWord(units, 1)} ${say(splitSec)}.`);
  }
  return n;
}

/** Auto-pause after 15 s without real movement. Called on every GPS fix and every second. */
function maybeAutoPause() {
  const s = rec.get().session;
  if (!s || s.indoor || s.paused || !data.get().settings.autoPause || (s.geo !== 'ok' && s.geo !== 'fair') || !s.points.length) return;
  // Screen was locked (web): wait for a fresh GPS fix before deciding you stopped
  if (s.gapFrom != null || (!isNative && typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
  if (Date.now() - s.lastMoveAt > 15000) {
    flushTail(s.lastMoveAt);   // by now the smoothed position has settled where you actually stopped
    const cur = rec.get().session!;
    // remove the idle seconds already spent standing still
    update({ acc: cur.acc + Math.max(0, cur.lastMoveAt - cur.since), paused: true, auto: true });
  }
}
function tick() {
  rec.set({ now: Date.now() });
  const s = rec.get().session;
  if (!s) return;
  if (s.indoor) {
    // Indoors: distance comes from counted steps × your step length
    const d = stepDistance(s) ?? 0;
    if (Math.abs(d - s.distance) > 0.5) {
      const settings = data.get().settings;
      update({ distance: d, lastSplit: announceSplit(s, d, [], Math.round(elapsed(s)), settings.units, settings.voice) });
    }
  }
  if (s.motion === 'pending' && Date.now() - s.startedAt > 6000 && s.motionEvents === 0) update({ motion: 'none' });
  maybeAutoPause();
  persist(false);
}

/* ---------------- lifecycle ---------------- */
/** Permission answer collected during the Start tap (iPhone browsers only allow the prompt inside a tap) */
let motionPerm: 'granted' | 'denied' | null = null;
type DMEType = { requestPermission?: () => Promise<string> } | undefined;
/** Call synchronously inside the Start tap, before any countdown */
export function prepareStart(): Promise<void> {
  if (data.get().settings.voice) unlockSpeech();
  const DME = (window as unknown as { DeviceMotionEvent?: DMEType }).DeviceMotionEvent;
  if (!DME?.requestPermission || motionPerm) return Promise.resolve();
  return DME.requestPermission().then(r => { motionPerm = r === 'granted' ? 'granted' : 'denied'; }).catch(() => { motionPerm = 'denied'; });
}
async function attach(s: Session) {
  const attachMotion = () => window.addEventListener('devicemotion', onMotion);
  const DME = (window as unknown as { DeviceMotionEvent?: DMEType }).DeviceMotionEvent;
  // iPhone asks for Motion permission; use the answer from the Start tap if we have one
  if (DME?.requestPermission) {
    if (motionPerm === 'granted') attachMotion();
    else if (motionPerm === 'denied') update({ motion: 'denied' });
    else DME.requestPermission().then(r => { if (r === 'granted') attachMotion(); else update({ motion: 'denied' }); }).catch(() => update({ motion: 'denied' }));
  }
  else if (DME) attachMotion();
  else update({ motion: 'none' });
  detector.reset();
  kf = new KalmanLatLng(KALMAN_Q[s.type]);
  if (data.get().settings.voice) unlockSpeech();
  if (!s.indoor) {
    tracker = createTracker();
    await tracker.start(onFix, e => update({ geo: e === 'denied' ? 'blocked' : 'waiting' })).catch(() => update({ geo: 'blocked' }));
  }
  pedometer = createPedometer();
  hwLast = -1;
  // 'pending' until the first reading arrives; until then steps come from the next-best source
  if (pedometer) pedometer.start(onHwSteps).then(r => { if (r !== 'on') update({ hw: r }); });
  else update({ hw: 'none' });
  if (!isNative) await requestWakeLock();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
}
// Web: browsers freeze GPS and sensors when the screen locks or you switch apps.
// Remember when that happened so the gap can be handled on return; also re-take the wake lock.
let hiddenAt: number | null = null;
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  const s = rec.get().session;
  if (!s || isNative || !timer) return;
  if (document.visibilityState === 'hidden') { if (!s.paused && !s.indoor) hiddenAt = Date.now(); persist(true); return; }
  void requestWakeLock();
  // Short switches (under 10 s) don't need special handling
  if (hiddenAt && !s.paused && Date.now() - hiddenAt > 10000) update({ gapFrom: hiddenAt, lastMoveAt: Date.now() });
  hiddenAt = null;
});
async function requestWakeLock() {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (wl) wakeLock = await wl.request('screen');
  } catch { /* not allowed */ }
}
async function detach() {
  window.removeEventListener('devicemotion', onMotion);
  await tracker?.stop().catch(() => {});
  tracker = null;
  await pedometer?.stop().catch(() => {});
  pedometer = null;
  clearInterval(timer); timer = undefined;
  await wakeLock?.release().catch(() => {});
  wakeLock = null;
  kf = null;
}

export async function start(type: ActivityType, indoor = false, plan?: { coords: [number, number][]; target: number }) {
  const now = Date.now();
  jumpRejects = []; lastRaw = null;
  const s = normalise({ type, indoor, startedAt: now, acc: 0, since: now, paused: false, auto: false, points: [], distance: 0,
    geo: indoor ? 'off' : 'waiting', brk: false, lastMoveAt: now, lastSplit: 0, elevGain: null, altRef: null, altEma: null, ...(plan ? { plan: { ...plan } } : {}) });
  rec.set({ session: s, split: null, goalAt: 0 });
  await attach(s);
  if (liveWanted()) void startLive(liveStats(rec.get().session ?? s));
  persist();
}
export function pause() {
  if (!rec.get().session || rec.get().session!.paused) return;
  flushTail();
  const s = rec.get().session!;
  update({ acc: s.acc + (Date.now() - s.since), paused: true, auto: false });
  persist();
}
export async function resume() {
  const s = rec.get().session; if (!s) return;
  if (!timer) await attach(s);
  if (rec.get().session?.paused) update({ paused: false, auto: false, since: Date.now(), brk: true, lastMoveAt: Date.now() });
  detector.reset();
  persist();
}
/** Continue an activity recovered after the app closed */
export async function resumePending() {
  const p = rec.get().pending; if (!p) return;
  rec.set({ session: normalise({ ...p, paused: true, brk: true, hw: 'pending', motion: 'pending' }), pending: null });
  await resume();
  const s = rec.get().session; if (s && liveWanted()) void startLive(liveStats(s));
}
export function adoptPendingForSave() {
  const p = rec.get().pending; if (!p) return;
  rec.set({ session: normalise({ ...p, paused: true, brk: true }), pending: null });
}
export function discardPending() { clearPersisted(); rec.set({ pending: null }); }

/** Pace over the last ~30 s of movement */
export function currentPace(s: Session): number | null {
  const pts = s.points, now = elapsed(s);
  if (pts.length < 2 || s.paused || now - pts[pts.length - 1][2] > 15) return null;
  let d = 0, i = pts.length - 1;
  while (i > 0 && now - pts[i - 1][2] <= 30 && !pts[i][3]) { d += hav(pts[i - 1], pts[i]); i--; }
  const t = now - pts[i][2];
  return t >= 8 && d > 10 ? paceSec(t, d, data.get().settings.units) : null;
}

/**
 * Learn your real step length from recordings where both GPS and step counting were trustworthy.
 * Averages up to the last 5 qualifying recordings per activity type; never overrides a value you set by hand.
 */
async function calibrate(s: Session, steps: number, src: StepsSource) {
  if (s.indoor || (src !== 'pedometer' && src !== 'sensor') || steps < 300) return;
  if (s.distance < 400 || s.fixUsed < 60 || s.fixGood / s.fixUsed < 0.6 || gpsQuality(s) < 0.8) return;
  const len = s.distance / steps;
  const st = data.get().settings;
  const run = s.type === 'run';
  const n = run ? st.strideRunN : st.strideWalkN;
  if (n < 0) return;                                        // set by hand
  const expected = strideM(s.type, st);
  if (len < expected * 0.6 || len > expected * 1.6 || len < 0.3 || len > 2.2) return;
  const cur = (run ? st.strideRun : st.strideWalk) || len;
  const w = Math.min(n, 4);
  const next = +((cur * w + len) / (w + 1)).toFixed(3);
  await saveSettings(run ? { strideRun: next, strideRunN: n + 1 } : { strideWalk: next, strideWalkN: n + 1 });
}

export interface FinishOptions { distance?: number; steps?: number; useStepDistance?: boolean; note: string }
export async function finishAndSave(opts: FinishOptions): Promise<Activity | null> {
  if (!rec.get().session) return null;
  flushTail();   // count the last few metres that were still inside GPS uncertainty
  const fs = rec.get().session!;
  const banked = fs.paused ? fs.acc : fs.acc + (Date.now() - fs.since);
  const s = fs, points = fs.points, gpsDist = fs.distance;
  const info = stepInfo(fs), settings = data.get().settings;
  let distance = gpsDist, steps = info.steps, src: StepsSource = info.src, edited = false;
  if (opts.useStepDistance) { const sd = stepDistance(fs); if (sd != null) { distance = sd; edited = true; } }
  if (opts.distance != null) { distance = opts.distance; edited = true; }
  if (opts.steps != null) { steps = opts.steps; src = 'manual'; }
  else if (opts.distance != null && src === 'estimate') steps = Math.round(distance / strideM(s.type, settings));
  const a: Activity = {
    id: newId(), type: s.type, start: s.startedAt, duration: Math.round(banked / 1000), distance: Math.round(distance), steps, stepsSource: src,
    route: thinRoute(points), elevGain: s.elevGain == null ? null : Math.round(s.elevGain), note: opts.note.trim().slice(0, 140),
    distanceEdited: edited && points.length > 1 ? true : undefined, indoor: s.indoor || undefined, updatedAt: Date.now()
  };
  if (!opts.useStepDistance && opts.distance == null && opts.steps == null) await calibrate(fs, steps, src);
  await detach();
  clearPersisted();
  rec.set({ session: null });
  // Leave the final result on the lock screen briefly (iPhone); Android notification is removed
  const u = settings.units;
  void endLive({ activity: a.type === 'run' ? 'Run' : 'Walk', distance: fmtDist(a.distance, u), unit: unitL(u), steps: fmtInt(a.steps),
    pace: fmtPace(a.duration, a.distance, u), time: fmtTime(a.duration), movingSeconds: a.duration, paused: true }, true);
  return saveActivity(a);
}
export async function discard() {
  await detach();
  clearPersisted();
  rec.set({ session: null });
  void endLive();
}
export const persistRecording = () => persist(true);
