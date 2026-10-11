import { useState } from 'react';
import { fmtInt, sod } from '../lib/format';

export function Calendar({ map, goal }: { map: Map<number, number>; goal: number }) {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1).getTime());
  const first = new Date(month), y = first.getFullYear(), mo = first.getMonth();
  const daysIn = new Date(y, mo + 1, 0).getDate(), lead = (first.getDay() + 6) % 7, today = sod(Date.now());
  const isCurrent = y === now.getFullYear() && mo === now.getMonth();
  let met = 0;
  const cells = Array.from({ length: daysIn }, (_, i) => {
    const t = new Date(y, mo, i + 1).getTime(), v = map.get(t) || 0;
    if (v >= goal) met++;
    const cls = t > today ? 'opacity-35 bg-bg' : v >= goal ? 'bg-mango text-[#2A1B00]' : v > 0 ? 'bg-mango-soft' : 'bg-bg';
    return (
      <span key={t} title={`${fmtInt(v)} steps`} className={`grid aspect-square place-items-center rounded-[10px] text-[13px] font-semibold tabular-nums ${cls} ${t === today ? 'outline-2 -outline-offset-2 outline-cobalt' : ''}`}>
        {i + 1}<span className="sr-only"> {fmtInt(v)} steps</span>
      </span>
    );
  });
  const nav = (d: number) => setMonth(new Date(y, mo + d, 1).getTime());
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <button className="grid h-10 w-10 place-items-center rounded-full border border-line text-lg" onClick={() => nav(-1)} aria-label="Previous month">‹</button>
        <div className="text-center">
          <strong>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
          <div className="text-sm text-muted">Goal met {met} {met === 1 ? 'day' : 'days'}</div>
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-full border border-line text-lg" onClick={() => nav(1)} disabled={isCurrent} aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((h, i) => <span key={i} className="text-xs text-muted">{h}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {cells}
      </div>
    </>
  );
}
