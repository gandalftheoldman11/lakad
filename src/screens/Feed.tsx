import { useEffect, useMemo } from 'react';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { account } from '../lib/account';
import { feed, loadFeed, removePost, toggleCheer } from '../lib/feed';
import { ago, dateLabel, fmtDist, fmtDur, fmtInt, fmtPace, unitL, weekStart } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { toast } from '../lib/ui';
import { TopBar } from '../components/TopBar';
import { RouteShape } from '../components/RouteShape';
import { Button, Empty, LinkButton } from '../components/ui';

export function Feed({ go }: { go: (t: 'record') => void }) {
  const acc = useStore(account);
  const f = useStore(feed);
  const { settings } = useStore(data);
  const me = acc.session?.user.id;
  const u = settings.units;
  useEffect(() => { if (me) void loadFeed(); }, [me]);

  const board = useMemo(() => {
    const ws = weekStart(Date.now()), tot = new Map<string, { name: string; d: number }>();
    for (const p of f.posts) if (p.start >= ws) {
      const cur = tot.get(p.user_id) || { name: p.display_name || 'Someone', d: 0 };
      cur.d += p.distance; tot.set(p.user_id, cur);
    }
    return [...tot].sort((a, b) => b[1].d - a[1].d).slice(0, 10);
  }, [f.posts]);

  const head = (
    <>
      <TopBar />
      <div className="flex items-baseline justify-between"><h2 className="num big m-0 mb-1.5">Feed</h2>{me && <LinkButton onClick={() => void loadFeed()} disabled={f.loading}>{f.loading ? 'Loading…' : 'Refresh'}</LinkButton>}</div>
      <p className="m-0 mb-[18px] text-muted">Walks and runs shared by people using Lakad. Only the route shape is shared, never the map location.</p>
    </>
  );
  if (!acc.enabled) return <>{head}<Empty><p className="m-0">The feed isn't set up for this copy of Lakad. Everything else works offline.</p></Empty></>;
  if (!me) return <>{head}<Empty><p className="m-0 mb-3.5">Sign in to see the feed, post your activities and sync across devices.</p><Button variant="primary" onClick={() => openDialog({ kind: 'account' })}>Sign in</Button></Empty></>;
  if (f.error && !f.posts.length) return <>{head}<Empty><p className="m-0 mb-3.5">{f.error}</p><Button onClick={() => void loadFeed()}>Try again</Button></Empty></>;
  if (!f.loaded) return <>{head}<Empty><p className="m-0">Loading the feed…</p></Empty></>;
  if (!f.posts.length) return <>{head}<Empty><p className="m-0 mb-3.5">Nothing shared yet. Finish a walk or run and post it to start the feed.</p><Button variant="primary" onClick={() => go('record')}>Start recording</Button></Empty></>;

  return (
    <>
      {head}
      {!acc.displayName && <p className="mb-4 rounded-2xl bg-mango-soft px-4 py-3">Others see you as "Someone". <LinkButton onClick={() => openDialog({ kind: 'account' })}>Add a display name</LinkButton></p>}
      {board.length > 0 && (
        <>
          <h2 className="m-0 mb-2 text-lg font-bold">This week's distance</h2>
          <ol className="m-0 mb-1 list-none p-0">
            {board.map(([id, v], i) => (
              <li key={id} className="grid grid-cols-[28px_1fr_auto] items-center gap-2.5 border-b border-line py-2.5">
                <span className="font-extrabold text-muted [font-stretch:120%]">{i + 1}</span>
                <span className="truncate">{id === me ? 'You' : v.name}</span>
                <span className="font-extrabold tabular-nums [font-stretch:115%]">{fmtDist(v.d, u)} {unitL(u)}</span>
              </li>
            ))}
          </ol>
          <p className="m-0 mb-6 text-sm text-muted">Counts posted activities only.</p>
        </>
      )}
      <h2 className="m-0 mb-3 text-lg font-bold">Latest</h2>
      {f.posts.map(p => {
        const cheers = f.cheers.get(p.id), n = cheers?.size || 0, mine = !!(me && cheers?.has(me)), isMe = p.user_id === me;
        return (
          <article key={p.id} className="mb-3.5 rounded-[18px] border border-line bg-surface p-4">
            <header>
              <div className="font-bold">{isMe ? 'You' : p.display_name || 'Someone'}</div>
              <div className="text-sm text-muted">{p.type === 'run' ? 'Ran' : 'Walked'} · {dateLabel(p.start)} · posted {ago(new Date(p.created_at).getTime())}</div>
            </header>
            {p.shape?.length > 1 ? <div className="my-3 aspect-video rounded-xl bg-cobalt-soft"><RouteShape shape={p.shape} w={320} h={180} pad={18} stroke={3.5} /></div> : <div className="h-3" />}
            <div className="flex flex-wrap gap-[18px]">
              {[[fmtDist(p.distance, u), unitL(u)], [fmtDur(p.duration), 'time'], [fmtPace(p.duration, p.distance, u), `/${unitL(u)}`], [fmtInt(p.steps), 'steps'],
                ...(p.elev_gain ? [[fmtInt(p.elev_gain), 'm climbed']] : [])].map(([v, l]) => (
                <div key={l}><b className="block text-xl font-extrabold tabular-nums [font-stretch:120%]">{v}</b><span className="text-sm text-muted">{l}</span></div>
              ))}
            </div>
            {p.note && <p className="mt-2.5 mb-0 [overflow-wrap:anywhere]">{p.note}</p>}
            <footer className="mt-3 flex items-center justify-between">
              <button aria-pressed={mine} onClick={() => toggleCheer(p.id).catch(() => toast("Couldn't update the cheer"))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 font-bold ${mine ? 'border-mango bg-mango text-[#2A1B00]' : 'border-line'}`}>
                {mine ? 'Cheered' : 'Cheer'}{n ? ` · ${n}` : ''}
              </button>
              {isMe && <LinkButton danger onClick={() => removePost(p.id).then(() => toast('Post removed')).catch(() => toast("Couldn't remove the post"))}>Remove post</LinkButton>}
            </footer>
          </article>
        );
      })}
    </>
  );
}
