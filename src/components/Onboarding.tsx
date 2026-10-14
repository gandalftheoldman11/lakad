import { useState } from 'react';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { LocalNotifications } from '@capacitor/local-notifications';
import { saveSettings } from '../lib/data';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { isAndroidApp, isIOSApp, isNative } from '../lib/platform';
import { syncPhoneSteps } from '../lib/phoneSteps';
import { strideFromHeight } from '../lib/metrics';
import type { Units } from '../types';
import { Button, ErrorText, Field, GoalPath, Segmented } from './ui';
import { IconWalk, Logo } from './icons';

const GOALS = [5000, 8000, 10000, 12000];

/** First-time setup: goal, body, and why Lakad asks for each permission. Shown once. */
export function Onboarding() {
  const { settings } = useStore(data);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(settings.goal || 8000);
  const [units, setUnits] = useState<Units>(settings.units);
  const [height, setHeight] = useState(settings.height ? String(settings.height) : '');
  const [weight, setWeight] = useState(settings.weight ? String(settings.weight) : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function nextFromBody() {
    const h = parseFloat(height), w = parseFloat(weight);
    if (height && !(h >= 100 && h <= 230)) return setErr('Height should be between 100 and 230 cm.');
    if (weight && !(w >= 25 && w <= 300)) return setErr('Weight should be between 25 and 300 kg.');
    setErr(''); setStep(2);
  }
  async function finish() {
    setBusy(true);
    try {
      // Ask now, with context, instead of in the middle of a first walk
      if (isNative) {
        try { const p = await CapacitorPedometer.checkPermissions(); if (p.activityRecognition !== 'granted') await CapacitorPedometer.requestPermissions(); } catch { /* not available */ }
        if (isAndroidApp) { try { await LocalNotifications.requestPermissions(); } catch { /* older Android */ } }
      }
      await saveSettings({ goal, units, height: parseFloat(height) || 0, weight: parseFloat(weight) || 0, onboarded: true });
      if (isIOSApp) void syncPhoneSteps(true);
    } finally { setBusy(false); }
  }

  const perms: [string, string][] = [
    ['Location', isNative ? 'Measures distance and draws your route, only while you record. Choose “While using the app” and keep Precise Location on.' : 'Measures distance and draws your route, only while you record.'],
    [isIOSApp ? 'Motion & Fitness' : isAndroidApp ? 'Physical activity' : 'Motion sensors', isIOSApp ? 'Counts your steps with the iPhone’s own step counter, and fills in your daily steps automatically.' : 'Counts your steps accurately, even with the screen off.'],
    ...(isNative ? [['Notifications', isIOSApp ? 'Shows your live distance and steps on the lock screen while recording.' : 'Keeps recording with the screen off and shows live stats on the lock screen.'] as [string, string]] : [])
  ];

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-auto flex min-h-full max-w-[480px] flex-col px-6 pt-6 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[21px] font-black tracking-[-0.02em] [font-stretch:125%]"><Logo />Lakad</div>
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map(i => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-cobalt' : i < step ? 'w-1.5 bg-cobalt' : 'w-1.5 bg-bar-soft'}`} />)}
          </div>
        </div>

        {step === 0 && (
          <div className="flex flex-1 flex-col">
            <h1 className="mt-10 mb-3 text-[clamp(34px,10vw,44px)] leading-[1.02] font-black tracking-[-0.03em] [font-stretch:120%]">Every walk counts.</h1>
            <p className="m-0 text-[16px] text-muted">Track your walks and runs, steps and progress. First, a daily step goal.</p>
            <div className="mt-8 -mx-1"><GoalPath value={goal * 0.62} max={goal} label="Example goal path" /></div>
            <div className="mt-6 grid grid-cols-4 gap-2" role="group" aria-label="Daily step goal">
              {GOALS.map(g => (
                <button key={g} aria-pressed={goal === g} onClick={() => setGoal(g)}
                  className={`rounded-[16px] px-1 py-3.5 text-center transition-colors ${goal === g ? 'bg-cobalt text-on-cobalt shadow-[0_10px_24px_-12px_var(--cobalt)]' : 'lift text-ink'}`}>
                  <span className="num block text-[18px]">{g / 1000}k</span><span className={`text-[11px] ${goal === g ? 'opacity-80' : 'text-muted'}`}>steps</span>
                </button>
              ))}
            </div>
            <p className="m-0 mt-3 text-[13px] text-muted">8,000 a day is a good everyday target. You can change it any time.</p>
            <div className="mt-6 flex items-center justify-between"><span className="text-[15px] font-semibold">Distance in</span>
              <Segmented value={units} onChange={setUnits} label="Distance units" options={[['km', 'Kilometers'], ['mi', 'Miles']]} /></div>
            <div className="flex-1" />
            <Button variant="primary" className="mt-8 w-full" onClick={() => setStep(1)}>Continue</Button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <h1 className="mt-10 mb-3 text-[clamp(30px,9vw,40px)] leading-[1.05] font-black tracking-[-0.03em] [font-stretch:120%]">A little about you</h1>
            <p className="m-0 text-[16px] text-muted">Your height sets your step length, and your weight sets calories. Both stay private on your phone.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Field label="Height (cm)" id="oH"><input id="oH" type="number" inputMode="numeric" min="100" max="230" placeholder="165" value={height} onChange={e => setHeight(e.target.value)} /></Field>
              <Field label="Weight (kg)" id="oW"><input id="oW" type="number" inputMode="decimal" min="25" max="300" step="0.1" placeholder="65" value={weight} onChange={e => setWeight(e.target.value)} /></Field>
            </div>
            {parseFloat(height) >= 100 && parseFloat(height) <= 230 && (
              <p className="lift m-0 mt-4 flex items-center gap-3 rounded-[18px] px-4 py-3 text-[14px]">
                <IconWalk size={22} />
                <span>Your starting step length: <strong className="tabular-nums">{strideFromHeight('walk', { ...settings, height: parseFloat(height) }).toFixed(2)} m</strong> walking. Lakad fine-tunes it from your GPS walks.</span>
              </p>
            )}
            <ErrorText>{err}</ErrorText>
            <div className="flex-1" />
            <Button variant="primary" className="mt-6 w-full" onClick={nextFromBody}>Continue</Button>
            <button className="mt-3 py-2 text-[15px] font-semibold text-muted" onClick={() => { setHeight(''); setWeight(''); setErr(''); setStep(2); }}>Skip for now</button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <h1 className="mt-10 mb-3 text-[clamp(30px,9vw,40px)] leading-[1.05] font-black tracking-[-0.03em] [font-stretch:120%]">What Lakad asks for</h1>
            <p className="m-0 text-[16px] text-muted">{isNative ? 'Your phone will ask for these. Here’s what each one does.' : 'Your browser may ask for these. Here’s what each one does.'}</p>
            <ul className="lift m-0 mt-6 list-none divide-y divide-line overflow-hidden rounded-[22px] p-0">
              {perms.map(([t, d]) => (
                <li key={t} className="px-4 py-3.5"><strong className="block text-[15px] font-semibold">{t}</strong><span className="text-[14px] text-muted">{d}</span></li>
              ))}
            </ul>
            <p className="m-0 mt-4 text-[13px] text-muted">Your walks stay on your phone unless you sign in and post them.</p>
            <div className="flex-1" />
            <Button variant="primary" className="mt-6 w-full" disabled={busy} onClick={finish}>{busy ? 'Setting up…' : 'Get started'}</Button>
            <button className="mt-3 py-2 text-[15px] font-semibold text-muted" onClick={() => setStep(1)}>Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
