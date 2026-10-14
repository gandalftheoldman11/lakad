import { useState } from 'react';
import { isIOSApp } from '../lib/platform';
import { useStore } from '../lib/store';
import { data, saveDay } from '../lib/data';
import { parseYmd, sod, ymd } from '../lib/format';
import { closeDialog } from '../lib/dialogs';
import { toast } from '../lib/ui';
import { Actions, Button, ErrorText, Field, SheetTitle } from '../components/ui';

export function DaySteps() {
  const { days } = useStore(data);
  const today = sod(Date.now());
  const [date, setDate] = useState(ymd(today));
  const [steps, setSteps] = useState(days[today]?.steps ? String(days[today].steps) : '');
  const [err, setErr] = useState('');
  return (
    <>
      <SheetTitle sub={isIOSApp ? 'Lakad reads your iPhone’s step counter automatically. Enter a number only if your watch counted more, for example on a walk without your phone.' : 'Copy the day’s total from Google Fit, Samsung Health, Apple Health or your watch. Lakad uses whichever is higher: this number or the steps from your recorded activities.'}>{isIOSApp ? 'Edit daily steps' : 'Steps from your phone'}</SheetTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day" id="dDate"><input id="dDate" type="date" value={date} max={ymd(today)} onChange={e => { setDate(e.target.value); const v = days[parseYmd(e.target.value)]?.steps; setSteps(v ? String(v) : ''); }} /></Field>
        <Field label="Total steps" id="dSteps"><input id="dSteps" type="number" inputMode="numeric" min="0" value={steps} onChange={e => setSteps(e.target.value)} /></Field>
      </div>
      <p className="m-0 mt-2 text-sm text-muted">Enter 0 to clear a day.</p>
      <ErrorText>{err}</ErrorText>
      <Actions>
        <Button variant="primary" onClick={async () => {
          const n = parseInt(steps || '0', 10);
          if (!/^\d{0,6}$/.test(steps.trim()) || !(n >= 0) || n > 200000) return setErr('Enter a step count between 0 and 200,000.');
          closeDialog(); await saveDay(parseYmd(date), n); toast('Steps saved');
        }}>Save steps</Button>
        <Button onClick={closeDialog}>Cancel</Button>
      </Actions>
    </>
  );
}
