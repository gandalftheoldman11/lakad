import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { LoadGuard, useRetryableLazy } from '../components/LoadGuard';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { closeDialog } from '../lib/dialogs';
import type { LatLng } from '../lib/routing';
import { smartRouter, covers, offline, saveAreaAround, AREA_RADIUS } from '../lib/offlineArea';
import { suggestLoops, pointAt, headingName, lineLength, type LoopOption } from '../lib/planner';
import { savePlan } from '../lib/plans';
import { fmtDist, unitL, unitM } from '../lib/format';
import { Button, LinkButton, Segmented, SheetTitle } from '../components/ui';

const QUICK = { km: [2, 3, 5, 8, 10], mi: [1, 2, 3, 5, 6] };

/** Plan a walk or run of a set distance: a suggested loop from here, or a route you draw */
export function PlanRoute() {
  const [PlanMap, retryMap] = useRetryableLazy(() => import('../components/PlanMap'));
  const { settings, acts } = useStore(data);
  const u = settings.units, M = unitM(u);
  const [target, setTarget] = useState(u === 'mi' ? 3 : 5);
  const [custom, setCustom] = useState('');
  const [mode, setMode] = useState<'loop' | 'draw'>('loop');
  const [start, setStart] = useState<LatLng | null>(null);
  const [locMsg, setLocMsg] = useState('Finding your location…');
  const [options, setOptions] = useState<LoopOption[]>([]);
  const [pick, setPick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pts, setPts] = useState<LatLng[]>([]);
  const [closeLoop, setCloseLoop] = useState(false);
  const [drawn, setDrawn] = useState<{ coords: LatLng[]; distance: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const targetM = target * M;
  const off = useStore(offline);
  const local = !!start && covers(off.area, [start]);
  const why = (e: unknown) => {
    const m = (e as Error)?.message;
    return m === 'offline' ? 'You’re offline. Save your area while you have internet, and planning will work without it.'
      : m === 'outside' ? 'That’s outside your saved area. Connect to the internet, or save this area while online.'
      : m === 'nostreet' ? 'No street or path near that point. Tap closer to a road or path.'
      : 'Couldn’t get routes. Check your connection and try again.';
  };

  // start where you are; otherwise near your last walk, and you can tap to move it
  useEffect(() => {
    const fallback = () => {
      const last = acts.find(a => a.route.length)?.route[0];
      if (last) setStart([last[0], last[1]]);
      setLocMsg(last ? 'Couldn’t get your location, so the start is at your last walk. Tap the map to move it.' : 'Couldn’t get your location. Tap the map to set your start.');
    };
    if (!navigator.geolocation) { fallback(); return; }
    navigator.geolocation.getCurrentPosition(p => { setStart([p.coords.latitude, p.coords.longitude]); setLocMsg(''); }, fallback, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    return () => abort.current?.abort();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // any change to the inputs makes earlier suggestions out of date
  useEffect(() => { abort.current?.abort(); setOptions([]); setBusy(false); setErr(''); }, [target, start, mode]);

  async function findLoops() {
    if (!start) return;
    abort.current?.abort(); const ctl = new AbortController(); abort.current = ctl;
    setOptions([]); setPick(0); setErr(''); setBusy(true);
    try { await suggestLoops(smartRouter, start, targetM, o => { if (!ctl.signal.aborted) setOptions(list => [...list, o]); }, ctl.signal, local ? 30 : 0); }
    catch (e) { if (!ctl.signal.aborted) setErr(why(e)); }
    finally { if (!ctl.signal.aborted) setBusy(false); }
  }

  // drawing: route through your points along real paths (waits for you to pause tapping)
  useEffect(() => {
    if (mode !== 'draw' || !start || pts.length === 0) { setDrawn(null); return; }
    const all = [start, ...pts, ...(closeLoop ? [start] : [])];
    const ctl = new AbortController(), t = setTimeout(async () => {
      setBusy(true); setErr('');
      try { const r = await smartRouter(all, ctl.signal); if (!ctl.signal.aborted) setDrawn(r); }
      catch (e) { if (!ctl.signal.aborted) setErr(why(e)); }
      finally { if (!ctl.signal.aborted) setBusy(false); }
    }, 650);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [mode, start, pts, closeLoop]);

  const active = mode === 'loop' ? options[pick]?.route ?? null : drawn;
  const goal = useMemo(() => (active && active.distance > targetM * 1.01 ? pointAt(active.coords, targetM * (lineLength(active.coords) / active.distance)) : null), [active, targetM]);

  function onTap(p: LatLng) {
    if (mode === 'draw') { if (!start) setStart(p); else setPts(x => [...x, p]); }
    else setStart(p);
  }
  async function use() {
    if (!active) return;
    await savePlan({ id: `p${Date.now()}`, target: targetM, coords: active.coords, distance: active.distance, kind: mode === 'loop' ? 'loop' : 'drawn', createdAt: Date.now() });
    closeDialog();
  }

  const fmt = (m: number) => `${fmtDist(m, u)} ${unitL(u)}`;
  const diff = active ? active.distance - targetM : 0;
  return (
    <>
      <SheetTitle sub="Pick a distance, then let Lakad suggest a loop or draw your own route along real streets and paths.">Plan a route</SheetTitle>

      <p className="m-0 mt-4 mb-2 text-[15px] font-semibold">Distance</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Target distance">
        {QUICK[u].map(d => (
          <button key={d} aria-pressed={!custom && target === d} onClick={() => { setCustom(''); setTarget(d); }}
            className={`min-w-14 rounded-full px-4 py-2 text-[15px] font-bold transition-colors ${!custom && target === d ? 'bg-cobalt text-on-cobalt' : 'bg-surface-2 text-ink'}`}>{d} {unitL(u)}</button>
        ))}
        <input aria-label={`Custom distance in ${unitL(u)}`} inputMode="decimal" placeholder="Other" value={custom}
          onChange={e => { setCustom(e.target.value); const v = parseFloat(e.target.value); if (v >= 0.3 && v <= 60) setTarget(v); }}
          className="w-24 rounded-full border border-line bg-surface-2 px-4 py-2 text-[15px] font-bold text-ink outline-none focus:border-cobalt" />
      </div>

      <div className="mt-4 flex justify-center">
        <Segmented value={mode} onChange={setMode} label="How to plan" options={[['loop', 'Suggest a loop'], ['draw', 'Draw my own']]} />
      </div>

      <LoadGuard className="mt-3 h-[44dvh] min-h-[260px]" onRetry={retryMap}><Suspense fallback={<div className="mt-3 h-[44dvh] min-h-[260px] rounded-[20px] bg-cobalt-soft" />}>
        <PlanMap className="mt-3 h-[44dvh] min-h-[260px]" center={start} start={start} onTap={onTap}
          waypoints={mode === 'draw' ? pts : []} route={mode === 'draw' ? drawn?.coords ?? [] : []}
          options={mode === 'loop' ? options.map((o, i) => ({ coords: o.route.coords, active: i === pick, onPick: () => setPick(i) })) : []}
          goal={goal} goalLabel={`${fmtDist(targetM, u)} ${unitL(u)}`} />
      </Suspense></LoadGuard>
      {locMsg && <p className="m-0 mt-1 text-[13px] text-muted">{locMsg}</p>}
      <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
        <span className={local ? 'font-semibold text-ok' : 'text-muted'}>{local ? '✓ Saved area: works offline' : off.online ? 'Using online routing' : 'Offline, and this area isn’t saved'}</span>
        {!local && off.online && start && (
          <LinkButton className="text-[13px]" disabled={off.saving} onClick={() => void saveAreaAround(start).catch(() => {})}>{off.saving ? 'Saving…' : `Save ${AREA_RADIUS / 1000} km around here`}</LinkButton>
        )}
      </div>
      {off.error && <p className="m-0 mt-1 text-[13px] text-danger">{off.error}</p>}

      {mode === 'loop' ? (
        <div className="mt-3">
          {options.length > 0 && (
            <ul className="m-0 mb-3 grid list-none gap-2 p-0">
              {options.map((o, i) => {
                const off = o.route.distance - targetM;
                return (
                  <li key={i}>
                    <button onClick={() => setPick(i)} aria-pressed={i === pick}
                      className={`flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-left ${i === pick ? 'bg-cobalt-soft ring-2 ring-[var(--cobalt)]' : 'bg-surface-2'}`}>
                      <span><strong className="block text-[15px]">Loop {i + 1}: heads {headingName(o.heading)}</strong>
                        <span className="text-[13px] text-muted">{Math.abs(o.error) <= 0.03 ? 'Matches your distance' : `${fmt(Math.abs(off))} ${off > 0 ? 'longer' : 'shorter'} than your goal (closest found)`}</span></span>
                      <span className="num text-[20px]">{fmtDist(o.route.distance, u)}<span className="text-[12px] text-muted"> {unitL(u)}</span></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Button variant={options.length ? 'ghost' : 'primary'} className="w-full" disabled={!start || busy} onClick={findLoops}>
            {busy ? `Finding loop ${options.length + 1} of 3…` : options.length ? 'Find different loops' : `Find ${fmt(targetM)} loops from here`}
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="rounded-[16px] bg-surface-2 px-4 py-3">
            {!start ? <p className="m-0 text-[14px] text-muted">Tap the map to set your start.</p>
              : !pts.length ? <p className="m-0 text-[14px] text-muted">Tap the map to add points along your way. The route follows streets and paths.</p>
              : (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="num text-[24px]">{drawn ? fmtDist(drawn.distance, u) : '…'}<span className="text-[13px] text-muted"> of {fmt(targetM)}</span></span>
                    {busy && <span className="text-[12px] text-muted">Updating…</span>}
                  </div>
                  {drawn && <p className="m-0 mt-0.5 text-[13px] text-muted">{Math.abs(diff) <= targetM * 0.01 ? 'Right on your goal.' : diff < 0 ? `${fmt(-diff)} to go. Keep adding points.` : `${fmt(diff)} over. The flag shows where you reach your goal.`}</p>}
                </>
              )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button className="min-h-10 flex-1 px-3 py-1.5 text-[14px]" disabled={!pts.length} onClick={() => setPts(x => x.slice(0, -1))}>Undo</Button>
            <Button className={`min-h-10 flex-1 px-3 py-1.5 text-[14px] ${closeLoop ? 'ring-2 ring-[var(--cobalt)]' : ''}`} aria-pressed={closeLoop} disabled={!pts.length} onClick={() => setCloseLoop(v => !v)}>{closeLoop ? 'Loop: on' : 'Back to start'}</Button>
            <Button className="min-h-10 flex-1 px-3 py-1.5 text-[14px]" disabled={!pts.length} onClick={() => { setPts([]); setCloseLoop(false); }}>Clear</Button>
          </div>
        </div>
      )}

      {err && <p role="alert" className="m-0 mt-3 text-[14px] text-danger">{err}</p>}
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1" disabled={!active} onClick={use}>Walk this route</Button>
        <LinkButton className="px-3 text-[15px]" onClick={closeDialog}>Cancel</LinkButton>
      </div>
    </>
  );
}

