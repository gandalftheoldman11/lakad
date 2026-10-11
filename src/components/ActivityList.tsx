import type { Activity } from '../types';
import { dateLabel, fmtDist, fmtDur, fmtInt, typeWord, unitL } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { RouteShape } from './RouteShape';
import { IconRun, IconWalk } from './icons';
import { useStore } from '../lib/store';
import { data } from '../lib/data';

export function ActivityList({ items }: { items: Activity[] }) {
  const { settings } = useStore(data);
  if (!items.length) return null;
  return (
    <ul className="m-0 list-none border-t border-line p-0">
      {items.map(a => (
        <li key={a.id} className="border-b border-line">
          <button className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 px-0.5 py-3 text-left" onClick={() => openDialog({ kind: 'detail', id: a.id })}>
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-cobalt-soft">
              {a.route.length > 1 ? <RouteShape route={a.route} w={56} h={56} pad={8} stroke={2.5} /> : a.type === 'run' ? <IconRun /> : <IconWalk />}
            </span>
            <span className="min-w-0">
              <strong className="block truncate font-bold">{typeWord(a.type)}{a.note ? ` · ${a.note}` : ''}</strong>
              <span className="text-sm text-muted">{dateLabel(a.start)} · {fmtDur(a.duration)} · {fmtInt(a.steps)} steps</span>
            </span>
            <span className="text-right text-lg font-extrabold tabular-nums [font-stretch:115%]">{fmtDist(a.distance, settings.units)}<span className="text-sm font-normal text-muted"> {unitL(settings.units)}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}
