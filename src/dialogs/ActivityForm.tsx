import { useState } from 'react';
import { useStore } from '../lib/store';
import { data, saveActivity } from '../lib/data';
import { updatePostFor } from '../lib/feed';
import { strideM } from '../lib/metrics';
import { hm, newId, unitL, unitM, ymd } from '../lib/format';
import { closeDialog } from '../lib/dialogs';
import { toast } from '../lib/ui';
import { Actions, Button, ErrorText, Field, SheetTitle } from '../components/ui';
import type { Activity, ActivityType } from '../types';

export function ActivityForm({ id }: { id?: string }) {
  const { acts, settings } = useStore(data);
  const old = id ? acts.find(a => a.id === id) : undefined;
  const u = settings.units, now = Date.now(), d0 = old ? old.start : now - 30 * 60000;
  const [type, setType] = useState<ActivityType>(old?.type || 'walk');
  const [date, setDate] = useState(ymd(d0));
  const [time, setTime] = useState(hm(d0));
  const [dur, setDur] = useState(old ? String(+(old.duration / 60).toFixed(1)) : '');
  const [dist, setDist] = useState(old ? String(+(old.distance / unitM(u)).toFixed(2)) : '');
  const [steps, setSteps] = useState(old ? String(old.steps) : '');
  const [note, setNote] = useState(old?.note || '');
  const [err, setErr] = useState('');

  async function save() {
    const minutes = parseFloat(dur), dv = parseFloat(dist) || 0;
    if (!(minutes > 0)) return setErr('Enter how many minutes it took.');
    if (!dv && steps === '') return setErr('Enter a distance or a step count.');
    if (dist !== '' && !(dv >= 0 && dv <= 500)) return setErr('Enter a distance between 0 and 500.');
    if (steps !== '' && !/^\d{1,6}$/.test(steps.trim())) return setErr('Steps must be a whole number.');
    const [y, m, d] = date.split('-').map(Number), [hh, mm] = (time || '08:00').split(':').map(Number);
    const start = new Date(y, m - 1, d, hh, mm).getTime();
    if (!Number.isFinite(start)) return setErr('Check the date and time.');
    if (start > Date.now()) return setErr('The start time is in the future.');
    let distance = dv * unitM(u);
    const st = steps !== '' ? Math.max(0, parseInt(steps, 10)) : Math.round(distance / strideM(type, settings));
    if (!distance && st) distance = st * strideM(type, settings);
    if (minutes > 24 * 60) return setErr('That is longer than a day.');
    const speed = distance / (minutes * 60);
    if (speed > (type === 'run' ? 8 : 4)) return setErr(`That is faster than a plausible ${type}. Check distance and minutes.`);
    const distChanged = !!old && Math.abs(distance - old.distance) > 5;
    const a: Activity = {
      ...(old || { id: newId(), route: [], elevGain: null, updatedAt: 0 }),
      type, start, duration: Math.round(minutes * 60), distance: Math.round(distance), steps: st,
      stepsSource: steps !== '' ? (old && st === old.steps ? old.stepsSource : 'manual') : 'estimate',
      note: note.trim().slice(0, 140), distanceEdited: old?.distanceEdited || distChanged
    } as Activity;
    closeDialog();
    const saved = await saveActivity(a);
    if (old) void updatePostFor(saved);
    toast(old ? 'Changes saved' : 'Activity added');
  }

  return (
    <>
      <SheetTitle sub={old ? undefined : "For walks or runs you didn't record here."}>{old ? 'Edit activity' : 'Add a past activity'}</SheetTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" id="fType"><select id="fType" value={type} onChange={e => setType(e.target.value as ActivityType)}><option value="walk">Walk</option><option value="run">Run</option></select></Field>
        <Field label="Date" id="fDate"><input id="fDate" type="date" value={date} max={ymd(now)} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Start time" id="fTime"><input id="fTime" type="time" value={time} onChange={e => setTime(e.target.value)} /></Field>
        <Field label="Duration (minutes)" id="fDur"><input id="fDur" type="number" inputMode="decimal" min="1" step="0.1" placeholder="30" value={dur} onChange={e => setDur(e.target.value)} /></Field>
        <Field label={`Distance (${unitL(u)})`} id="fDist"><input id="fDist" type="number" inputMode="decimal" min="0" step="0.01" placeholder="2.4" value={dist} onChange={e => setDist(e.target.value)} /></Field>
        <Field label="Steps" id="fSteps"><input id="fSteps" type="number" inputMode="numeric" min="0" placeholder="Blank to estimate" value={steps} onChange={e => setSteps(e.target.value)} /></Field>
      </div>
      <Field label="Note" id="fNote"><input id="fNote" maxLength={140} value={note} onChange={e => setNote(e.target.value)} /></Field>
      {old && old.route.length > 1 && <p className="m-0 mt-2 text-sm text-muted">Changing the distance replaces the GPS distance and hides splits for this activity.</p>}
      <ErrorText>{err}</ErrorText>
      <Actions><Button variant="primary" onClick={save}>{old ? 'Save changes' : 'Add activity'}</Button><Button onClick={closeDialog}>Cancel</Button></Actions>
    </>
  );
}
