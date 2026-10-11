import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ui } from '../lib/ui';
import { useStore } from '../lib/store';

type Variant = 'primary' | 'mango' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-cobalt text-on-cobalt',
  mango: 'bg-mango text-[#2A1B00]',
  ghost: 'border border-line text-ink bg-transparent',
  danger: 'border border-danger text-danger bg-transparent'
};
export function Button({ variant = 'ghost', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 min-h-12 font-bold ${variants[variant]} ${className}`} />;
}
export function LinkButton({ className = '', danger, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return <button {...p} className={`font-bold py-1.5 ${danger ? 'text-danger' : 'text-cobalt'} ${className}`} />;
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={label} onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      {open && <div className="p-[22px]">{children}</div>}
    </dialog>
  );
}
export function SheetTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return <><h3 className="m-0 text-[22px] font-extrabold [font-stretch:115%]">{children}</h3>{sub && <p className="m-0 mt-1 text-muted">{sub}</p>}</>;
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
  return <div className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line px-[18px] py-7 text-center text-muted">{children}</div>;
}
export function Pill({ tone, live, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; live?: boolean; children: ReactNode }) {
  const c = { ok: 'bg-ok', warn: 'bg-mango', bad: 'bg-danger', muted: 'bg-muted' }[tone];
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[13px]"><span className={`h-2 w-2 rounded-full ${c} ${live ? 'dot-live' : ''}`} />{children}</span>;
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
