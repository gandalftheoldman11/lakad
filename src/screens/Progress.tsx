import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { stepsBetween, stepsByDay, sumWhere } from '../lib/metrics';
import { addDays, dateLabel, fmtDist, fmtDur, fmtInt, fmtPace, sod, unitL, unitM, weekStart } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { TopBar } from '../components/TopBar';
import { PaceTrend, WeeklyDistance } from '../components/charts';
import { Calendar } from '../components/Calendar';
import { ActivityList } from '../components/ActivityList';
import { Button, Empty, Panel } from '../components/ui';
import type { Activity } from '../types';

type Period = 'week' | 'month' | 'all';

function Seg<T extends string>({ value, set, opts, label }: { value: T; set: (v: T) => void; opts: [T, string][]; label: string }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-1" role="group" aria-label={label}>
      {opts.map(([k, l]) => <button key={k} aria-pressed={value === k} onClick={() => set(k)} className={`rounded-full px-4 py-2 font-semibold ${value === k ? 'bg-ink text-bg' : 'text-muted'}`}>{l}</button>)}
    </div>
  );
}
const Total = ({ v, l }: { v: string; l: string }) => <Panel className="min-w-0"><span className="num block text-[clamp(22px,6.6vw,40px)] [overflow-wrap:anywhere]">{v}</span><span className="text-sm text-muted">{l}</span></Panel>;
function PB({ label, val, sub, a }: { label: string; val: string; sub: string; a?: Activity | null }) {
  const inner = <><span className="text-sm text-muted">{label}</span><strong className="block text-[22px] font-extrabold tabular-nums [font-stretch:120%]">{val}</strong><span className="text-sm text-muted">{sub}</span></>;
  return a ? <button className="rounded-2xl border border-line bg-surface p-4 text-left" onClick={() => openDialog({ kind: 'detail', id: a.id })}>{inner}</button> : <Panel>{inner}</Panel>;
}

export function Progress({ go }: { go: (t: 'record') => void }) {
  const { acts, days, settings } = useStore(data);
  const [period, setPeriod] = useState<Period>('week');
  const [filter, setFilter] = useState<'all' | 'walk' | 'run'>('all');
  const map = useMemo(() => stepsByDay(acts, days), [acts, days]);
  const now = Date.now(), u = settings.units;
  const since = period === 'week' ? weekStart(now) : period === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() : 0;
  const t = sumWhere(acts, settings, a => a.start >= since);
  const steps = stepsBetween(map, since, addDays(sod(now), 1));
  const runs = acts.filter(a => a.type === 'run'), walks = acts.filter(a => a.type === 'walk');
  const longest = (arr: Activity[]) => arr.reduce<Activity | null>((b, a) => (!b || a.distance > b.distance ? a : b), null);
  const fastest = runs.filter(a => a.distance >= unitM(u)).reduce<Activity | null>((b, a) => (!b || a.duration / a.distance < b.duration / b.distance ? a : b), null);
  let bestDay = 0, bestDayT = 0;
  for (const [k, v] of map) if (v > bestDay) { bestDay = v; bestDayT = k; }
  const lw = longest(walks), lr = longest(runs);
  const paceSet = runs.length >= 2 ? runs : walks;
  const listed = filter === 'all' ? acts : acts.filter(a => a.type === filter);


  return (
    <>
      <TopBar />
      <h2 className="num big m-0">Progress</h2>
      <div className="my-4"><Seg value={period} set={setPeriod} label="Period" opts={[['week', 'This week'], ['month', 'This month'], ['all', 'All time']]} /></div>
      <div className="grid grid-cols-2 gap-3">
        <Total v={fmtDist(t.dist, u)} l={unitL(u)} />
        <Total v={fmtInt(steps)} l="steps" />
        <Total v={fmtDur(t.dur)} l="moving time" />
        <Total v={String(t.count)} l={t.count === 1 ? 'activity' : 'activities'} />
        <Total v={settings.weight ? fmtInt(t.kcal) : '–'} l={settings.weight ? 'kcal' : 'kcal (add weight in settings)'} />
        <Total v={fmtInt(t.elev)} l="m climbed" />
      </div>

      <section className="mt-7"><h2 className="m-0 mb-3 text-lg font-bold">Step goal calendar</h2><Panel><Calendar map={map} goal={settings.goal} /></Panel></section>
      <section className="mt-7"><h2 className="m-0 mb-3 text-lg font-bold">Distance per week</h2><Panel><WeeklyDistance acts={acts} units={u} weekGoal={settings.weekGoal} /></Panel></section>
      {paceSet.filter(a => a.distance >= 500).length >= 2 && (
        <section className="mt-7"><h2 className="m-0 mb-3 text-lg font-bold">{paceSet === runs ? 'Run' : 'Walk'} pace, recent</h2><Panel><PaceTrend acts={paceSet} units={u} /><p className="m-0 mt-1 text-xs text-muted">Higher on the chart is faster.</p></Panel></section>
      )}

      <section className="mt-7">
        <h2 className="m-0 mb-3 text-lg font-bold">Personal bests</h2>
        {acts.length || bestDay ? (
          <div className="grid grid-cols-2 gap-3">
            <PB label="Longest walk" val={lw ? `${fmtDist(lw.distance, u)} ${unitL(u)}` : '–'} sub={lw ? dateLabel(lw.start) : 'No walks yet'} a={lw} />
            <PB label="Longest run" val={lr ? `${fmtDist(lr.distance, u)} ${unitL(u)}` : '–'} sub={lr ? dateLabel(lr.start) : 'No runs yet'} a={lr} />
            <PB label="Fastest run pace" val={fastest ? `${fmtPace(fastest.duration, fastest.distance, u)} /${unitL(u)}` : '–'} sub={fastest ? dateLabel(fastest.start) : `Runs of 1 ${unitL(u)} or more`} a={fastest} />
            <PB label="Most steps in a day" val={bestDay ? fmtInt(bestDay) : '–'} sub={bestDay ? dateLabel(bestDayT) : 'No steps yet'} />
          </div>
        ) : (
          <Empty><p className="m-0 mb-3.5">Your bests show up after your first activity.</p><Button variant="primary" onClick={() => go('record')}>Start recording</Button></Empty>
        )}
      </section>

      {acts.length > 0 && (
        <section className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 text-lg font-bold">All activities</h2>
            <Seg value={filter} set={setFilter} label="Filter activities" opts={[['all', 'All'], ['walk', 'Walks'], ['run', 'Runs']]} /></div>
          {listed.length ? <ActivityList items={listed} /> : <Empty><p className="m-0">No {filter === 'run' ? 'runs' : 'walks'} yet.</p></Empty>}
        </section>
      )}
    </>
  );
}
