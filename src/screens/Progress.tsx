import { useMemo, useState } from 'react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { stepsBetween, stepsByDay, sumWhere } from '../lib/metrics';
import { addDays, dateLabel, fmtDist, fmtDur, fmtInt, fmtPace, sod, unitL, unitM, weekStart } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { TopBar } from '../components/TopBar';
import { PaceTrend, WeeklyDistance } from '../components/charts';
import { Calendar } from '../components/Calendar';
import { ActivityList } from '../components/ActivityList';
import { Button, Empty, Panel, SectionTitle, Segmented } from '../components/ui';
import type { Activity } from '../types';

type Period = 'week' | 'month' | 'all';

const Stat = ({ v, l }: { v: React.ReactNode; l: string }) => <div className="min-w-0 py-3"><span className="num mid block truncate">{v}</span><span className="label">{l}</span></div>;
function PB({ label, val, sub, a }: { label: string; val: string; sub: string; a?: Activity | null }) {
  const inner = (
    <>
      <span className="min-w-0"><span className="block text-[15px] font-semibold">{label}</span><span className="block truncate text-[13px] text-muted">{sub}</span></span>
      <span className="num shrink-0 text-[20px]">{val}</span>
    </>
  );
  const cls = 'flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left';
  return a ? <button className={`${cls} active:bg-surface-2`} onClick={() => openDialog({ kind: 'detail', id: a.id })}>{inner}</button> : <div className={cls}>{inner}</div>;
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


  const periodLabel = period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'in total';
  return (
    <>
      <TopBar title="Progress" />
      <Segmented value={period} onChange={setPeriod} label="Period" options={[['week', 'This week'], ['month', 'This month'], ['all', 'All time']]} />

      <section className="mt-6" aria-label="Totals">
        <div className="flex items-baseline gap-2"><span className="num text-[clamp(60px,19vw,112px)]"><AnimatedNumber value={t.dist} format={n => fmtDist(n, u)} duration={800} /></span><span className="num text-[26px] text-muted">{unitL(u)}</span></div>
        <p className="m-0 mt-2 text-[15px] text-muted">{t.count} {t.count === 1 ? 'activity' : 'activities'} {periodLabel} · {fmtDur(t.dur)} moving</p>
        <div className="mt-4 grid grid-cols-3 gap-x-3 border-y border-line">
          <Stat v={<AnimatedNumber value={steps} format={fmtInt} duration={800} />} l="steps" />
          <Stat v={settings.weight ? <AnimatedNumber value={t.kcal} format={fmtInt} duration={800} /> : '–'} l="kcal" />
          <Stat v={<AnimatedNumber value={t.elev} format={fmtInt} duration={800} />} l="m climbed" />
        </div>
        {!settings.weight && <p className="m-0 mt-2 text-[13px] text-muted">Add your weight in settings to see calories.</p>}
      </section>

      <section className="mt-8"><SectionTitle>Step goal calendar</SectionTitle><Panel><Calendar map={map} goal={settings.goal} /></Panel></section>
      <section className="mt-8"><SectionTitle>Distance per week</SectionTitle><Panel><WeeklyDistance acts={acts} units={u} weekGoal={settings.weekGoal} /></Panel></section>
      {paceSet.filter(a => a.distance >= 500).length >= 2 && (
        <section className="mt-8"><SectionTitle aside={<span className="label">Higher is faster</span>}>{paceSet === runs ? 'Run' : 'Walk'} pace, recent</SectionTitle><Panel><PaceTrend acts={paceSet} units={u} /></Panel></section>
      )}

      <section className="mt-8">
        <SectionTitle>Personal bests</SectionTitle>
        {acts.length || bestDay ? (
          <div className="lift divide-y divide-line overflow-hidden rounded-[22px]">
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
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 text-[17px] font-bold">All activities</h2>
            <Segmented value={filter} onChange={setFilter} label="Filter activities" options={[['all', 'All'], ['walk', 'Walks'], ['run', 'Runs']]} /></div>
          {listed.length ? <ActivityList items={listed} /> : <Empty><p className="m-0">No {filter === 'run' ? 'runs' : 'walks'} yet.</p></Empty>}
        </section>
      )}
    </>
  );
}
