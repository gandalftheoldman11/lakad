import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useSel, useStore } from './lib/store';
import { pwa, applyUpdate } from './lib/pwa';
import { data } from './lib/data';
import { rec } from './lib/recorder';
import { dialogs, closeDialog } from './lib/dialogs';
import { isNative } from './lib/platform';
import { Today } from './screens/Today';
import { Record } from './screens/Record';
import { Progress } from './screens/Progress';
import { Feed } from './screens/Feed';
import { Detail } from './dialogs/Detail';
import { ActivityForm } from './dialogs/ActivityForm';
import { DaySteps } from './dialogs/DaySteps';
import { Finish } from './dialogs/Finish';
import { SettingsDialog } from './dialogs/Settings';
import { AccountDialog } from './dialogs/Account';
import { Sheet, Toast } from './components/ui';
import { IconFeed, IconProgress, IconRecord, IconToday } from './components/icons';

type Tab = 'today' | 'record' | 'progress' | 'feed';
const TABS: [Tab, string, () => React.ReactElement][] = [['today', 'Today', IconToday], ['record', 'Record', IconRecord], ['progress', 'Progress', IconProgress], ['feed', 'Feed', IconFeed]];

export default function App() {
  const [tab, setTab] = useState<Tab>(() => (rec.get().session ? 'record' : 'today'));
  const { ready } = useStore(data);
  const recording = useSel(rec, s => !!s.session);
  const updateReady = useSel(pwa, s => s.updateReady);
  const { d } = useStore(dialogs);
  const go = (t: Tab) => { setTab(t); window.scrollTo(0, 0); };

  // Android back button: close dialog, then go to Today, then leave
  useEffect(() => {
    if (!isNative) return;
    const h = CapApp.addListener('backButton', () => {
      if (dialogs.get().d.kind) closeDialog();
      else if (tab !== 'today') setTab('today');
      else if (!rec.get().session) void CapApp.minimizeApp();
      else void CapApp.minimizeApp(); // keep recording in the background
    });
    return () => { void h.then(x => x.remove()); };
  }, [tab]);

  // Warn before closing the browser tab mid-recording
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (rec.get().session) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  if (!ready) return <div className="grid min-h-dvh place-items-center text-muted">Loading…</div>;

  return (
    <>
      <main className="mx-auto max-w-[560px] px-[18px] pt-5 pb-32">
        {updateReady && !recording && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-cobalt-soft px-4 py-3">
            <span>A new version of Lakad is ready.</span>
            <button className="shrink-0 rounded-full bg-cobalt px-4 py-2 font-bold text-on-cobalt" onClick={() => void applyUpdate()}>Update</button>
          </div>
        )}
        {tab === 'today' && <Today go={go} />}
        {tab === 'record' && <Record />}
        {tab === 'progress' && <Progress go={go} />}
        {tab === 'feed' && <Feed go={go} />}
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto grid max-w-[560px] grid-cols-4">
          {TABS.map(([t, label, Icon]) => (
            <button key={t} onClick={() => go(t)} aria-current={tab === t ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 px-1 pt-2.5 pb-3 text-xs font-semibold ${tab === t ? 'text-cobalt' : 'text-muted'}`}>
              <Icon />{label}
              {t === 'record' && recording && <span className="dot-live absolute top-2 right-[calc(50%-18px)] h-[9px] w-[9px] rounded-full bg-danger" aria-label="Recording" />}
            </button>
          ))}
        </div>
      </nav>

      <Sheet open={!!d.kind} onClose={closeDialog} label={d.kind || 'dialog'}>
        {d.kind === 'detail' && <Detail id={d.id} />}
        {d.kind === 'form' && <ActivityForm id={d.id} />}
        {d.kind === 'day' && <DaySteps />}
        {d.kind === 'finish' && <Finish onSaved={() => go('today')} />}
        {d.kind === 'settings' && <SettingsDialog />}
        {d.kind === 'account' && <AccountDialog />}
      </Sheet>
      <Toast />
    </>
  );
}
