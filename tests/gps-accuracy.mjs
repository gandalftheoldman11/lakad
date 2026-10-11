import { KalmanLatLng, havM } from '../src/lib/gpsFilter.ts';
// deterministic RNG
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const M = 1 / 111320, LAT0 = 6.3, KX = Math.cos(LAT0 * Math.PI / 180);

// True path: city walk with turns, speed variation and stops
function truePath(speed, minutes, stops) {
  const pts = []; let x = 0, y = 0, hd = 0, t = 0, dist = 0;
  for (let s = 0; s < minutes * 60; s++) {
    const stopped = stops && (s % 300) > 270;            // 30 s stop every 5 min
    if (s % 75 === 0) hd += (rnd() < .5 ? 1 : -1) * Math.PI / 2 * (0.5 + rnd() * 0.5);
    const v = stopped ? 0 : speed * (0.85 + 0.3 * rnd());
    x += Math.cos(hd) * v; y += Math.sin(hd) * v; dist += v; t++;
    pts.push([x, y]);
  }
  return { pts, dist };
}
// GPS error: correlated (Gauss-Markov, tau 10 s) plus white noise; reported accuracy ≈ 68% radius
let MODEL = { div: 1.4, tau: 10, white: 0.3 };
function noisy(pts, acc) {
  const sig = acc / MODEL.div, rho = Math.exp(-1 / MODEL.tau); let ex = 0, ey = 0;
  return pts.map(([x, y], i) => {
    ex = rho * ex + Math.sqrt(1 - rho * rho) * sig * 0.9 * gauss();
    ey = rho * ey + Math.sqrt(1 - rho * rho) * sig * 0.9 * gauss();
    const nx = x + ex + gauss() * sig * MODEL.white, ny = y + ey + gauss() * sig * MODEL.white;
    const repAcc = acc * (0.8 + 0.4 * rnd());
    return { lat: LAT0 + ny * M, lng: 125 + nx * M / KX, acc: repAcc, t: i * 1000 };
  });
}
// A: current algorithm
function algoA(fixes, maxSpeed) {
  let last = null, d = 0;
  for (const f of fixes) {
    if (f.acc > 50) continue;
    const p = [f.lat, f.lng, f.t / 1000];
    if (!last) { last = p; continue; }
    const dd = havM(last, p), dt = Math.max(1, p[2] - last[2]);
    if (dd < Math.max(4, f.acc * 0.5)) continue;
    if (dd / dt > maxSpeed) continue;
    d += dd; last = p;
  }
  return d;
}
// B: Kalman + sigma-based threshold
function algoB(fixes, maxSpeed, q, k, floor) {
  const kf = new KalmanLatLng(q); let last = null, d = 0;
  for (const f of fixes) {
    if (f.acc > 50) continue;
    const o = kf.process(f.lat, f.lng, f.acc, f.t);
    const p = [o.lat, o.lng, f.t / 1000];
    if (!last) { last = p; continue; }
    const dd = havM(last, p), dt = Math.max(1, p[2] - last[2]);
    if (dd < Math.max(floor, o.sigma * k)) continue;
    if (dd / dt > maxSpeed) continue;
    d += dd; last = p;
  }
  return d;
}

const scen = [['walk', 1.35, 7, true], ['run', 3.0, 12, false]];
const accs = [5, 10, 20, 35, 50];
const models = { realistic: { div: 2, tau: 30, white: 0.1 }, harsh: { div: 1.4, tau: 10, white: 0.3 } };
for (const [name, speed, maxSp, stops] of scen) {
  const configs = { A: f => algoA(f, maxSp) };
  for (const q of [0.75, 1, 1.5, 2, 2.5, 3, 4]) for (const k of [0.5, 1, 1.5, 2]) configs[`K q${q} k${k}`] = f => algoB(f, maxSp, q, k, 2);
  const res = {};
  for (const [mn, m] of Object.entries(models)) { MODEL = m;
    for (const acc of accs) for (let trial = 0; trial < 8; trial++) {
      seed = 7919 * trial + acc * 31 + (name === 'run' ? 77 : 0) + (mn === 'harsh' ? 5 : 0);
      const { pts, dist } = truePath(speed, 20, stops); const fx = noisy(pts, acc);
      for (const [c, fn] of Object.entries(configs)) ((res[c] ??= {})[`${mn[0]}@${acc}`] ??= []).push((fn(fx) - dist) / dist * 100);
    }
  }
  const rows = Object.entries(res).map(([c, r]) => {
    const cells = Object.entries(r).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]);
    // weight realistic model x2 and the common accuracies (5-20 m) x2
    let wsum = 0, tot = 0; for (const [k, v] of cells) { const w = (k[0] === 'r' ? 2 : 1) * (/@(5|10|20)$/.test(k) ? 2 : 1); wsum += w; tot += w * Math.abs(v); }
    return { c, cells, score: tot / wsum, worst: Math.max(...cells.map(x => Math.abs(x[1]))) };
  }).sort((a, b) => a.score - b.score);
  console.log(`\n== ${name.toUpperCase()}  (r=realistic noise, h=harsh noise; value = mean distance error)`);
  console.log('config'.padEnd(14), rows[0].cells.map(x => x[0].padStart(7)).join(''), '  score  worst');
  for (const r of rows.slice(0, 6).concat(rows.filter(r => r.c === 'A')))
    console.log(r.c.padEnd(14), r.cells.map(x => ((x[1] >= 0 ? '+' : '') + x[1].toFixed(1)).padStart(7)).join(''), r.score.toFixed(1).padStart(7), r.worst.toFixed(1).padStart(6));
}
