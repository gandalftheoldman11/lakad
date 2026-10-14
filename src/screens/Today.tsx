import { useMemo } from 'react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { stepsByDay, streak, sumWhere } from '../lib/metrics';
import { fmtDist, fmtDur, fmtInt, sod, unitL, unitM, weekStart } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { TopBar } from '../components/TopBar';
import { WeekSteps } from '../components/charts';
import { ActivityList } from '../components/ActivityList';
import { PendingBanner } from '../components/PendingBanner';
import { Button, Empty, GoalBar, GoalPath, LinkButton, Panel, SectionTitle } from '../components/ui';
import { isInstalledPwa, isNative } from '../lib/platform';

export function Today({ go }: { go: (t: 'record') => void }) {
  const { acts, days, settings } = useStore(data);
  const map = useMemo(() => stepsByDay(acts, days), [acts, days]);
  const today = sod(Date.now());
  const t = sumWhere(acts, settings, a => a.start >= today);
  const steps = map.get(today) || 0, g = settings.goal, u = settings.units;
  const ws = weekStart(Date.now()), wDist = sumWhere(acts, settings, a => a.start >= ws).dist;
  const st = streak(map, g);
  const needBody = !settings.height || !settings.weight;
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <TopBar />
      <PendingBanner onResume={() => go('record')} />

      <section aria-label="Today's steps">
        <p className="m-0 mb-2 text-[15px] font-medium text-muted">{dateLine}</p>
        <div className="num huge"><AnimatedNumber value={steps} format={fmtInt} duration={1100} countUpKey="today-steps" /></div>
        <p className="mt-3 mb-0 text-[16px]">
          {steps >= g
            ? <><strong className="font-semibold">Goal reached.</strong> <span className="text-muted">{fmtInt(steps - g)} steps past {fmtInt(g)}.</span></>
            : <><strong className="font-semibold">{fmtInt(g - steps)} steps</strong> <span className="text-muted">to your {fmtInt(g)} goal.</span></>}
        </p>
        <div className="mt-5 -mx-1"><GoalPath value={steps} max={g} label="Daily step goal" /></div>
        <div className="mt-1 flex justify-end">
          <LinkButton className="text-[14px]" onClick={() => openDialog({ kind: 'day' })}>{days[today]?.steps ? 'Update' : 'Add'} steps from your phone or watch</LinkButton>
        </div>
      </section>

      <div className="hairline-x mt-6 grid grid-cols-3">
        <div className="pr-3"><span className="num mid block"><AnimatedNumber value={t.dist} format={n => fmtDist(n, u)} /></span><span className="label">{unitL(u)} today</span></div>
        <div className="px-3"><span className="num mid block">{settings.weight ? <AnimatedNumber value={t.kcal} format={fmtInt} /> : fmtDur(t.dur)}</span><span className="label">{settings.weight ? 'kcal burned' : 'active'}</span></div>
        <div className="pl-3"><span className="num mid block"><AnimatedNumber value={st} format={n => String(Math.round(n))} /></span><span className="label">day streak</span></div>
      </div>

      {settings.weekGoal > 0 && (
        <div className="lift mt-6 rounded-[22px] px-4 py-3.5">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">This week</span>
            <span className="text-[14px] text-muted"><span className="font-semibold text-ink tabular-nums"><AnimatedNumber value={wDist} format={n => fmtDist(n, u)} /></span> of {settings.weekGoal} {unitL(u)}</span>
          </div>
          <GoalBar value={wDist / unitM(u)} max={settings.weekGoal} color="var(--cobalt)" label="Weekly distance goal" height={8} />
        </div>
      )}

      <section className="mt-8">
        <SectionTitle aside={<span className="label">Dashed line is your goal</span>}>Last 7 days</SectionTitle>
        <Panel><WeekSteps map={map} goal={g} /></Panel>
      </section>

      <section className="mt-8">
        <SectionTitle aside={acts.length > 0 ? <LinkButton className="text-[14px]" onClick={() => openDialog({ kind: 'form' })}>Add past activity</LinkButton> : undefined}>Recent</SectionTitle>
        {acts.length ? <ActivityList items={acts.slice(0, 5)} /> : (
          <Empty>
            <p className="m-0 mb-4">No walks or runs yet. Record one now, or add one you already did.</p>
            <div className="flex flex-wrap justify-center gap-2.5"><Button variant="primary" onClick={() => go('record')}>Start recording</Button><Button onClick={() => openDialog({ kind: 'form' })}>Add past activity</Button></div>
          </Empty>
        )}
      </section>

      {(needBody || !isNative) && (
        <div className="mt-8 space-y-2 text-[14px] text-muted">
          {needBody && <p className="m-0">Add your height and weight in <LinkButton onClick={() => openDialog({ kind: 'settings' })}>settings</LinkButton> for accurate step length and calories.</p>}
          {!isNative && <p className="m-0">{isInstalledPwa ? 'For tracking with the screen off, use the Lakad app for iPhone or Android.' : 'Add Lakad to your home screen. For tracking with the screen off, use the Lakad app for iPhone or Android.'}</p>}
        </div>
      )}
    </>
  );
}
