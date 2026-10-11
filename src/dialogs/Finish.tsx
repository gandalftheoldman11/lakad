import { useState } from 'react';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { account } from '../lib/account';
import { postActivity } from '../lib/feed';
import { rec, elapsed, stepInfo, stepDistance, gpsQuality, finishAndSave, discard, resume } from '../lib/recorder';
import { fmtDist, fmtInt, fmtTime, unitL, unitM } from '../lib/format';
import { closeDialog } from '../lib/dialogs';
import { toast } from '../lib/ui';
import { Actions, Button, ErrorText, Field, LinkButton, SheetTitle } from '../components/ui';

export function Finish({ onSaved }: { onSaved: () => void }) {
  const { session: s } = useStore(rec);
  const { settings } = useStore(data);
  const acc = useStore(account);
  const [dist, setDist] = useState('');
  const [steps, setSteps] = useState('');
  const [note, setNote] = useState('');
  const [post, setPost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const sd = s ? stepDistance(s) : null;
  const q = s ? gpsQuality(s) : 1;
  const goodShare = s && s.fixUsed ? s.fixGood / s.fixUsed : 1;
  // Step length learned from your own GPS recordings is accurate to a few percent; a height estimate is not
  const calibrated = !!s && (s.type === 'run' ? settings.strideRunN : settings.strideWalkN) !== 0;
  const gap = s && sd ? Math.abs(sd - s.distance) / sd : 0;
  // Offer the step-based distance when GPS was unreliable and steps were really counted
  const offerSteps = !!s && !s.indoor && sd != null && sd > 200 && s.distance >= 10 && (q < 0.6 || gap > (calibrated ? 0.12 : 0.25));
  // Pre-select it only when GPS was clearly poor and your step length is known
  const [useSteps, setUseSteps] = useState(() => !!s && offerSteps && (q < 0.6 || (calibrated && goodShare < 0.5)));
  if (!s) return <><SheetTitle>Nothing to save</SheetTitle><Actions><Button onClick={closeDialog}>Close</Button></Actions></>;
  const u = settings.units, si = stepInfo(s), noGps = !s.indoor && s.distance < 10, sec = elapsed(s);
  const askDistance = noGps || s.indoor;

  async function save() {
    const dv = parseFloat(dist);
    if (askDistance && dist !== '' && !(dv >= 0 && dv <= 500)) return setErr('Enter a distance between 0 and 500.');
    if (askDistance && steps !== '' && !/^\d{1,6}$/.test(steps.trim())) return setErr('Steps must be a whole number.');
    if (sec < 5) return setErr('That recording is too short to save.');
    if (noGps && dist === '' && (si.src === 'estimate' || !sd)) return setErr('GPS recorded no distance. Enter the distance you covered.');
    setBusy(true);
    const a = await finishAndSave({
      note,
      useStepDistance: (offerSteps && useSteps) || (noGps && dist === '' && sd != null) || undefined,
      distance: askDistance && dv > 0 ? dv * unitM(u) : undefined,
      steps: askDistance && steps !== '' ? Math.max(0, parseInt(steps, 10)) : undefined
    });
    closeDialog();
    if (a) {
      toast(`${a.type === 'run' ? 'Run' : 'Walk'} saved`);
      if (post) postActivity(a).then(() => toast('Posted to the feed')).catch(() => toast("Saved, but couldn't post. Try from the activity later."));
    }
    onSaved();
  }

  return (
    <>
      <SheetTitle sub={`${fmtTime(sec)} moving · ${fmtDist(s.distance, u)} ${unitL(u)} · ${fmtInt(si.steps)} steps`}>Save your {s.indoor ? 'indoor ' : ''}{s.type}</SheetTitle>
      {offerSteps && (
        <div className="mt-4 rounded-2xl border border-line p-3.5">
          <p className="m-0 text-sm text-muted">{q < 0.6 ? `GPS was weak for ${Math.round((1 - q) * 100)}% of this ${s.type}.` : goodShare < 0.5 ? 'GPS signal was rough for most of this activity, which tends to undercount distance.' : 'GPS and your steps disagree on the distance.'} {calibrated ? 'Your step length is calibrated from earlier GPS recordings.' : 'Your step length is estimated from your height, so the step distance is approximate.'}</p>
          {([[false, `GPS distance: ${fmtDist(s.distance, u)} ${unitL(u)}`], [true, `Step distance: ${fmtDist(sd!, u)} ${unitL(u)} (${fmtInt(si.steps)} steps × ${(sd! / Math.max(1, si.steps)).toFixed(2)} m)`]] as const).map(([v, l]) => (
            <label key={String(v)} className="mt-2 flex items-center gap-2.5">
              <input type="radio" name="distSrc" className="h-5 w-5 accent-cobalt" checked={useSteps === v} onChange={() => setUseSteps(v)} />
              <span>{l}</span>
            </label>
          ))}
        </div>
      )}
      {askDistance && (
        <>
          <Field label={s.indoor ? `Treadmill distance (${unitL(u)}, optional)` : `Distance (${unitL(u)})`} id="xDist">
            <input id="xDist" type="number" inputMode="decimal" min="0" step="0.01" placeholder={sd ? `From steps: ${fmtDist(sd, u)}` : 'e.g. 2.5'} value={dist} onChange={e => setDist(e.target.value)} />
          </Field>
          <Field label={`Steps (blank to ${si.src === 'estimate' ? 'estimate' : 'use the counted steps'})`} id="xSteps">
            <input id="xSteps" type="number" inputMode="numeric" min="0" placeholder={si.src !== 'estimate' ? String(si.steps) : ''} value={steps} onChange={e => setSteps(e.target.value)} />
          </Field>
        </>
      )}
      <Field label="Note" id="xNote"><input id="xNote" maxLength={140} placeholder="Morning walk by the plaza" value={note} onChange={e => setNote(e.target.value)} /></Field>
      {acc.enabled && acc.session && (
        <label className="mt-4 flex items-start gap-2.5">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-cobalt" checked={post} onChange={e => setPost(e.target.checked)} />
          <span>Post to the feed<br /><span className="text-sm text-muted">Shares distance, time, steps, note and route shape. No map location.</span></span>
        </label>
      )}
      <ErrorText>{err}</ErrorText>
      <Actions>
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : `Save ${s.type}`}</Button>
        <Button disabled={busy} onClick={() => { closeDialog(); void resume(); }}>Keep going</Button>
      </Actions>
      <div className="mt-2.5 text-center">
        <LinkButton danger onClick={async () => { if (!confirm) return setConfirm(true); await discard(); closeDialog(); toast('Discarded'); }}>{confirm ? 'Tap again to discard' : 'Discard'}</LinkButton>
      </div>
    </>
  );
}
