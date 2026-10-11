/**
 * Step detection from the phone's accelerometer (used when no hardware step counter is available,
 * e.g. iPhone Safari/PWA). No imports, so it can be tested on its own.
 *
 * 1. Total acceleration magnitude, band-passed (gravity removed, high-frequency jitter removed).
 * 2. Each peak-to-valley swing larger than an adaptive threshold is a candidate step.
 * 3. Candidates only count once 4 arrive with a steady rhythm (0.25–2 s apart), which rejects
 *    taps, phone handling and random shaking. A pause over 2 s needs a new steady rhythm.
 */
export class StepDetector {
  steps = 0;
  private init = false;
  private lp = 0;        // low-pass (removes jitter)
  private base = 0;      // very slow average (gravity)
  private prevV = 0;
  private prevT = 0;
  private rising = false;
  private valley = 0;
  private amps: number[] = [];
  private lastStepT = -1e9;
  private pending: number[] = [];
  private walking = false;
  private minAmp: number;
  private needed: number;
  private ratio: number;

  /** needed = steady steps before counting starts; ratio = max/min step interval allowed in that run */
  constructor(minAmp = 0.9, needed = 4, ratio = 1.6) { this.minAmp = minAmp; this.needed = needed; this.ratio = ratio; }

  reset() {
    this.init = false; this.rising = false; this.pending = []; this.walking = false; this.lastStepT = -1e9;
  }

  /** t in ms, mag = |accelerationIncludingGravity| in m/s². Returns steps added by this sample. */
  push(t: number, mag: number): number {
    if (!this.init) { this.lp = mag; this.base = mag; this.prevV = 0; this.prevT = t; this.valley = 0; this.init = true; return 0; }
    const dt = Math.min(0.2, Math.max(0.001, (t - this.prevT) / 1000));
    const aLp = dt / (0.04 + dt);   // ~4 Hz low-pass
    const aBase = dt / (1.5 + dt);  // ~0.1 Hz baseline
    this.lp += aLp * (mag - this.lp);
    this.base += aBase * (mag - this.base);
    const v = this.lp - this.base;
    let added = 0;

    if (this.rising && v < this.prevV) {
      // local maximum at previous sample: evaluate the swing from the last valley
      const amp = this.prevV - this.valley;
      const typical = this.amps.length >= 3 ? median(this.amps) : 0;
      const thr = Math.max(this.minAmp, typical * 0.45);
      if (amp >= thr) added = this.candidate(this.prevT, amp);
      this.rising = false;
    } else if (!this.rising && v > this.prevV) {
      this.valley = this.prevV;  // local minimum
      this.rising = true;
    }
    this.prevV = v; this.prevT = t;
    return added;
  }

  private candidate(t: number, amp: number): number {
    const gap = t - this.lastStepT;
    if (gap < 250) return 0;                 // faster than any human cadence: same step
    if (gap > 2000) { this.walking = false; this.pending = []; }
    this.lastStepT = t;
    this.amps.push(amp); if (this.amps.length > 12) this.amps.shift();
    if (this.walking) { this.steps++; return 1; }
    this.pending.push(t);
    if (this.pending.length >= this.needed) {
      const iv = this.pending.slice(1).map((x, i) => x - this.pending[i]);
      const steady = Math.max(...iv) / Math.min(...iv) < this.ratio;
      if (steady) { const n = this.pending.length; this.walking = true; this.pending = []; this.steps += n; return n; }
      this.pending.shift();
    }
    return 0;
  }
}

function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
