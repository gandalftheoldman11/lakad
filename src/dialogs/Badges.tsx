import { Badge } from '../components/Badge';
import { LevelUpStage, TappableBadge } from '../components/BadgeFx';
import { BADGES, WINDOW_DAYS, MANUAL_DAY_CAP } from '../lib/badges';
import { useMyBadge } from '../lib/myBadge';
import { closeDialog } from '../lib/dialogs';
import { Actions, Button, SheetTitle } from '../components/ui';

/** All levels: what each needs, and where you are */
export function BadgesSheet() {
  const b = useMyBadge();
  return (
    <>
      <SheetTitle sub={`Your badge levels up with active days in the last ${WINDOW_DAYS / 7} weeks: days you record a walk or run, or reach your step goal. Rest days are fine.`}>Badge levels</SheetTitle>
      <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-2.5 p-0">
        {BADGES.map(l => {
          const mine = l.level === b.level, reached = l.level <= b.level;
          return (
            <li key={l.level} className={`flex flex-col items-center rounded-[20px] px-2 pt-3 pb-3 text-center ${mine ? 'bg-cobalt-soft ring-2 ring-[var(--cobalt)]' : 'bg-surface-2'}`}>
              {mine ? <TappableBadge level={l.level} size={l.level >= 6 ? 136 : 92} />
                : <span className={reached ? '' : 'opacity-45 grayscale-[.85]'}><Badge level={l.level} size={l.level >= 6 ? 136 : 92} animate={false} /></span>}
              <strong className="mt-1 text-[15px] font-bold">{l.name}</strong>
              <span className="text-[12px] text-muted">{l.days === 0 ? 'Everyone starts here' : `${l.days} active days`}</span>
              {mine && <span className="mt-1 rounded-full bg-cobalt px-2.5 py-0.5 text-[11px] font-bold text-on-cobalt">You</span>}
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-4 text-[13px] text-muted">If you take a break, your badge fades back slowly, at most one level a week. Steps typed in by hand count for up to {MANUAL_DAY_CAP} days; recorded walks and the phone’s own step counter always count.</p>
      <Actions><Button variant="primary" onClick={closeDialog}>Done</Button></Actions>
    </>
  );
}

/** Celebration when you reach a new level */
export function LevelUp({ level }: { level: number }) {
  const l = BADGES[Math.max(0, Math.min(BADGES.length - 1, level - 1))];
  const { days } = useMyBadge();
  return (
    <>
      <LevelUpStage level={l.level} size={l.level >= 6 ? 230 : 165} />
      <p className="m-0 text-center text-[14px] font-semibold text-muted">New badge level</p>
      <h3 className="m-0 mt-1 text-center text-[30px] font-black tracking-[-0.02em] [font-stretch:120%]">{l.name}</h3>
      <p className="m-0 mt-2 text-center text-[15px] text-muted">You’ve been active {days} {days === 1 ? 'day' : 'days'} in the last 4 weeks. Your friends will see it next to your name.</p>
      <Actions><Button variant="primary" onClick={closeDialog}>Nice!</Button></Actions>
    </>
  );
}
