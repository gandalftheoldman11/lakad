import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { stepsByDay, streakInfo, FREEZE_MAX } from '../lib/metrics';
import { closeDialog } from '../lib/dialogs';
import { fmtInt } from '../lib/format';
import { Button, SheetTitle } from '../components/ui';
import { ReminderControls } from '../components/ReminderControls';

/** Your streak, your freezes, how freezes work, and the reminder */
export function StreakSheet() {
  const { acts, days, settings } = useStore(data);
  const info = streakInfo(stepsByDay(acts, days), settings.goal);
  return (
    <>
      <SheetTitle sub={`Days in a row you reach ${fmtInt(settings.goal)} steps.`}>Your streak</SheetTitle>
      <div className="mt-4 flex items-end gap-3">
        <span className="num text-[64px] leading-none">{info.days}</span>
        <span className="pb-2 text-[17px] font-bold">{info.days === 1 ? 'day' : 'days'}</span>
        <span className="ml-auto pb-2 text-right text-[14px] text-muted">{info.todayMet ? 'Today’s goal reached ✓' : `${fmtInt(info.todayLeft)} steps to go today`}</span>
      </div>

      <div className="lift mt-5 rounded-[20px] p-4">
        <div className="flex items-center justify-between">
          <strong className="text-[16px]">Streak freezes</strong>
          <span className="flex gap-1.5" aria-label={`${info.freezes} of ${FREEZE_MAX} freezes ready`}>
            {Array.from({ length: FREEZE_MAX }, (_, i) => (
              <span key={i} className={`grid h-9 w-9 place-items-center rounded-full text-[18px] ${i < info.freezes ? 'bg-[#DDF3FF] shadow-[inset_0_0_0_2px_#7FC6F2]' : 'bg-surface-2 opacity-60 grayscale'}`} aria-hidden="true">❄️</span>
            ))}
          </span>
        </div>
        <p className="m-0 mt-2 text-[14px] text-muted">
          Miss your goal one day and a freeze is used automatically, so your streak keeps going. You get a new freeze every Monday and can hold up to {FREEZE_MAX}.
        </p>
        {info.frozen.size > 0 && <p className="m-0 mt-2 text-[14px]">❄️ {info.frozen.size === 1 ? 'A freeze has' : `${info.frozen.size} freezes have`} saved this streak so far.</p>}
      </div>

      <div className="mt-5">
        <strong className="text-[16px]">Reminder</strong>
        <ReminderControls />
      </div>
      <Button className="mt-5 w-full" onClick={closeDialog}>Close</Button>
    </>
  );
}
