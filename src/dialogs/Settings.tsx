import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { data, saveActivity, saveDay, saveSettings } from '../lib/data';
import { account } from '../lib/account';
import { closeDialog } from '../lib/dialogs';
import { activitiesCsv, backupJson, parseBackup } from '../lib/exporters';
import { saveFile } from '../lib/files';
import { unitL, unitWord, ymd } from '../lib/format';
import { strideFromHeight } from '../lib/metrics';
import { isIOSApp, isNative } from '../lib/platform';
import { toast } from '../lib/ui';
import { Actions, Button, ErrorText, Field, SheetTitle } from '../components/ui';
import type { Units } from '../types';

function Toggle({ label, checked, set }: { label: string; checked: boolean; set: (v: boolean) => void }) {
  return <label className="mt-3.5 flex items-center justify-between gap-3"><span>{label}</span><input type="checkbox" className="h-[22px] w-[22px] accent-cobalt" checked={checked} onChange={e => set(e.target.checked)} /></label>;
}
const Sec = ({ title, sub }: { title: string; sub?: string }) => <><h4 className="m-0 text-base font-bold">{title}</h4>{sub && <p className="m-0 mt-1 text-sm text-muted">{sub}</p>}</>;

export function SettingsDialog() {
  const { settings: s, all, acts, days } = useStore(data);
  const acc = useStore(account);
  const [goal, setGoal] = useState(String(s.goal));
  const [week, setWeek] = useState(s.weekGoal ? String(s.weekGoal) : '');
  const [units, setUnits] = useState<Units>(s.units);
  const [height, setHeight] = useState(s.height ? String(s.height) : '');
  const [weight, setWeight] = useState(s.weight ? String(s.weight) : '');
  const [autoPause, setAutoPause] = useState(s.autoPause);
  const [voice, setVoice] = useState(s.voice);
  const [lockScreen, setLockScreen] = useState(s.lockScreen !== false);
  const [walkCm, setWalkCm] = useState(s.strideWalkN < 0 ? String(Math.round(s.strideWalk * 100)) : '');
  const [runCm, setRunCm] = useState(s.strideRunN < 0 ? String(Math.round(s.strideRun * 100)) : '');
  const [resetCal, setResetCal] = useState(false);
  const strideNote = (n: number) => n < 0 ? 'set by you' : n > 0 ? `learned from ${n} GPS recording${n === 1 ? '' : 's'}` : 'estimated from height';
  const shown = (type: 'walk' | 'run') => {
    const v = type === 'run' ? s.strideRun : s.strideWalk, n = type === 'run' ? s.strideRunN : s.strideWalkN;
    const hNow = parseFloat(height) || 0;
    return (v > 0 && !resetCal ? v : strideFromHeight(type, { ...s, height: hNow })).toFixed(2) + ' m, ' + (resetCal ? 'estimated from height' : strideNote(n));
  };
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);

  async function save() {
    const g = parseInt(goal, 10), h = parseFloat(height), w = parseFloat(weight), wk = parseFloat(week);
    const wc = parseFloat(walkCm), rc = parseFloat(runCm);
    if (walkCm && !(wc >= 30 && wc <= 150)) return setErr('Walking step length should be between 30 and 150 cm.');
    if (runCm && !(rc >= 40 && rc <= 250)) return setErr('Running step length should be between 40 and 250 cm.');
    const stride = {
      strideWalk: walkCm ? wc / 100 : resetCal || s.strideWalkN < 0 ? 0 : s.strideWalk,
      strideWalkN: walkCm ? -1 : resetCal || s.strideWalkN < 0 ? 0 : s.strideWalkN,
      strideRun: runCm ? rc / 100 : resetCal || s.strideRunN < 0 ? 0 : s.strideRun,
      strideRunN: runCm ? -1 : resetCal || s.strideRunN < 0 ? 0 : s.strideRunN
    };
    if (!(g >= 100 && g <= 100000)) return setErr('Set a daily goal between 100 and 100,000 steps.');
    if (height && !(h >= 100 && h <= 230)) return setErr('Height should be between 100 and 230 cm.');
    if (weight && !(w >= 25 && w <= 300)) return setErr('Weight should be between 25 and 300 kg.');
    // keep the weekly goal the same real distance when switching units
    let weekGoal = wk > 0 ? wk : 0;
    if (weekGoal && units !== s.units && String(s.weekGoal) === week) weekGoal = +(units === 'mi' ? weekGoal / 1.609344 : weekGoal * 1.609344).toFixed(1);
    closeDialog();
    await saveSettings({ goal: g, units, weekGoal, height: h || 0, weight: w || 0, autoPause, voice, lockScreen, ...stride });
    toast('Settings saved');
  }
  async function restore(f: File) {
    try {
      const b = parseBackup(await f.text());
      const have = new Set(acts.map(a => a.id)); // deleted ones are restored
      let added = 0;
      for (const a of b.activities) if (!have.has(a.id)) { await saveActivity(a); added++; }
      for (const d of b.days) if (d.steps > (days[d.date]?.steps || 0)) await saveDay(d.date, d.steps);
      toast(`Restored ${added} ${added === 1 ? 'activity' : 'activities'}`);
    } catch { toast("That file isn't a Lakad backup"); }
  }

  return (
    <>
      <SheetTitle>Settings</SheetTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Daily step goal" id="sGoal"><input id="sGoal" type="number" inputMode="numeric" min="100" step="500" value={goal} onChange={e => setGoal(e.target.value)} /></Field>
        <Field label={`Weekly goal (${unitL(units)})`} id="sWeek"><input id="sWeek" type="number" inputMode="decimal" min="0" step="1" placeholder="Off" value={week} onChange={e => setWeek(e.target.value)} /></Field>
      </div>
      <Field label="Distance units" id="sUnits"><select id="sUnits" value={units} onChange={e => setUnits(e.target.value as Units)}><option value="km">Kilometers</option><option value="mi">Miles</option></select></Field>

      <div className="mt-[22px] border-t border-line pt-[18px]">
        <Sec title="Your body" sub="Used for step length and calorie estimates. Private to you." />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Height (cm)" id="sH"><input id="sH" type="number" inputMode="numeric" min="100" max="230" placeholder="165" value={height} onChange={e => setHeight(e.target.value)} /></Field>
          <Field label="Weight (kg)" id="sW"><input id="sW" type="number" inputMode="decimal" min="25" max="300" step="0.1" placeholder="65" value={weight} onChange={e => setWeight(e.target.value)} /></Field>
        </div>
      </div>

      <div className="mt-[22px] border-t border-line pt-[18px]">
        <Sec title="Step length" sub="Used to estimate steps from GPS and distance from steps indoors. Lakad learns it from walks and runs with good GPS and counted steps. Leave blank to keep it automatic." />
        <p className="m-0 mt-2 text-sm">Walking: {shown('walk')}<br />Running: {shown('run')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Set walking (cm)" id="sSW"><input id="sSW" type="number" inputMode="numeric" min="30" max="150" placeholder="Auto" value={walkCm} onChange={e => setWalkCm(e.target.value)} /></Field>
          <Field label="Set running (cm)" id="sSR"><input id="sSR" type="number" inputMode="numeric" min="40" max="250" placeholder="Auto" value={runCm} onChange={e => setRunCm(e.target.value)} /></Field>
        </div>
        {(s.strideWalkN !== 0 || s.strideRunN !== 0) && (
          <label className="mt-3 flex items-center gap-2.5 text-sm"><input type="checkbox" className="h-5 w-5 accent-cobalt" checked={resetCal} onChange={e => { setResetCal(e.target.checked); if (e.target.checked) { setWalkCm(''); setRunCm(''); } }} />Reset to automatic (forget learned values)</label>
        )}
      </div>

      <div className="mt-[22px] border-t border-line pt-[18px]">
        <Sec title="Recording" />
        <Toggle label="Auto-pause when you stop moving" checked={autoPause} set={setAutoPause} />
        <Toggle label={`Spoken alert and vibration every ${unitWord(units, 1)}`} checked={voice} set={setVoice} />
        {isNative && <Toggle label={isIOSApp ? 'Live stats on the lock screen and Dynamic Island' : 'Live stats on the lock screen'} checked={lockScreen} set={setLockScreen} />}
      </div>

      <div className="mt-[22px] border-t border-line pt-[18px]">
        <Sec title="Your data" sub={acc.session ? 'Saved on this device and synced to your account.' : 'Saved on this device.'} />
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          <Button disabled={!acts.length} onClick={() => saveFile(`lakad-activities-${ymd(Date.now())}.csv`, activitiesCsv(acts, s), 'text/csv')}>Export CSV</Button>
          <Button onClick={() => saveFile(`lakad-backup-${ymd(Date.now())}.json`, backupJson(all, days, s), 'application/json')}>Save backup</Button>
          <Button onClick={() => file.current?.click()}>Restore backup</Button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void restore(f); }} />
        </div>
      </div>
      <ErrorText>{err}</ErrorText>
      <Actions><Button variant="primary" onClick={save}>Save settings</Button><Button onClick={closeDialog}>Cancel</Button></Actions>
      <p className="m-0 mt-4 text-center text-xs text-muted">Map data © OpenStreetMap contributors</p>
    </>
  );
}
