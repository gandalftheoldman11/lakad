import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { stepsByDay, streak, sumWhere } from '../lib/metrics';
import { fmtDist, fmtDur, fmtInt, sod, unitL, unitM, weekStart } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { TopBar } from '../components/TopBar';
import { WeekSteps } from '../components/charts';
import { ActivityList } from '../components/ActivityList';
import { PendingBanner } from '../components/PendingBanner';
import { Button, Empty, GoalBar, LinkButton, Panel } from '../components/ui';
import { isInstalledPwa, isNative } from '../lib/platform';

export function Today({ go }: { go: (t: 'record') => void }) {
  const { acts, days, settings } = useStore(data);
  const map = useMemo(() => stepsByDay(acts, days), [acts, days]);
  const today = sod(Date.now());
  const t = sumWhere(acts, settings, a => a.start >= today);
  const steps = map.get(today) || 0, g = settings.goal;
  const ws = weekStart(Date.now()), wDist = sumWhere(acts, settings, a => a.start >= ws).dist;
  const st = streak(map, g);
  const needBody = !settings.height || !settings.weight;

  return (
    <>
      <TopBar />
      <PendingBanner onResume={() => go('record')} />
      <div>
        <div className="num huge">{fmtInt(steps)}</div>
        <p className="mt-2 mb-0 text-muted">{steps >= g ? `steps today. Goal of ${fmtInt(g)} reached.` : `steps today. ${fmtInt(g - steps)} to go for your ${fmtInt(g)} goal.`}</p>
        <div className="mt-3.5"><GoalBar value={steps} max={g} color="var(--mango)" label="Daily step goal" /></div>
        <p className="mt-2 mb-0 text-sm"><LinkButton onClick={() => openDialog({ kind: 'day' })}>{days[today]?.steps ? 'Update' : 'Enter'} today's total from your phone or watch</LinkButton></p>
      </div>

      <div className="mt-[22px] grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-line bg-line">
        <div className="bg-surface px-3 py-3.5"><span className="num mid block">{fmtDist(t.dist, settings.units)}</span><span className="text-sm text-muted">{unitL(settings.units)} today</span></div>
        <div className="bg-surface px-3 py-3.5"><span className="num mid block">{settings.weight ? fmtInt(t.kcal) : fmtDur(t.dur)}</span><span className="text-sm text-muted">{settings.weight ? 'kcal burned' : 'active'}</span></div>
        <div className="bg-surface px-3 py-3.5"><span className="num mid block">{st}</span><span className="text-sm text-muted">day streak</span></div>
      </div>

      {settings.weekGoal > 0 && (
        <div className="mt-[18px]">
          <div className="mb-2 flex items-baseline justify-between"><strong>This week</strong><span className="text-sm text-muted">{fmtDist(wDist, settings.units)} of {settings.weekGoal} {unitL(settings.units)}</span></div>
          <GoalBar value={wDist / unitM(settings.units)} max={settings.weekGoal} color="var(--cobalt)" label="Weekly distance goal" height={10} />
        </div>
      )}
      {needBody && <p className="mt-3 text-sm text-muted">Add your height and weight in <LinkButton onClick={() => openDialog({ kind: 'settings' })}>settings</LinkButton> for accurate step length and calories.</p>}
      {!isNative && <p className="mt-3 text-sm text-muted">{isInstalledPwa ? 'For tracking with the screen off, use the Android app.' : 'Tip: add Lakad to your home screen. For tracking with the screen off, use the Android app.'}</p>}

      <section className="mt-7">
        <div className="flex items-baseline justify-between"><h2 className="m-0 mb-3 text-lg font-bold">Last 7 days</h2><span className="text-sm text-muted">Dashed line is your goal</span></div>
        <Panel><WeekSteps map={map} goal={g} /></Panel>
      </section>

      <section className="mt-7">
        <div className="flex items-baseline justify-between"><h2 className="m-0 mb-3 text-lg font-bold">Recent</h2>{acts.length > 0 && <LinkButton onClick={() => openDialog({ kind: 'form' })}>Add past activity</LinkButton>}</div>
        {acts.length ? <ActivityList items={acts.slice(0, 5)} /> : (
          <Empty>
            <p className="m-0 mb-3.5">No walks or runs yet. Record one now, or add one you already did.</p>
            <div className="flex flex-wrap justify-center gap-2.5"><Button variant="primary" onClick={() => go('record')}>Start recording</Button><Button onClick={() => openDialog({ kind: 'form' })}>Add past activity</Button></div>
          </Empty>
        )}
      </section>
    </>
  );
}
