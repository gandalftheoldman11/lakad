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
    <div className="mb-[18px] rounded-2xl bg-mango-soft px-4 py-3.5">
      <p className="m-0 mb-2.5">You have an unfinished {pending.type} from {dateLabel(pending.startedAt)}: {fmtDist(pending.distance, settings.units)} {unitL(settings.units)} in {fmtTime(elapsed(pending))}.</p>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="primary" className="min-h-10 py-2" onClick={async () => { await resumePending(); onResume?.(); }}>Resume</Button>
        <Button className="min-h-10 py-2" onClick={() => { adoptPendingForSave(); openDialog({ kind: 'finish' }); }}>Save it</Button>
        <LinkButton danger onClick={discardPending}>Discard</LinkButton>
      </div>
    </div>
  );
}
