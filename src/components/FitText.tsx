import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Big numbers that always fit on one line: shrinks the font just enough when the
 * number gets long (e.g. 15,000 steps). Never larger than its normal size.
 * Sized from the final value, so the count-up animation doesn't make it jump.
 */
export function FitText({ text, min = 36, className = '', children }: {
  text: string; min?: number; className?: string; children: ReactNode;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = box.current, p = probe.current, parent = el?.parentElement;
    if (!el || !p || !parent) return;
    const fit = () => {
      // room left in the row after anything beside the number (like "km")
      const cs = getComputedStyle(parent);
      let avail = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const gap = parseFloat(cs.columnGap) || 0;
      for (const sib of Array.from(parent.children)) if (sib !== el) avail -= (sib as HTMLElement).getBoundingClientRect().width + gap;
      const at100 = p.getBoundingClientRect().width;          // width of the text at 100px
      if (!at100) return;
      // the size the layout normally gives it (from its classes); only ever shrink below that
      const prev = el.style.fontSize; el.style.fontSize = '';
      const natural = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = prev;
      const fitted = Math.floor((avail / at100) * 100 * 0.97);
      setSize(fitted < natural ? Math.max(min, fitted) : null);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(parent); ro.observe(p);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [text, min]);
  return (
    <span ref={box} className={`relative inline-block whitespace-nowrap ${className}`} style={size ? { fontSize: size } : undefined}>
      {children}
      {/* hidden measuring copy, clipped to zero size so it can never widen the page */}
      <span aria-hidden="true" className="fit-probe pointer-events-none invisible absolute top-0 left-0 h-0 w-0 overflow-hidden">
        <span ref={probe} className="whitespace-nowrap" style={{ fontSize: 100 }}>{text}</span>
      </span>
    </span>
  );
}
