import { lazy, Suspense, useState } from 'react';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { rec, start, pause, resume, elapsed, stepInfo, currentPace, type Session } from '../lib/recorder';
import { calories, strideM } from '../lib/metrics';
import { fmtDist, fmtInt, fmtP, fmtPace, fmtTime, unitL, unitWord } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { openLocationSettings } from '../lib/tracker';
import { isAndroidApp, isIOS, isIOSApp, isNative } from '../lib/platform';
import { TopBar } from '../components/TopBar';
import { PendingBanner } from '../components/PendingBanner';
import { Button, LinkButton, Pill } from '../components/ui';
import type { ActivityType } from '../types';

const RouteMap = lazy(() => import('../components/RouteMap'));
const Stat = ({ v, l }: { v: string; l: string }) => <div><span className="num mid block">{v}</span><span className="text-sm text-muted">{l}</span></div>;
type Tone = 'ok' | 'warn' | 'bad';

function geoPill(s: Session): [Tone, string] | null {
  if (s.indoor) return null;
  const acc = s.here ? ` ±${s.here[2] >= 1000 ? `${(s.here[2] / 1000).toFixed(1)} km` : `${s.here[2]} m`}` : '';
  switch (s.geo) {
    case 'ok': return ['ok', `GPS good${acc}`];
    case 'fair': return ['ok', `GPS fair${acc}`];
    case 'weak': return ['warn', `GPS weak${acc}`];
    case 'coarse': return ['bad', `Approximate location${acc}`];
    case 'blocked': return ['bad', 'Location off'];
    default: return ['warn', 'Finding GPS'];
  }
}
function stepPill(s: Session): [Tone, string] {
  const src = stepInfo(s).src;
  if (src === 'pedometer') return ['ok', 'Phone pedometer'];
  if (src === 'sensor') return ['ok', 'Step sensor on'];
  if (isIOSApp && s.hw === 'denied') return ['bad', 'Motion & Fitness off'];
  if (!isIOSApp && s.motion === 'denied') return ['bad', 'Motion access off'];
  if (s.indoor && s.motion === 'none') return ['bad', 'No step sensor'];
  return ['warn', s.motion === 'on' ? 'Counting steps…' : 'Steps estimated'];
}
function helpText(s: Session): string | null {
  // iPhone app: steps come from the iPhone's step counter; the browser motion sensor doesn't matter here
  if (isIOSApp) {
    if (s.hw === 'denied') return 'Motion & Fitness is off, so steps can only be estimated from GPS. Open iPhone Settings › Privacy & Security › Motion & Fitness, turn on Fitness Tracking, then turn on Lakad in the list below it. Then close and reopen Lakad.';
  } else
  if (s.motion === 'denied') return isIOS
    ? 'Motion access was declined, so steps can only be estimated from GPS. Close Lakad completely, open it again, start a recording and tap Allow when your iPhone asks about Motion & Orientation.'
    : 'Motion access is off, so steps can only be estimated from GPS. Allow motion sensors for this site or app in your phone settings.';
  if (s.indoor && s.motion === 'none' && s.hw !== 'on' && s.hw !== 'pending') return 'This device has no step sensor available here, so indoor distance can’t be measured. Enter the treadmill’s distance when you finish.';
  if (s.hw === 'denied') return 'Physical activity permission is off, so the phone pedometer can’t be used. Allow it in Android Settings › Apps › Lakad › Permissions for the most accurate steps.';
  if (s.indoor) return null;
  if (s.geo === 'coarse' && isIOSApp) return 'Precise Location is off, so Lakad only gets a rough area. Open iPhone Settings › Lakad › Location, turn on Precise Location and choose While Using the App.';
  if (s.geo === 'coarse') return isIOS
    ? 'Precise Location is off, so Lakad only gets a rough area. On your iPhone open Settings › Privacy & Security › Location Services › Safari Websites, then turn on Precise Location and choose While Using the App. Then reload Lakad.'
    : 'Lakad is only getting your approximate location. Open your phone’s location settings for this browser or app and turn on Precise or Use precise location.';
  if (s.geo === 'weak') return 'GPS signal is too rough to record yet. Step outside, away from tall buildings and roofs, and wait a few seconds. It usually improves within a minute.';
  return null;
}

