import type { Activity } from '../types';
import { dateLabel, fmtDist, fmtDur, fmtInt, unitL } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { RouteShape } from './RouteShape';
import { IconRun, IconWalk } from './icons';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { shareTitle } from '../lib/shareImage';

export function ActivityList({ items }: { items: Activity[] }) {
  const { settings } = useStore(data);
  if (!items.length) return null;
  return (
    <ul className="lift m-0 list-none overflow-hidden rounded-[22px] p-0">
      {items.map((a, i) => (
        <li key={a.id} className={i ? 'border-t border-line' : ''}>
          <button className="grid w-full grid-cols-[60px_1fr_auto] items-center gap-3.5 px-3.5 py-3 text-left transition-colors active:bg-surface-2" onClick={() => openDialog({ kind: 'detail', id: a.id })}>
            <span className="grid h-[60px] w-[60px] place-items-center overflow-hidden rounded-[16px] bg-cobalt-soft">
              {a.route.length > 1 ? <RouteShape route={a.route} w={60} h={60} pad={10} stroke={2.6} /> : a.type === 'run' ? <IconRun /> : <IconWalk />}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-[15px] font-semibold">{shareTitle(a)}</strong>
              <span className="block truncate text-[13px] text-muted">{dateLabel(a.start)} · {fmtDur(a.duration)} · {fmtInt(a.steps)} steps</span>
            </span>
            <span className="text-right">
              <span className="num block text-[22px]">{fmtDist(a.distance, settings.units)}</span>
              <span className="label">{unitL(settings.units)}{a.type === 'run' ? ' run' : ''}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
