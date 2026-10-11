import { StepDetector } from '../src/lib/stepDetector.ts';
let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const G = 9.81, HZ = 60;
// Gait signal: one main impact per step + harmonic, cadence drift, amplitude variation, sensor noise
function gait(seconds, cadenceHz, amp, noise) {
  const out = []; let phase = 0, steps = 0, f = cadenceHz, a = amp;
  for (let i = 0; i < seconds * HZ; i++) {
    f += (cadenceHz - f) * 0.02 + gauss() * 0.02;
    if (Math.floor(phase + f / HZ) > Math.floor(phase)) a = amp * (0.55 + 0.9 * rnd()) * (rnd() < 0.04 ? 0.35 : 1);
    const before = Math.floor(phase); phase += f / HZ; if (Math.floor(phase) > before) steps++;
    const x = 2 * Math.PI * phase;
    out.push(G + a * Math.sin(x) + 0.35 * a * Math.sin(2 * x + 0.7) + gauss() * noise * 1.6);
  }
  return { sig: out, steps };
}
const still = (seconds, noise) => ({ sig: Array.from({ length: seconds * HZ }, () => G + gauss() * noise), steps: 0 });
function shake(seconds) { const out = []; let v = 0; for (let i = 0; i < seconds * HZ; i++) { v = 0.85 * v + gauss() * 1.6; out.push(G + v); } return { sig: out, steps: 0 }; }
function taps(seconds) { const out = []; for (let i = 0; i < seconds * HZ; i++) out.push(G + gauss() * 0.15 + (rnd() < 0.02 ? 4 * rnd() : 0)); return { sig: out, steps: 0 }; }
class OldDetector { constructor(){this.steps=0;this.init=false;} push(t,mag){ if(!this.init){this.ema=mag;this.base=mag;this.above=false;this.last=0;this.init=true;return;} this.ema+=0.25*(mag-this.ema); this.base+=0.02*(mag-this.base); const diff=this.ema-this.base, thr=this.thr; if(!this.above&&diff>thr&&t-this.last>this.gap){this.steps++;this.last=t;this.above=true;} else if(this.above&&diff<thr*0.3)this.above=false; } }
function runOld(parts, isRun) { const d = new OldDetector(); d.thr = isRun ? 1.6 : 1.0; d.gap = isRun ? 220 : 300; let t = 0, truth = 0; for (const p of parts) { truth += p.steps; for (const m of p.sig) { d.push(t, m); t += 1000 / HZ; } } return { got: d.steps, truth }; }
function run(parts, minAmp, needed, ratio) {
  const d = new StepDetector(minAmp, needed, ratio); let t = 0, truth = 0;
  for (const p of parts) { truth += p.steps; for (const m of p.sig) { d.push(t, m); t += 1000 / HZ; } }
  return { got: d.steps, truth };
}
const cases = {
  'walk, pocket (100 spm)': () => [gait(120, 1.67, 2.2, 0.25)],
  'walk, hand (110 spm, weak)': () => [gait(120, 1.83, 1.2, 0.3)],
  'slow walk (80 spm)': () => [gait(120, 1.33, 1.5, 0.25)],
  'brisk walk (125 spm)': () => [gait(120, 2.08, 2.8, 0.3)],
  'run (165 spm)': () => [gait(120, 2.75, 6, 0.5)],
  'fast run (185 spm)': () => [gait(120, 3.08, 8, 0.6)],
  'walk with stops': () => [gait(40, 1.7, 2, 0.25), still(15, 0.12), gait(40, 1.7, 2, 0.25), still(10, 0.12), gait(30, 1.7, 2, 0.25)],
  'standing still 2 min': () => [still(120, 0.15)],
  'random shaking 30 s': () => [shake(30)],
  'phone taps/handling 60 s': () => [taps(60)],
};
const names = Object.keys(cases);
console.log('needed ratio | ' + names.map(n => n.split(' ')[0] + (n.includes('hand') ? 'H' : n.includes('slow') ? 'S' : n.includes('brisk') ? 'B' : n.includes('fast') ? 'F' : n.includes('stops') ? 'P' : n.includes('shak') ? 'K' : n.includes('taps') ? 'T' : '')).join(' '));
for (const needed of [4, 6, 8]) for (const ratio of [1.6, 1.4, 1.3]) {
  const cells = names.map(name => { let g = 0, tr = 0; for (let k = 1; k <= 5; k++) { seed = k * 101 + name.length; const r = run(cases[name](), 0.9, needed, ratio); g += r.got; tr += r.truth; }
    return tr ? ((g - tr) / tr * 100).toFixed(1) + '%' : (g / 5).toFixed(0) + 'f'; });
  console.log(`${needed}      ${ratio}   | ` + cells.join('  '));
}
