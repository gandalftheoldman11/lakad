import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ui } from '../lib/ui';
import { useStore } from '../lib/store';

type Variant = 'primary' | 'mango' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-cobalt text-on-cobalt shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_10px_24px_-12px_var(--cobalt)]',
  mango: 'bg-mango text-[#2A1B00] shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_10px_24px_-14px_var(--mango)]',
  ghost: 'border border-line text-ink bg-surface',
  danger: 'border border-danger/40 text-danger bg-transparent'
};
export function Button({ variant = 'ghost', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 min-h-[52px] font-bold tracking-[-0.01em] transition-transform active:scale-[.98] ${variants[variant]} ${className}`} />;
}
export function LinkButton({ className = '', danger, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return <button {...p} className={`font-bold py-1.5 ${danger ? 'text-danger' : 'text-cobalt'} ${className}`} />;
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Browsers focus (and scroll to) the first button; start at the top instead
      d.focus({ preventScroll: true });
      d.scrollTop = 0;
    }
    if (!open && d.open) d.close();
  }, [open]);
  // Moving from one sheet to another (e.g. activity → share) starts the new one at the top
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [label]);
  return (
    <dialog ref={ref} className="sheet" aria-label={label} tabIndex={-1} onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      {open && <div className="px-[22px] pt-4 pb-[22px]">{children}</div>}
    </dialog>
  );
}
export function SheetTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return <><h3 className="m-0 text-[24px] leading-tight font-extrabold tracking-[-0.02em] [font-stretch:115%]">{children}</h3>{sub && <p className="m-0 mt-1.5 text-[15px] text-muted">{sub}</p>}</>;
}
export function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <div className="field mt-3.5 flex flex-col gap-1.5"><label htmlFor={id} className="text-sm font-semibold">{label}</label>{children}</div>;
}
export function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-wrap gap-2.5 [&>*]:flex-1">{children}</div>;
}
export function ErrorText({ children }: { children?: ReactNode }) {
  return <p className="m-0 mt-2.5 min-h-5 text-sm text-danger" role="alert">{children}</p>;
}
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`lift rounded-[22px] p-4 ${className}`}>{children}</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-[22px] border border-dashed border-line px-[18px] py-8 text-center text-muted">{children}</div>;
}
export function Pill({ tone, live, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; live?: boolean; children: ReactNode }) {
  const c = { ok: 'bg-ok', warn: 'bg-mango', bad: 'bg-danger', muted: 'bg-muted' }[tone];
  return <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium shadow-[var(--lift)]"><span className={`h-2 w-2 rounded-full ${c} ${live ? 'dot-live' : ''}`} />{children}</span>;
}
export function Toast() {
  const { toast, toastKey } = useStore(ui);
  return (
    <div role="status" aria-live="polite" key={toastKey}
      className={`pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-[18px] py-2.5 text-sm font-semibold text-bg transition-opacity ${toast ? 'opacity-100' : 'opacity-0'}`}
      style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}>
      {toast}
    </div>
  );
}
export function GoalBar({ value, max, color, label, height = 14 }: { value: number; max: number; color: string; label: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}
      className="overflow-hidden rounded-full bg-bar-soft" style={{ height }}>
      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="m-0 text-[17px] font-bold tracking-[-0.01em]">{children}</h2>{aside}</div>;
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, ReactNode][]; label: string }) {
  return (
    <div className="inline-flex rounded-full bg-surface-2 p-1 ring-1 ring-line" role="group" aria-label={label}>
      {options.map(([k, l]) => (
        <button key={k} aria-pressed={value === k} onClick={() => onChange(k)}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors ${value === k ? 'bg-surface text-ink shadow-[var(--lift)]' : 'text-muted'}`}>{l}</button>
      ))}
    </div>
  );
}

/**
 * The goal path: Lakad's route line, filling from start toward your goal,
 * with the mango "you are here" dot at today's progress.
 */
export function GoalPath({ value, max, label, celebrate }: { value: number; max: number; label: string; celebrate?: boolean }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const ref = useRef<SVGPathElement>(null);
  const [shown, setShown] = useState(0);              // animates once on first show
  const [dot, setDot] = useState<[number, number]>([8, 62]);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(pct)); return () => cancelAnimationFrame(t); }, [pct]);
  useLayoutEffect(() => {
    const p = ref.current; if (!p) return;
    const L = p.getTotalLength(), pt = p.getPointAtLength(L * pct);
    setDot([pt.x, pt.y]);
  }, [pct]);
  const d = 'M8 62 C 70 62, 92 18, 150 18 S 232 66, 290 50 S 332 26, 352 22';
  const done = pct >= 1;
  return (
    <svg viewBox="0 0 360 80" className="block h-auto w-full overflow-visible" role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <path d={d} fill="none" stroke="var(--bar-soft)" strokeWidth="7" strokeLinecap="round" strokeDasharray="0.1 2.2" pathLength={100} />
      <path ref={ref} d={d} fill="none" stroke="var(--cobalt)" strokeWidth="7" strokeLinecap="round" pathLength={100}
        className="goal-fill" strokeDasharray={`${shown * 100} 100`} />
      <circle cx="8" cy="62" r="5" fill="var(--surface)" stroke="var(--cobalt)" strokeWidth="3" />
      {!done && <circle cx="352" cy="22" r="7" fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="2 3" />}
      <circle cx={dot[0]} cy={dot[1]} r={done ? 11 : 9} fill="var(--mango)" opacity={0.25} />
      {celebrate && <>
        <circle cx={dot[0]} cy={dot[1]} r={8} fill="none" stroke="var(--mango)" strokeWidth="2.5" className="goal-burst" />
        <circle cx={dot[0]} cy={dot[1]} r={8} fill="none" stroke="var(--mango)" strokeWidth="2" className="goal-burst second" />
      </>}
      <circle cx={dot[0]} cy={dot[1]} r={done ? 7 : 6} fill="var(--mango)" stroke="var(--surface)" strokeWidth="2.5" className={celebrate ? 'goal-pop' : undefined} />
    </svg>
  );
}