export function Record() {
  const { session: s, pending } = useStore(rec);
  const { settings } = useStore(data);
  const [type, setType] = useState<ActivityType>('walk');
  const [indoor, setIndoor] = useState(false);
  const [starting, setStarting] = useState(false);
  const u = settings.units;

  if (!s) return (
    <>
      <TopBar />
      <PendingBanner />
      <h2 className="num big m-0 mb-1">Ready?</h2>
      <p className="m-0 text-muted">{isNative ? 'Pick what you are doing, then start. Recording continues with the screen off.' : 'Pick what you are doing, then start. Keep this screen open while you move.'}</p>
      <div className="mt-5 mb-3 grid grid-cols-2 gap-3" role="group" aria-label="Activity type">
        {(['walk', 'run'] as const).map(t => (
          <button key={t} aria-pressed={type === t} onClick={() => setType(t)}
            className={`rounded-[20px] border-2 px-4 py-[22px] text-left ${type === t ? 'border-cobalt bg-cobalt-soft' : 'border-line bg-surface'}`}>
            <span className="num block text-[30px]">{t === 'walk' ? 'Walk' : 'Run'}</span>
            <span className="text-sm text-muted">{t === 'walk' ? 'Steps, distance, route' : `Pace and splits per ${unitL(u)}`}</span>
          </button>
        ))}
      </div>
      <label className="mb-5 flex items-start gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-cobalt" checked={indoor} onChange={e => setIndoor(e.target.checked)} />
        <span>Indoors or treadmill<br /><span className="text-sm text-muted">No GPS. Distance comes from your steps × your step length ({strideM(type, settings).toFixed(2)} m).</span></span>
      </label>
      <Button variant="primary" className="h-[76px] w-full text-[22px] font-extrabold [font-stretch:120%]" disabled={!!pending || starting}
        onClick={async () => { setStarting(true); try { await start(type, indoor); } finally { setStarting(false); } }}>
        {starting ? 'Starting…' : `Start ${indoor ? 'indoor ' : ''}${type}`}
      </Button>
      <p className="mt-3 text-sm text-muted">
        {pending ? 'Resume, save or discard your unfinished activity first.'
          : `Auto-pause is ${settings.autoPause ? 'on' : 'off'} and ${unitWord(u, 1)} alerts are ${settings.voice ? 'on' : 'off'}. Change these in settings.`}
      </p>
      {isAndroidApp && <p className="mt-2 text-sm text-muted">If recording stops with the screen off, open Android Settings, find Lakad, and set battery usage to Unrestricted.</p>}
      {!isNative && <p className="mt-2 text-sm text-muted">{isIOS ? 'On iPhone, websites can’t track with the screen locked. If it locks, Lakad fills the gap with a straight line when you return. For true screen-off tracking, use the Lakad iPhone app.' : 'Browsers can’t track with the screen locked. If it locks, Lakad fills the gap with a straight line when you return. For true screen-off tracking, use the Lakad Android app.'}</p>}
      <Button className="mt-5 w-full" onClick={() => openDialog({ kind: 'form' })}>Add a past activity instead</Button>
    </>
  );

  const sec = elapsed(s), si = stepInfo(s);
  const kc = calories({ type: s.type, duration: sec, distance: s.distance, elevGain: s.elevGain }, settings);
  const gp = geoPill(s), sp = stepPill(s), help = helpText(s);

  return (
    <>
      <TopBar />
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={s.paused ? 'warn' : 'bad'} live={!s.paused}>{s.paused ? (s.auto ? 'Auto-paused' : 'Paused') : `Recording ${s.indoor ? 'indoor ' : ''}${s.type}`}</Pill>
        {gp && <Pill tone={gp[0]}>{gp[1]}</Pill>}
        <Pill tone={sp[0]}>{sp[1]}</Pill>
      </div>
      {help && <p className="mt-3 mb-0 rounded-2xl bg-mango-soft px-4 py-3 text-sm">{help}</p>}
      {s.geo === 'blocked' && (
        <p className="mt-3 text-sm text-danger">Location permission is off, so distance and route can't be recorded. {isNative && <LinkButton onClick={() => void openLocationSettings()}>Open settings</LinkButton>}</p>
      )}
      <div className="mt-[18px] mb-1"><div className="num huge" aria-live="off">{fmtDist(s.distance, u)}</div><div className="text-muted">{unitL(u)}{s.indoor ? ' from steps' : ''}</div></div>
      <div className="mt-[18px] mb-2.5 grid grid-cols-3 gap-2.5">
        <Stat v={fmtTime(sec)} l="moving time" />
        <Stat v={s.indoor ? fmtPace(sec, s.distance, u) : fmtP(currentPace(s))} l={s.indoor ? `average /${unitL(u)}` : `current /${unitL(u)}`} />
        <Stat v={s.indoor ? (si.steps && sec ? String(Math.round(si.steps / (sec / 60))) : '–') : fmtPace(sec, s.distance, u)} l={s.indoor ? 'steps/min' : `average /${unitL(u)}`} />
      </div>
      <div className="mb-[18px] grid grid-cols-3 gap-2.5">
        <Stat v={fmtInt(si.steps)} l={si.src === 'estimate' && !s.indoor ? 'steps (est.)' : 'steps'} />
        <Stat v={s.elevGain == null ? '–' : fmtInt(s.elevGain)} l="m climbed" />
        <Stat v={kc == null ? '–' : fmtInt(kc)} l="kcal" />
      </div>
      {s.indoor ? null : s.points.length > 0 || (s.here && s.geo !== 'coarse') ? (
        <Suspense fallback={<div className="aspect-[4/3] rounded-[18px] bg-cobalt-soft" />}>
          <RouteMap route={s.points} here={s.here} follow className="aspect-[4/3]" />
        </Suspense>
      ) : (
        <div className="grid aspect-[4/3] place-items-center rounded-[18px] border border-line bg-surface p-5 text-center text-sm text-muted">
          {s.geo === 'blocked' ? 'No route without location. Time and steps still record.'
            : s.geo === 'coarse' ? 'Waiting for a precise location. See the note above.'
            : 'Finding your location… This can take up to a minute the first time.'}
        </div>
      )}
      <div className="mt-[18px] grid grid-cols-2 gap-3">
        <Button variant={s.paused ? 'primary' : 'ghost'} onClick={() => (s.paused ? void resume() : pause())}>{s.paused ? 'Resume' : 'Pause'}</Button>
        <Button variant="mango" onClick={() => { pause(); openDialog({ kind: 'finish' }); }}>Finish</Button>
      </div>
      {!isNative && <p className="mt-3 text-sm text-muted">Keep this screen on for the most accurate route. If it locks, Lakad bridges the gap when you come back.</p>}
    </>
  );
}
