import { useEffect, useRef, useState } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const counted = new Set<string>();   // count-up plays once per app session for each key

/**
 * Smoothly animates a number toward its target. If the target changes mid-animation,
 * it continues from wherever it currently is, so rapid updates (live GPS) stay fluid.
 */
export function useTween(target: number, duration = 650, countUpKey?: string) {
  const startFromZero = !!countUpKey && !counted.has(countUpKey) && !reducedMotion();
  const cur = useRef(startFromZero ? 0 : target);
  const [v, setV] = useState(cur.current);
  const raf = useRef(0);
  useEffect(() => {
    if (countUpKey) counted.add(countUpKey);
    if (reducedMotion() || !Number.isFinite(target)) { cur.current = target; setV(target); return; }
    const from = cur.current, delta = target - from;
    if (Math.abs(delta) < 1e-9) return;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      cur.current = from + delta * easeOut(p);
      setV(cur.current);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, countUpKey]);
  return v;
}

/** Shows an animated number; screen readers get the final value only */
export function AnimatedNumber({ value, format, duration, countUpKey, id }: { value: number; format: (n: number) => string; duration?: number; countUpKey?: string; id?: string }) {
  const v = useTween(value, duration, countUpKey);
  return <><span aria-hidden="true" id={id}>{format(v)}</span><span className="sr-only">{format(value)}</span></>;
}
