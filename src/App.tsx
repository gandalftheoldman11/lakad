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
import { ShareSheet } from './dialogs/ShareSheet';
import { BadgesSheet, LevelUp } from './dialogs/Badges';
import { PlanRoute } from './dialogs/PlanRoute';
import { FriendCard } from './dialogs/FriendCard';
import { useBadgeKeeper } from './lib/myBadge';
import { Onboarding } from './components/Onboarding';
import { saveSettings } from './lib/data';
import { ActivityForm } from './dialogs/ActivityForm';
import { DaySteps } from './dialogs/DaySteps';
import { Finish } from './dialogs/Finish';
import { SettingsDialog } from './dialogs/Settings';
import { AccountDialog } from './dialogs/Account';
import { Sheet, Toast } from './components/ui';
import { IconFeed, IconGear, IconProgress, IconRecord, IconToday } from './components/icons';
import { openDialog } from './lib/dialogs';

type Tab = 'today' | 'record' | 'progress' | 'feed';

function NavItem({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center gap-0.5 px-1 pt-2.5 pb-2.5 text-[11px] font-semibold transition-colors ${active ? 'text-cobalt' : 'text-muted'}`}>
      {children}{label}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>(() => (rec.get().session ? 'record' : 'today'));
  const { ready, settings, acts } = useStore(data);
  useBadgeKeeper();
  // People who already use Lakad (activities or body details saved) skip the first-time setup
  const { days } = useStore(data);
  // steps read automatically from the phone don't mean someone has used Lakad before
  const existingUser = acts.length > 0 || settings.height > 0 || Object.values(days).some(d => !d.auto);
  useEffect(() => { if (ready && !settings.onboarded && existingUser) void saveSettings({ onboarded: true }); }, [ready, settings.onboarded, existingUser]);
  const showOnboarding = ready && !settings.onboarded && !existingUser;
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
  if (showOnboarding) return <><Onboarding /><Toast /></>;

  return (
    <>
      <main className={`mx-auto max-w-[560px] px-5 pt-5 ${tab === 'record' ? 'pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px))]' : 'pb-36'}`}>
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

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 px-3" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto grid max-w-[520px] grid-cols-5 items-end rounded-[28px] border border-line bg-[var(--nav)] px-1 shadow-[var(--lift)] backdrop-blur-xl">
          {([['today', 'Today', IconToday], ['progress', 'Progress', IconProgress]] as const).map(([t, label, Icon]) => (
            <NavItem key={t} label={label} active={tab === t} onClick={() => go(t)}><Icon /></NavItem>
          ))}
          <div className="flex justify-center">
            <button onClick={() => go('record')} aria-label={recording ? 'Recording in progress' : 'Record'} aria-current={tab === 'record' ? 'page' : undefined}
              className={`relative -mt-6 mb-2 grid h-[60px] w-[60px] place-items-center rounded-full text-on-cobalt shadow-[0_12px_28px_-10px_var(--cobalt),inset_0_1px_0_rgba(255,255,255,.2)] ring-4 ring-bg transition-transform active:scale-95 ${recording ? 'bg-danger' : 'bg-cobalt'}`}>
              <IconRecord size={28} />
              {recording && <span className="dot-live absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-mango ring-2 ring-bg" />}
            </button>
          </div>
          <NavItem label="Friends" active={tab === 'feed'} onClick={() => go('feed')}><IconFeed /></NavItem>
          <NavItem label="Settings" active={false} onClick={() => openDialog({ kind: 'settings' })}><IconGear /></NavItem>
        </div>
      </nav>

      <Sheet open={!!d.kind} onClose={closeDialog} label={d.kind || 'dialog'}>
        {d.kind === 'detail' && <Detail id={d.id} />}
        {d.kind === 'share' && <ShareSheet id={d.id} />}
        {d.kind === 'badges' && <BadgesSheet />}
        {d.kind === 'levelup' && <LevelUp level={d.level} />}
        {d.kind === 'plan' && <PlanRoute />}
        {d.kind === 'friend' && <FriendCard id={d.id} />}
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
