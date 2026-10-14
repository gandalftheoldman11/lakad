import { useStore } from '../lib/store';
import { rec, resumePending, adoptPendingForSave, discardPending, elapsed } from '../lib/recorder';
import { data } from '../lib/data';
import { dateLabel, fmtDist, fmtTime, unitL } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { Button, LinkButton } from './ui';

export function PendingBanner({ onResume }: { onResume?: () => void }) {
  const { pending, session } = useStore(rec);
  const { settings } = useStore(data);
  if (!pending || session) return null;
  return (
    <div className="mb-4 shrink-0 rounded-[18px] bg-mango-soft px-3.5 py-3">
      <p className="m-0 mb-2 text-[14px] leading-snug">Unfinished {pending.type} from {dateLabel(pending.startedAt)}: <strong className="tabular-nums">{fmtDist(pending.distance, settings.units)} {unitL(settings.units)}</strong> in {fmtTime(elapsed(pending))}.</p>
      <div className="flex items-center gap-2">
        <Button variant="primary" className="min-h-10 px-4 py-1.5 text-[14px]" onClick={async () => { await resumePending(); onResume?.(); }}>Resume</Button>
        <Button className="min-h-10 px-4 py-1.5 text-[14px]" onClick={() => { adoptPendingForSave(); openDialog({ kind: 'finish' }); }}>Save it</Button>
        <LinkButton danger className="ml-auto text-[14px]" onClick={discardPending}>Discard</LinkButton>
      </div>
    </div>
  );
}
