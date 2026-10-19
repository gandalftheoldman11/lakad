import { TappableBadge } from './BadgeFx';
import { GoalBar, LinkButton } from './ui';
import { useMyBadge } from '../lib/myBadge';
import { BADGES } from '../lib/badges';
import { fmtInt } from '../lib/format';
import { openDialog } from '../lib/dialogs';

/** Your badge, your total steps, and how close the next level is */
export function MyBadgeCard() {
  const b = useMyBadge();
  const cur = BADGES[b.level - 1], next = BADGES[b.level] ?? null;
  const need = next ? Math.max(0, next.steps - b.steps) : 0;
  return (
    <div className="lift flex items-center gap-3 rounded-[22px] py-3 pr-4 pl-2">
      <TappableBadge level={b.level} size={b.level >= 6 ? 120 : 84} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[12px] font-semibold text-muted">Your badge</p>
        <p className="m-0 text-[20px] leading-tight font-black tracking-[-0.02em] [font-stretch:115%]">{cur.name}</p>
        <p className="m-0 mt-0.5 text-[13px] text-muted">{fmtInt(b.steps)} total steps</p>
        {next ? (
          <>
            <div className="mt-2"><GoalBar value={b.steps - cur.steps} max={next.steps - cur.steps} color="var(--mango)" label={`Progress to ${next.name}`} height={6} /></div>
            <p className="m-0 mt-1 text-[12px] text-muted">{fmtInt(need)} more steps to <strong className="font-semibold text-ink">{next.name}</strong></p>
          </>
        ) : <p className="m-0 mt-1 text-[12px] font-semibold text-ink">Top level. Keep it going!</p>}
        <LinkButton className="mt-1 text-[13px]" onClick={() => openDialog({ kind: 'badges' })}>See all levels</LinkButton>
      </div>
    </div>
  );
}
