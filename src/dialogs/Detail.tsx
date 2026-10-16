import { Suspense, useState } from 'react';
import { LoadGuard, useRetryableLazy } from '../components/LoadGuard';
import { useStore } from '../lib/store';
import { data, deleteActivity } from '../lib/data';
import { account } from '../lib/account';
import { feed, postActivity, removePostFor } from '../lib/feed';
import { calories } from '../lib/metrics';
import { splitsOf, trimRoute } from '../lib/geo';
import { dateLabel, fmtDist, fmtInt, fmtP, fmtPace, fmtTime, timeLabel, unitL, unitM, ymd } from '../lib/format';
import { closeDialog, openDialog } from '../lib/dialogs';
import { shareTitle } from '../lib/shareImage';
import { IconShare } from '../components/icons';
import { saveFile } from '../lib/files';
import { activityGpx } from '../lib/exporters';
import { toast } from '../lib/ui';
import { Actions, Button, SheetTitle } from '../components/ui';

const Stat = ({ v, l, big }: { v: string; l: string; big?: boolean }) => <div><span className={`num ${big ? 'big' : 'mid'} block`}>{v}</span><span className="text-sm text-muted">{l}</span></div>;

export function Detail({ id }: { id: string }) {
  const [RouteMap, retryMap] = useRetryableLazy(() => import('../components/RouteMap'));
  const { acts, settings } = useStore(data);
  const acc = useStore(account);
  const f = useStore(feed);
  const [busy, setBusy] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const a = acts.find(x => x.id === id);
  if (!a) return <><SheetTitle>Activity not found</SheetTitle><Actions><Button onClick={closeDialog}>Close</Button></Actions></>;
  const u = settings.units;
  const me = acc.session?.user.id;
  const posted = !!me && f.posts.some(p => p.act_id === a.id && p.user_id === me);
  const sp = a.distanceEdited ? [] : splitsOf(a.route, unitM(u));
  const full = sp.filter(s => !s.partial), fastest = full.length ? Math.min(...full.map(s => s.sec)) : 0;
  const kc = calories(a, settings);
  const stride = a.steps && a.distance ? (a.distance / a.steps).toFixed(2) : null;
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } finally { setBusy(''); } };

  return (
    <>
      <p className="m-0 text-sm text-muted">{dateLabel(a.start)} · {timeLabel(a.start)}</p>
      <SheetTitle>{shareTitle(a)}</SheetTitle>
      {a.route.length > 1 && <LoadGuard className="mt-3.5 aspect-[4/3]" onRetry={retryMap}><Suspense fallback={<div className="mt-3.5 aspect-[4/3] rounded-[18px] bg-cobalt-soft" />}><RouteMap route={a.route} animate className="mt-3.5 aspect-[4/3]" /></Suspense></LoadGuard>}
      <div className="my-[18px] grid grid-cols-2 gap-3">
        <Stat big v={fmtDist(a.distance, u)} l={`${unitL(u)}${a.indoor ? ' (indoor, from steps)' : a.distanceEdited ? ' (edited)' : ''}`} />
        <Stat big v={fmtTime(a.duration)} l="moving time" />
        <Stat v={fmtPace(a.duration, a.distance, u)} l={`avg pace /${unitL(u)}`} />
        <Stat v={fmtInt(a.steps)} l={`steps${({ estimate: ' (estimated)', sensor: ' (motion sensor)', pedometer: ' (phone pedometer)', manual: '' } as const)[a.stepsSource] ?? ''}`} />
        <Stat v={kc == null ? '–' : fmtInt(kc)} l={kc == null ? 'kcal (add weight)' : 'kcal, estimated'} />
        <Stat v={a.elevGain == null ? '–' : fmtInt(a.elevGain)} l="m climbed" />
      </div>
      {stride && <p className="m-0 text-sm text-muted">Average step length {stride} m{a.duration ? ` · cadence ${Math.round(a.steps / (a.duration / 60))} steps/min` : ''}</p>}
      {sp.length > 0 && (
        <>
          <h2 className="mt-[18px] mb-2 text-lg font-bold">Splits</h2>
          <table className="w-full border-collapse tabular-nums">
            <thead><tr className="text-left text-sm text-muted"><th className="border-b border-line py-2 font-semibold">{unitL(u)}</th><th className="border-b border-line py-2 font-semibold">Pace</th><th className="w-[45%] border-b border-line" /></tr></thead>
            <tbody>
              {sp.map(s => {
                const pace = s.partial ? s.sec / s.partial : s.sec;
                return (
                  <tr key={s.n} className="text-sm">
                    <td className="border-b border-line py-2">{s.partial ? s.partial.toFixed(2) : s.n}</td>
                    <td className="border-b border-line py-2">{fmtP(pace)}</td>
                    <td className="border-b border-line py-2"><div className="h-2 rounded" style={{ width: `${Math.max(12, Math.min(100, (fastest / pace) * 100))}%`, background: !s.partial && s.sec === fastest ? 'var(--mango)' : 'var(--cobalt)' }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      <Actions>
        <Button variant="primary" disabled={!!busy} onClick={() => openDialog({ kind: 'share', id: a.id })}><IconShare />Share image</Button>
        {a.route.length > 1 && <Button disabled={!!busy} onClick={() => run('gpx', () => saveFile(`lakad-${a.type}-${ymd(a.start)}.gpx`, activityGpx({ ...a, route: trimRoute(a.route, settings.privacyTrim ?? 200) }), 'application/gpx+xml'))}>Export GPX</Button>}
      </Actions>
      {acc.enabled && (
        <div className="mt-2.5">
          {!me ? <Button className="w-full" onClick={() => openDialog({ kind: 'account' })}>Sign in to share with friends</Button>
            : posted ? <Button className="w-full" disabled={!!busy} onClick={() => run('unpost', async () => { await removePostFor(a.id); toast('No longer shared'); })}>Stop sharing with friends</Button>
            : <Button className="w-full" disabled={!!busy} onClick={() => run('post', async () => { try { await postActivity(a); toast('Shared with your friends'); } catch { toast("Couldn't share. Check your connection."); } })}>{busy === 'post' ? 'Sharing…' : 'Share with friends'}</Button>}
        </div>
      )}
      <Actions>
        <Button onClick={() => openDialog({ kind: 'form', id: a.id })}>Edit</Button>
        <Button variant="danger" onClick={async () => {
          if (!confirmDel) return setConfirmDel(true);
          closeDialog(); await deleteActivity(a.id); if (me) void removePostFor(a.id); toast('Deleted');
        }}>{confirmDel ? 'Tap again to delete' : 'Delete'}</Button>
        <Button onClick={closeDialog}>Close</Button>
      </Actions>
    </>
  );
}
