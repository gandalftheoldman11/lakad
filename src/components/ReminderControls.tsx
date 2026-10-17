import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { data, saveSettings } from '../lib/data';
import { isNative } from '../lib/platform';
import { enableReminders, reminderPermission, scheduleReminder } from '../lib/reminders';

/** Daily streak reminder on/off and time. Saves straight away (turning on asks the phone for permission). */
export function ReminderControls() {
  const { settings } = useStore(data);
  const [msg, setMsg] = useState('');
  const [perm, setPerm] = useState('');
  useEffect(() => { void reminderPermission().then(setPerm); }, [settings.remind]);
  // on only when it will actually notify: the setting is on AND the phone allows notifications
  const on = !!settings.remind && isNative && perm === 'granted';
  if (!isNative) return <p className="m-0 mt-2 rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">Reminders work in the Lakad app for iPhone and Android.</p>;
  return (
    <div className="mt-2">
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Daily streak reminder</span>
        <input type="checkbox" role="switch" checked={on} onChange={async e => {
          setMsg('');
          if (e.target.checked && !(await enableReminders())) { setPerm('denied'); setMsg('Notifications are off for Lakad. Allow them in your phone’s settings, then try again.'); return; }
          if (e.target.checked) setPerm('granted');
          await saveSettings({ remind: e.target.checked, remindAsked: true }); void scheduleReminder();
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
