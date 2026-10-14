import { lazy, Suspense, useState } from 'react';
import { AnimatedNumber } from '../components/AnimatedNumber';
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
import { Button, LinkButton, Pill, Segmented } from '../components/ui';
import { IconPause, IconPlay, IconRun, IconStop, IconWalk } from '../components/icons';
import type { ActivityType } from '../types';

const RouteMap = lazy(() => import('../components/RouteMap'));
const Stat = ({ v, l }: { v: React.ReactNode; l: string }) => <div className="min-w-0 px-3 py-3"><span className="num mid block truncate">{v}</span><span className="label">{l}</span></div>;
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
      <TopBar title="Record" />
      <PendingBanner />
      <div className="flex justify-center">
        <Segmented value={type} onChange={setType} label="Activity type"
          options={[['walk', <><IconWalk size={18} color="currentColor" />Walk</>], ['run', <><IconRun size={18} color="currentColor" />Run</>]]} />
      </div>

      <div className="relative mx-auto mt-8 grid aspect-square w-[min(72vw,280px)] place-items-center">
        {/* concentric route rings around the start button */}
        <span aria-hidden="true" className="absolute inset-0 rounded-full border border-dashed border-line" />
        <span aria-hidden="true" className="absolute inset-[12%] rounded-full border border-line" />
        <button disabled={!!pending || starting} onClick={async () => { setStarting(true); try { await start(type, indoor); } finally { setStarting(false); } }}
          className="relative grid h-[62%] w-[62%] place-items-center rounded-full bg-cobalt text-on-cobalt shadow-[0_24px_50px_-18px_var(--cobalt),inset_0_2px_0_rgba(255,255,255,.18)] transition-transform active:scale-95 disabled:opacity-50">
          <span className="flex flex-col items-center gap-1">
            <IconPlay size={30} />
            <span className="text-[20px] font-extrabold tracking-[-0.01em] [font-stretch:115%]">{starting ? 'Starting…' : 'Start'}</span>
          </span>
          <span aria-hidden="true" className="absolute right-[6%] bottom-[14%] h-4 w-4 rounded-full bg-mango ring-4 ring-bg" />
        </button>
      </div>
      <p className="mt-5 mb-0 text-center text-[15px] text-muted">
        {pending ? 'Resume, save or discard your unfinished activity first.'
          : `${indoor ? (type === 'run' ? 'Indoor run' : 'Indoor walk') : (type === 'run' ? 'Run' : 'Walk')}. ${isNative ? 'Recording continues with the screen off.' : 'Keep this screen open while you move.'}`}
      </p>

      <label className="lift mt-7 flex items-center justify-between gap-4 rounded-[22px] px-4 py-3.5">
        <span><span className="block text-[15px] font-semibold">Indoors or treadmill</span><span className="block text-[13px] text-muted">No GPS. Distance from your steps × {strideM(type, settings).toFixed(2)} m step length.</span></span>
        <input type="checkbox" role="switch" checked={indoor} onChange={e => setIndoor(e.target.checked)} />
      </label>

      <div className="mt-6 space-y-2 text-[13px] text-muted">
        {!pending && <p className="m-0">Auto-pause is {settings.autoPause ? 'on' : 'off'} and {unitWord(u, 1)} alerts are {settings.voice ? 'on' : 'off'}. Change these in settings.</p>}
        {isAndroidApp && <p className="m-0">If recording stops with the screen off, open Android Settings, find Lakad, and set battery usage to Unrestricted.</p>}
        {!isNative && <p className="m-0">{isIOS ? 'On iPhone, websites can’t track with the screen locked. If it locks, Lakad fills the gap with a straight line when you return. For true screen-off tracking, use the Lakad iPhone app.' : 'Browsers can’t track with the screen locked. If it locks, Lakad fills the gap with a straight line when you return. For true screen-off tracking, use the Lakad Android app.'}</p>}
      </div>
      <Button className="mt-6 w-full" onClick={() => openDialog({ kind: 'form' })}>Add a past activity instead</Button>
    </>
  );

  const sec = elapsed(s), si = stepInfo(s);
  const kc = calories({ type: s.type, duration: sec, distance: s.distance, elevGain: s.elevGain }, settings);
  const gp = geoPill(s), sp = stepPill(s), help = helpText(s);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill tone={s.paused ? 'warn' : 'bad'} live={!s.paused}>{s.paused ? (s.auto ? 'Auto-paused' : 'Paused') : `Recording ${s.indoor ? 'indoor ' : ''}${s.type}`}</Pill>
        {gp && <Pill tone={gp[0]}>{gp[1]}</Pill>}
        <Pill tone={sp[0]}>{sp[1]}</Pill>
      </div>
      {help && <p className="mt-0 mb-4 rounded-[18px] bg-mango-soft px-4 py-3 text-[14px]">{help}</p>}
      {s.geo === 'blocked' && (
        <p className="mt-0 mb-4 text-sm text-danger">Location permission is off, so distance and route can't be recorded. {isNative && <LinkButton onClick={() => void openLocationSettings()}>Open settings</LinkButton>}</p>
      )}

      <div className="flex items-baseline gap-2">
        <span className="num text-[clamp(72px,24vw,128px)]" aria-live="off"><AnimatedNumber id="live-distance" value={s.distance} format={n => fmtDist(n, u)} duration={800} /></span>
        <span className="num text-[28px] text-muted">{unitL(u)}</span>
      </div>
      <p className="m-0 mt-1 text-[14px] text-muted">{s.indoor ? 'Distance from your steps' : `${s.type === 'run' ? 'Run' : 'Walk'} started at ${new Date(s.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}</p>

      <div className="lift mt-5 overflow-hidden rounded-[22px]">
        <div className="hairline-x grid grid-cols-3">
          <Stat v={fmtTime(sec)} l="moving time" />
          <Stat v={s.indoor ? fmtPace(sec, s.distance, u) : fmtP(currentPace(s))} l={s.indoor ? `avg /${unitL(u)}` : `now /${unitL(u)}`} />
          <Stat v={s.indoor ? (si.steps && sec ? String(Math.round(si.steps / (sec / 60))) : '–') : fmtPace(sec, s.distance, u)} l={s.indoor ? 'steps/min' : `avg /${unitL(u)}`} />
        </div>
        <div className="hairline-x grid grid-cols-3 border-t border-line">
          <Stat v={<AnimatedNumber value={si.steps} format={fmtInt} duration={700} />} l={si.src === 'estimate' && !s.indoor ? 'steps (est.)' : 'steps'} />
          <Stat v={s.elevGain == null ? '–' : <AnimatedNumber value={s.elevGain} format={fmtInt} duration={700} />} l="m climbed" />
          <Stat v={kc == null ? '–' : <AnimatedNumber value={kc} format={fmtInt} duration={700} />} l="kcal" />
        </div>
      </div>

      {s.indoor ? null : s.points.length > 0 || (s.here && s.geo !== 'coarse') ? (
        <Suspense fallback={<div className="mt-4 aspect-[4/3] rounded-[22px] bg-cobalt-soft" />}>
          <RouteMap route={s.points} here={s.here} follow className="mt-4 aspect-[4/3] rounded-[22px]" />
        </Suspense>
      ) : (
        <div className="lift mt-4 grid aspect-[4/3] place-items-center rounded-[22px] p-6 text-center text-[14px] text-muted">
          {s.geo === 'blocked' ? 'No route without location. Time and steps still record.'
            : s.geo === 'coarse' ? 'Waiting for a precise location. See the note above.'
            : 'Finding your location… This can take up to a minute the first time.'}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-5">
        <button onClick={() => (s.paused ? void resume() : pause())} aria-label={s.paused ? 'Resume' : 'Pause'}
          className={`grid h-[76px] w-[76px] place-items-center rounded-full transition-transform active:scale-95 ${s.paused ? 'bg-cobalt text-on-cobalt shadow-[0_16px_34px_-14px_var(--cobalt)]' : 'lift text-ink'}`}>
          {s.paused ? <IconPlay size={30} /> : <IconPause size={28} />}
        </button>
        <button onClick={() => { pause(); openDialog({ kind: 'finish' }); }}
          className="flex h-[76px] items-center gap-2.5 rounded-full bg-mango px-8 text-[18px] font-extrabold text-[#2A1B00] shadow-[0_16px_34px_-16px_var(--mango),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform active:scale-95">
          <IconStop size={18} />Finish
        </button>
      </div>
      {!isNative && <p className="mt-5 text-center text-[13px] text-muted">Keep this screen on for the most accurate route.</p>}
    </>
  );
}
