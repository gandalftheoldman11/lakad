import { LocalNotifications } from '@capacitor/local-notifications';
import { data } from './data';
import { isNative } from './platform';
import { stepsByDay, streakInfo } from './metrics';
import { fmtInt, sod } from './format';

/*
 * Evening streak reminder (in the Lakad app; websites can't schedule notifications reliably).
 * Whenever your steps, goal or reminder setting change, today's reminder is rescheduled with fresh
 * numbers. If you've already reached today's goal, there is no reminder today; the next one is tomorrow.
 */
const ID = 7101, CHANNEL = 'lakad-streak';

export function reminderText(now = Date.now()) {
  const { acts, days, settings } = data.get();
  const info = streakInfo(stepsByDay(acts, days), settings.goal, now);
  const left = fmtInt(info.todayLeft), n = info.days;
  if (n > 0) return {
    title: `${left} steps to keep your ${n}-day streak`,
    body: info.freezes > 0
      ? `You're at ${fmtInt(info.todaySteps)} of ${fmtInt(settings.goal)} today. A streak freeze covers today if you miss it, but why not keep it going?`
      : `You're at ${fmtInt(info.todaySteps)} of ${fmtInt(settings.goal)} today, and you're out of freezes. A short walk keeps your streak alive.`,
    met: info.todayMet
  };
  return { title: `${left} steps to reach today's goal`, body: 'Reach your step goal today to start a new streak.', met: info.todayMet };
}

/** when the next reminder should fire, or null if none (setting off, or already done today and asked for today only) */
export function nextReminderAt(now = Date.now()): { at: number; today: boolean } | null {
  const s = data.get().settings;
  if (!s.remind) return null;
  const [hh, mm] = (s.remindAt || '19:00').split(':').map(Number);
  const todayAt = new Date(sod(now)); todayAt.setHours(hh || 0, mm || 0, 0, 0);
  const { met } = reminderText(now);
  if (!met && todayAt.getTime() > now + 60000) return { at: todayAt.getTime(), today: true };
  const tomorrow = new Date(todayAt); tomorrow.setDate(tomorrow.getDate() + 1);
  return { at: tomorrow.getTime(), today: false };
}

let timer: ReturnType<typeof setTimeout> | undefined, last = '';
export async function scheduleReminder() {
  if (!isNative) return;
  try {
    const next = nextReminderAt();
    // tomorrow's reminder: it can't know tomorrow's steps yet, but it can name the streak you'll be protecting
    const n = streakInfo(stepsByDay(data.get().acts, data.get().days), data.get().settings.goal).days;
    const msg = next?.today ? reminderText()
      : n > 0 ? { title: `Keep your ${n}-day streak going`, body: 'A walk today keeps it alive. Every step counts toward your goal.' }
      : { title: 'Time for a walk?', body: 'Every step today counts toward your goal. Reach it to start a new streak.' };
    const key = next ? `${next.at}|${msg.title}` : 'off';
    if (key === last) return;
    last = key;
    await LocalNotifications.cancel({ notifications: [{ id: ID }] }).catch(() => {});
    if (!next) return;
    await LocalNotifications.createChannel?.({ id: CHANNEL, name: 'Streak reminders', description: 'A daily nudge to keep your step streak', importance: 3 }).catch(() => {});
    await LocalNotifications.schedule({ notifications: [{ id: ID, title: msg.title, body: msg.body, schedule: { at: new Date(next.at), allowWhileIdle: true }, channelId: CHANNEL }] });
  } catch { /* notifications not allowed: nothing to schedule */ }
}

/** turn on: ask permission first; returns false if the phone said no */
export async function enableReminders() {
  if (!isNative) return false;
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch { return false; }
}

export function initReminders() {
  if (!isNative) return;
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => void scheduleReminder(), 800); };
  kick();
  data.subscribe(kick);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { last = ''; kick(); } });
}
