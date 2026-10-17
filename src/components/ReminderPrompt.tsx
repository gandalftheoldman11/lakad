import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { data, saveSettings } from '../lib/data';
import { isNative } from '../lib/platform';
import { enableReminders, reminderPermission, scheduleReminder } from '../lib/reminders';
import { toast } from '../lib/ui';
import { Button, LinkButton } from './ui';

const time = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h || 0, m || 0, 0, 0); return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };

/**
 * Shown on Today right after you reach your goal (a natural moment to ask), in the app only, once:
 * not if you turned reminders off yourself, already answered, or already said no to the phone's prompt.
 */
export function ReminderPrompt({ met }: { met: boolean }) {
  const { settings } = useStore(data);
  const [perm, setPerm] = useState<string>('');
  const eligible = isNative && met && settings.remind !== false && !settings.remindAsked;
  useEffect(() => { if (eligible) void reminderPermission().then(setPerm); }, [eligible]);
  if (!eligible || perm !== 'prompt') return null;
  const at = settings.remindAt || '19:00';
  return (
    <div className="lift card-in mt-6 rounded-[22px] p-4" role="region" aria-label="Turn on streak reminders">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mango-soft text-[20px]" aria-hidden="true">🔔</span>
        <div className="min-w-0">
          <strong className="block text-[16px]">Keep it going?</strong>
          <p className="m-0 mt-0.5 text-[14px] text-muted">Get a reminder at {time(at)} on days you haven’t reached your goal yet. Never when you already have.</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <Button variant="primary" className="min-h-11 flex-1 py-2 text-[15px]" onClick={async () => {
          const ok = await enableReminders();
          await saveSettings({ remind: ok ? true : settings.remind, remindAsked: true });
          if (ok) { void scheduleReminder(); toast(`Reminders on at ${time(at)}`); } else setPerm('denied');
        }}>Turn on</Button>
        <LinkButton className="px-2 text-[15px]" onClick={() => void saveSettings({ remindAsked: true })}>Not now</LinkButton>
      </div>
    </div>
  );
}
