import { useState } from 'react';
import { useStore } from '../lib/store';
import { data, saveSettings } from '../lib/data';
import { isNative } from '../lib/platform';
import { enableReminders, scheduleReminder } from '../lib/reminders';

/** Daily streak reminder on/off and time. Saves straight away (turning on asks the phone for permission). */
export function ReminderControls() {
  const { settings } = useStore(data);
  const [msg, setMsg] = useState('');
  const on = !!settings.remind && isNative;
  if (!isNative) return <p className="m-0 mt-2 rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">Reminders work in the Lakad app for iPhone and Android.</p>;
  return (
    <div className="mt-2">
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Daily streak reminder</span>
        <input type="checkbox" role="switch" checked={on} onChange={async e => {
          setMsg('');
          if (e.target.checked && !(await enableReminders())) { setMsg('Notifications are off for Lakad. Allow them in your phone’s settings, then try again.'); return; }
          await saveSettings({ remind: e.target.checked }); void scheduleReminder();
        }} />
      </label>
      {on && (
        <label className="mt-1 flex min-h-11 items-center justify-between gap-3">
          <span className="text-muted">Remind me at</span>
          <input type="time" value={settings.remindAt || '19:00'} onChange={e => { if (e.target.value) { void saveSettings({ remindAt: e.target.value }); void scheduleReminder(); } }}
            className="rounded-[12px] border border-line bg-surface-2 px-3 py-2 font-semibold text-ink" />
        </label>
      )}
      {on && <p className="m-0 mt-1 text-[12px] text-muted">Only if you haven’t reached your goal yet that day.</p>}
      {msg && <p role="alert" className="m-0 mt-1 text-[13px] text-danger">{msg}</p>}
    </div>
  );
}
