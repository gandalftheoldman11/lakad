import { lazy, Suspense, useState } from 'react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { rec, start, pause, resume, elapsed, stepInfo, currentPace, prepareStart, type Session } from '../lib/recorder';
import { calories, strideM } from '../lib/metrics';
import { fmtDist, fmtInt, fmtP, fmtPace, fmtTime, unitL, unitWord } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { openLocationSettings } from '../lib/tracker';
import { isAndroidApp, isIOS, isIOSApp, isNative } from '../lib/platform';
import { TopBar } from '../components/TopBar';
import { PendingBanner } from '../components/PendingBanner';
import { LinkButton, Pill, Segmented } from '../components/ui';
import { IconPause, IconPlay, IconRun, IconStop, IconWalk } from '../components/icons';
import type { ActivityType } from '../types';

const RouteMap = lazy(() => import('../components/RouteMap'));
const Stat = ({ v, l }: { v: React.ReactNode; l: string }) => <div className="min-w-0 px-3 py-[clamp(6px,1.4dvh,12px)]"><span className="num block truncate text-[clamp(17px,2.8dvh,22px)]">{v}</span><span className="label block truncate">{l}</span></div>;
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
  const { session: s, pending, split } = useStore(rec);
  const { settings } = useStore(data);
  const [type, setType] = useState<ActivityType>('walk');
  const [indoor, setIndoor] = useState(false);
  const [starting, setStarting] = useState(false);
  const onStart = () => {
    void prepareStart();                       // permissions must be asked inside the tap itself
    setStarting(true);
    void start(type, indoor).finally(() => setStarting(false));
  };
  const u = settings.units;

  if (!s) return (
    <div className="fit-screen">
      <TopBar title="Record" compact action={<LinkButton className="text-[14px]" onClick={() => openDialog({ kind: 'form' })}>Add past activity</LinkButton>} />
      <PendingBanner />
      <div className="flex justify-center">
        <Segmented value={type} onChange={setType} label="Activity type"
          options={[['walk', <><IconWalk size={18} color="currentColor" />Walk</>], ['run', <><IconRun size={18} color="currentColor" />Run</>]]} />
      </div>

      {/* The start button grows or shrinks to the space this phone has */}
      <div className="size-box my-[clamp(8px,2dvh,24px)] grid min-h-[120px] flex-1 place-items-center">
        <div className="relative grid aspect-square w-[min(100cqh,78cqw,300px)] place-items-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full border border-dashed border-line" />
          <span aria-hidden="true" className="absolute inset-[12%] rounded-full border border-line" />
          <button disabled={!!pending || starting} onClick={onStart}
            className="relative grid h-[62%] w-[62%] place-items-center rounded-full bg-cobalt text-on-cobalt shadow-[0_24px_50px_-18px_var(--cobalt),inset_0_2px_0_rgba(255,255,255,.18)] transition-transform active:scale-95 disabled:opacity-50">
            <span className="flex flex-col items-center gap-1">
              <IconPlay size={30} />
              <span className="text-[clamp(16px,2.6dvh,20px)] font-extrabold tracking-[-0.01em] [font-stretch:115%]">{starting ? 'Starting…' : 'Start'}</span>
            </span>
            <span aria-hidden="true" className="absolute right-[4%] bottom-[12%] aspect-square w-[13%] rounded-full bg-mango ring-[3px] ring-bg" />
          </button>
        </div>
      </div>

      <p className="m-0 text-center text-[14px] text-muted">
        {pending ? 'Resume, save or discard your unfinished activity first.'
          : `${indoor ? (type === 'run' ? 'Indoor run' : 'Indoor walk') : (type === 'run' ? 'Run' : 'Walk')}. ${isNative ? 'Recording continues with the screen off.' : 'Keep this screen open while you move.'}`}
      </p>

      {!pending && <>
      <label className="lift mt-[clamp(10px,2dvh,20px)] flex shrink-0 items-center justify-between gap-4 rounded-[20px] px-4 py-3">
        <span className="min-w-0"><span className="block text-[15px] font-semibold">Indoors or treadmill</span><span className="block truncate text-[13px] text-muted">No GPS. Distance from steps × {strideM(type, settings).toFixed(2)} m.</span></span>
        <input type="checkbox" role="switch" checked={indoor} onChange={e => setIndoor(e.target.checked)} />
      </label>
      <p className="m-0 mt-2.5 shrink-0 text-center text-[12px] text-muted">
        {isAndroidApp ? 'Tip: set Lakad’s battery use to Unrestricted for screen-off tracking.'
          : !isNative ? (isIOS ? 'Screen-off tracking needs the Lakad iPhone app.' : 'Screen-off tracking needs the Lakad Android app.')
          : `Auto-pause ${settings.autoPause ? 'on' : 'off'}, ${unitWord(u, 1)} alerts ${settings.voice ? 'on' : 'off'}.`}
      </p>
      </>}
    </div>
  );

  const sec = elapsed(s), si = stepInfo(s);
  const kc = calories({ type: s.type, duration: sec, distance: s.distance, elevGain: s.elevGain }, settings);
  const gp = geoPill(s), sp = stepPill(s), help = helpText(s);

  return (
    <div className="fit-screen">
      <div className="no-scrollbar -mx-5 flex shrink-0 gap-2 overflow-x-auto px-5 pb-1">
        <Pill tone={s.paused ? 'warn' : 'bad'} live={!s.paused}>{s.paused ? (s.auto ? 'Auto-paused' : 'Paused') : `Recording ${s.indoor ? 'indoor ' : ''}${s.type}`}</Pill>
        {gp && <Pill tone={gp[0]}>{gp[1]}</Pill>}
        <Pill tone={sp[0]}>{sp[1]}</Pill>
      </div>
      {help && <p className="m-0 mt-2 shrink-0 rounded-[16px] bg-mango-soft px-3.5 py-2.5 text-[13px] leading-snug">{help}</p>}
      {s.geo === 'blocked' && (
        <p className="m-0 mt-2 shrink-0 text-[13px] text-danger">Location permission is off, so distance and route can't be recorded. {isNative && <LinkButton onClick={() => void openLocationSettings()}>Open settings</LinkButton>}</p>
      )}

      <div className="mt-[clamp(6px,1.5dvh,16px)] flex shrink-0 items-baseline gap-2">
        <span className="num text-[clamp(52px,min(24vw,11dvh),128px)]" aria-live="off"><AnimatedNumber id="live-distance" value={s.distance} format={n => fmtDist(n, u)} duration={800} /></span>
        <span className="num text-[clamp(20px,3.2dvh,28px)] text-muted">{unitL(u)}</span>
      </div>
      <p className="m-0 mt-1 shrink-0 text-[13px] text-muted">{s.indoor ? 'Distance from your steps' : `${s.type === 'run' ? 'Run' : 'Walk'} started at ${new Date(s.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}</p>

      <div className="lift mt-[clamp(8px,1.8dvh,18px)] shrink-0 overflow-hidden rounded-[20px]">
        <div className="hairline-x grid grid-cols-3">
          <Stat v={fmtTime(sec)} l="time" />
          <Stat v={s.indoor ? fmtPace(sec, s.distance, u) : fmtP(currentPace(s))} l={s.indoor ? `avg /${unitL(u)}` : `now /${unitL(u)}`} />
          <Stat v={s.indoor ? (si.steps && sec ? String(Math.round(si.steps / (sec / 60))) : '–') : fmtPace(sec, s.distance, u)} l={s.indoor ? 'steps/min' : `avg /${unitL(u)}`} />
        </div>
        <div className="hairline-x grid grid-cols-3 border-t border-line">
          <Stat v={<AnimatedNumber value={si.steps} format={fmtInt} duration={700} />} l={si.src === 'estimate' && !s.indoor ? 'steps (est.)' : 'steps'} />
          <Stat v={s.elevGain == null ? '–' : <AnimatedNumber value={s.elevGain} format={fmtInt} duration={700} />} l="m climbed" />
          <Stat v={kc == null ? '–' : <AnimatedNumber value={kc} format={fmtInt} duration={700} />} l="kcal" />
        </div>
      </div>

      {/* The map takes whatever height is left on this phone */}
      <div className="relative mt-[clamp(8px,1.8dvh,16px)] min-h-0 flex-1">
        {split && Date.now() - split.at < 4500 && (
          <div key={split.at} className="split-card lift absolute inset-x-3 top-3 z-[600] flex items-center gap-3 rounded-[18px] px-4 py-3" role="status">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mango text-[15px] font-black text-[#2A1B00] [font-stretch:115%]">{split.n}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{split.unit === 'mi' ? 'Mile' : 'Kilometer'} {split.n}</span>
              <span className="block text-[13px] text-muted">Split time</span>
            </span>
            <span className="text-right"><span className="num block text-[22px]">{fmtTime(split.sec)}</span><span className="label">/{split.unit}</span></span>
          </div>
        )}
        {s.indoor ? (
          <div className="grid h-full place-items-center rounded-[20px] border border-dashed border-line px-6 text-center text-[13px] text-muted">Indoor mode: no map. Distance comes from your steps.</div>
        ) : s.points.length > 0 || (s.here && s.geo !== 'coarse') ? (
          <Suspense fallback={<div className="h-full rounded-[20px] bg-cobalt-soft" />}>
            <RouteMap route={s.points} here={s.here} follow className="h-full rounded-[20px]" />
          </Suspense>
        ) : (
          <div className="lift grid h-full place-items-center rounded-[20px] p-5 text-center text-[13px] text-muted">
            {s.geo === 'blocked' ? 'No route without location. Time and steps still record.'
              : s.geo === 'coarse' ? 'Waiting for a precise location. See the note above.'
              : 'Finding your location… This can take up to a minute the first time.'}
          </div>
        )}
      </div>

      <div className="mt-[clamp(10px,2dvh,20px)] flex shrink-0 items-center justify-center gap-5">
        <button onClick={() => (s.paused ? void resume() : pause())} aria-label={s.paused ? 'Resume' : 'Pause'}
          className={`grid h-[clamp(58px,8.5dvh,76px)] w-[clamp(58px,8.5dvh,76px)] place-items-center rounded-full transition-transform active:scale-95 ${s.paused ? 'bg-cobalt text-on-cobalt shadow-[0_16px_34px_-14px_var(--cobalt)]' : 'lift text-ink'}`}>
          {s.paused ? <IconPlay size={28} /> : <IconPause size={26} />}
        </button>
        <button onClick={() => { pause(); openDialog({ kind: 'finish' }); }}
          className="flex h-[clamp(58px,8.5dvh,76px)] items-center gap-2.5 rounded-full bg-mango px-8 text-[18px] font-extrabold text-[#2A1B00] shadow-[0_16px_34px_-16px_var(--mango),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform active:scale-95">
          <IconStop size={18} />Finish
        </button>
      </div>
    </div>
  );
}
