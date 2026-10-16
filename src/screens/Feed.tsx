import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { account } from '../lib/account';
import { feed, loadFeed, removePost, toggleCheer } from '../lib/feed';
import { friends, loadFriends, addFriend, respond, removeFriend, blockPerson, shareMyCode, type Person } from '../lib/friends';
import { ago, dateLabel, fmtDist, fmtDur, fmtInt, fmtPace, unitL, weekStart } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { toast } from '../lib/ui';
import { TopBar } from '../components/TopBar';
import { RouteShape } from '../components/RouteShape';
import { Button, Empty, LinkButton, SectionTitle } from '../components/ui';
import { IconShare } from '../components/icons';
import { Badge } from '../components/Badge';
import { MyBadgeCard } from '../components/MyBadgeCard';
import { BADGES } from '../lib/badges';
import { useMyBadge } from '../lib/myBadge';

/** A friend's badge if we know their level, otherwise their initial */
const Avatar = ({ name, level }: { name: string | null; level?: number | null }) => level
  ? <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-visible">
      <span className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${BADGES[level - 1]?.colors.fx}33, transparent 70%)`, boxShadow: `inset 0 0 0 2px ${BADGES[level - 1]?.colors.rimBottom}` }} />
      <span className="relative"><Badge level={level} size={level >= 6 ? 66 : 42} animate={false} title={`${name || 'Friend'}: ${BADGES[level - 1]?.name} badge`} /></span>
    </span>
  : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cobalt-soft text-[15px] font-bold text-cobalt">{(name || '?').trim().charAt(0).toUpperCase()}</span>;

function YourCode({ code }: { code: string }) {
  return (
    <div className="lift rounded-[22px] p-4">
      <p className="m-0 text-[13px] font-semibold text-muted">Your friend code</p>
      <span className="num mt-1 block text-[clamp(32px,10vw,44px)] tracking-[0.08em]" aria-label={`Your friend code: ${code.split('').join(' ')}`}>{code || '······'}</span>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button className="min-h-11 py-2 text-[15px]" disabled={!code} onClick={async () => { await navigator.clipboard?.writeText(code); toast('Code copied'); }}>Copy</Button>
        <Button variant="primary" className="min-h-11 py-2 text-[15px]" disabled={!code} onClick={async () => { if ((await shareMyCode(code)) === 'copied') toast('Code copied'); }}><IconShare size={18} />Share</Button>
      </div>
      <p className="m-0 mt-2 text-[13px] text-muted">Send this to friends. When they add it, you’ll both see each other’s walks and runs.</p>
    </div>
  );
}

function AddFriend() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setMsg(null);
    const r = await addFriend(code); setMsg(r); if (r.ok) setCode('');
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mt-5" noValidate>
      <label htmlFor="friendCode" className="mb-2 block text-[15px] font-semibold">Add a friend</label>
      <div className="flex gap-2">
        <input id="friendCode" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Their 6-letter code" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={9}
          className="min-w-0 flex-1 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[17px] font-semibold tracking-[0.08em] text-ink outline-none focus:border-cobalt focus:shadow-[0_0_0_3px_var(--cobalt-soft)]" />
        <Button variant="primary" type="submit" disabled={busy || code.replace(/[^A-Z0-9]/gi, '').length < 6}>{busy ? 'Adding…' : 'Add'}</Button>
      </div>
      {msg && <p role="status" className={`m-0 mt-2 text-[14px] ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.message}</p>}
    </form>
  );
}

function PersonRow({ p, children, sub }: { p: Person; sub: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar name={p.name} level={p.level} />
      <span className="min-w-0 flex-1"><strong className="block truncate text-[15px] font-semibold">{p.name || 'No name yet'}</strong><span className="block text-[13px] text-muted">{sub}</span></span>
      {children}
    </li>
  );
}

function FriendManage({ p }: { p: Person }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'' | 'remove' | 'block'>('');
  const act = async (kind: 'remove' | 'block') => {
    if (confirm !== kind) { setConfirm(kind); return; }
    try { if (kind === 'remove') await removeFriend(p.id); else await blockPerson(p.id); toast(kind === 'remove' ? 'Friend removed' : 'Blocked'); }
    catch { toast('Couldn’t update. Check your connection.'); }
  };
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => openDialog({ kind: 'friend', id: p.id })} aria-label={`Open ${p.name || 'friend'}’s profile`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar name={p.name} level={p.level} />
          <span className="min-w-0 flex-1"><strong className="block truncate text-[15px] font-semibold">{p.name || 'No name yet'}</strong><span className="block text-[13px] text-muted">{p.level ? `${BADGES[p.level - 1]?.name} · ` : ''}Friends since {dateLabel(p.since)}</span></span>
        </button>
        <LinkButton className="text-[14px]" aria-expanded={open} onClick={() => { setOpen(!open); setConfirm(''); }}>{open ? 'Done' : 'Manage'}</LinkButton>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
          <Button className="min-h-10 px-4 py-1.5 text-[14px]" onClick={() => act('remove')}>{confirm === 'remove' ? 'Tap again to remove' : 'Remove friend'}</Button>
          <Button variant="danger" className="min-h-10 px-4 py-1.5 text-[14px]" onClick={() => act('block')}>{confirm === 'block' ? 'Tap again to block' : 'Block'}</Button>
          {confirm === 'block' && <p className="m-0 w-full text-[13px] text-muted">They won’t see your posts or be able to add you again. They aren’t told.</p>}
        </div>
      )}
    </li>
  );
}

export function Feed({ go }: { go: (t: 'record') => void }) {
  const acc = useStore(account);
  const f = useStore(feed);
  const fr = useStore(friends);
  const myLevel = useMyBadge().level;
  const { settings } = useStore(data);
  const me = acc.session?.user.id;
  const u = settings.units;
  useEffect(() => { if (me) { void loadFeed(); void loadFriends(); } }, [me]);
  useEffect(() => { const back = () => { if (me) { void loadFeed(); void loadFriends(); } }; window.addEventListener('online', back); return () => window.removeEventListener('online', back); }, [me]);

  const board = useMemo(() => {
    const ws = weekStart(Date.now()), tot = new Map<string, { name: string; d: number; level: number | null }>();
    for (const p of f.posts) if (p.start >= ws) {
      const cur = tot.get(p.user_id) || { name: p.display_name || 'Someone', d: 0, level: p.user_id === me ? myLevel : p.badge_level ?? null };
      cur.d += p.distance; tot.set(p.user_id, cur);
    }
    return [...tot].sort((a, b) => b[1].d - a[1].d).slice(0, 10);
  }, [f.posts, me, myLevel]);

  const refresh = () => { void loadFeed(); void loadFriends(); };
  const head = (
    <TopBar title="Friends" action={me ? <LinkButton className="text-[14px]" onClick={refresh} disabled={f.loading || fr.loading}>{f.loading || fr.loading ? 'Loading…' : 'Refresh'}</LinkButton> : undefined} />
  );
  if (!acc.enabled) return <>{head}<Empty><p className="m-0">Friends aren't set up for this copy of Lakad yet. Everything else works offline.</p></Empty></>;
  if (!me) return <>{head}<Empty><p className="m-0 mb-3.5">Sign in to add friends, see each other’s walks and runs, and sync across devices.</p><Button variant="primary" onClick={() => openDialog({ kind: 'account' })}>Sign in</Button></Empty></>;
  if ((f.error || fr.error) && !f.posts.length && !fr.loaded && !fr.savedAt) return <>{head}<Empty><p className="m-0 mb-3.5">{fr.error || f.error}</p><Button onClick={refresh}>Try again</Button></Empty></>;

  return (
    <>
      {head}
      {(f.savedAt > 0 || fr.savedAt > 0) && !navigator.onLine && <p className="mt-0 mb-4 rounded-[18px] bg-surface-2 px-4 py-3 text-[14px] text-muted">You’re offline. Showing what you saw {ago(Math.max(f.savedAt, fr.savedAt))}; it updates when you reconnect.</p>}
      {!acc.displayName && <p className="mt-0 mb-4 rounded-[18px] bg-mango-soft px-4 py-3 text-[14px]">Friends see you as “No name yet”. <LinkButton onClick={() => openDialog({ kind: 'account' })}>Add your name</LinkButton></p>}
      <MyBadgeCard />
      <div className="mt-4"><YourCode code={fr.myCode} /></div>
      <AddFriend />

      {fr.incoming.length > 0 && (
        <section className="mt-7">
          <SectionTitle>Requests</SectionTitle>
          <ul className="lift m-0 list-none divide-y divide-line overflow-hidden rounded-[22px] p-0">
            {fr.incoming.map(p => (
              <PersonRow key={p.id} p={p} sub="Wants to be friends">
                <div className="flex shrink-0 items-center gap-2">
                  <LinkButton className="text-[14px]" onClick={() => respond(p.id, false).catch(() => toast('Couldn’t update'))}>Decline</LinkButton>
                  <Button variant="primary" className="min-h-10 px-4 py-1.5 text-[14px]" onClick={() => respond(p.id, true).then(() => toast('You’re now friends!')).catch(() => toast('Couldn’t update'))}>Accept</Button>
                </div>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      {board.length > 1 && (
        <section className="mt-7">
          <SectionTitle aside={<span className="label">Posted activities</span>}>This week</SectionTitle>
          <ol className="lift m-0 list-none divide-y divide-line overflow-hidden rounded-[22px] p-0">
            {board.map(([id, v], i) => (
              <li key={id} className="grid grid-cols-[28px_1fr_auto] items-center gap-2.5 px-4 py-3">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-extrabold ${i === 0 ? 'bg-mango text-[#2A1B00]' : 'text-muted'}`}>{i + 1}</span>
                <span className="flex min-w-0 items-center gap-2">{v.level ? <Badge level={v.level} size={34} animate={false} /> : null}<span className="truncate text-[15px] font-semibold">{id === me ? 'You' : v.name}</span></span>
                <span className="num text-[18px]">{fmtDist(v.d, u)} <span className="text-[13px] text-muted">{unitL(u)}</span></span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-7">
        <SectionTitle>Latest</SectionTitle>
        {!f.loaded ? <Empty><p className="m-0">Loading…</p></Empty>
          : !f.posts.length ? (
            <Empty>
              <p className="m-0 mb-3.5">{fr.friends.length ? 'No posts yet. Finish a walk or run and post it.' : 'Add a friend with their code to see each other’s walks and runs here.'}</p>
              <Button variant="primary" onClick={() => go('record')}>Start recording</Button>
            </Empty>
          ) : f.posts.map(p => {
            const cheers = f.cheers.get(p.id), n = cheers?.size || 0, mine = !!(me && cheers?.has(me)), isMe = p.user_id === me;
            return (
              <article key={p.id} className="lift mb-3.5 rounded-[22px] p-4">
                <header>
                  <button type="button" disabled={isMe} onClick={() => openDialog({ kind: 'friend', id: p.user_id })} aria-label={isMe ? undefined : `Open ${p.display_name || 'friend'}’s profile`} className="flex w-full items-center gap-3 text-left disabled:cursor-default">
                    <Avatar name={isMe ? acc.displayName || 'You' : p.display_name} level={isMe ? myLevel : p.badge_level} />
                    <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{isMe ? 'You' : p.display_name || 'No name yet'}</span>
                      <span className="block text-[13px] text-muted">{p.type === 'run' ? 'Ran' : 'Walked'} · {dateLabel(p.start)} · {ago(new Date(p.created_at).getTime())}</span></span>
                  </button>
                </header>
                {p.shape?.length > 1 ? <div className="my-3 aspect-video rounded-[16px] bg-cobalt-soft"><RouteShape shape={p.shape} w={320} h={180} pad={18} stroke={3.5} /></div> : <div className="h-3" />}
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {[[fmtDist(p.distance, u), unitL(u)], [fmtDur(p.duration), 'time'], [fmtPace(p.duration, p.distance, u), `/${unitL(u)}`], [fmtInt(p.steps), 'steps'],
                    ...(p.elev_gain ? [[fmtInt(p.elev_gain), 'm climbed']] : [])].map(([v, l]) => (
                    <div key={l}><b className="num block text-[20px]">{v}</b><span className="label">{l}</span></div>
                  ))}
                </div>
                {p.note && <p className="mt-2.5 mb-0 text-[15px] [overflow-wrap:anywhere]">{p.note}</p>}
                <footer className="mt-3 flex items-center justify-between">
                  <button aria-pressed={mine} onClick={() => toggleCheer(p.id).catch(() => toast("Couldn't update the cheer"))}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-bold transition-colors ${mine ? 'bg-mango text-[#2A1B00]' : 'bg-surface-2 text-ink'}`}>
                    {mine ? 'Cheered' : 'Cheer'}{n ? ` · ${n}` : ''}
                  </button>
                  {isMe && <LinkButton danger className="text-[14px]" onClick={() => removePost(p.id).then(() => toast('Post removed')).catch(() => toast("Couldn't remove the post"))}>Remove post</LinkButton>}
                </footer>
              </article>
            );
          })}
      </section>

      {fr.outgoing.length > 0 && (
        <section className="mt-7">
          <SectionTitle>Sent requests</SectionTitle>
          <ul className="lift m-0 list-none divide-y divide-line overflow-hidden rounded-[22px] p-0">
            {fr.outgoing.map(p => (
              <PersonRow key={p.id} p={p} sub="Waiting for them to accept">
                <LinkButton className="text-[14px]" onClick={() => removeFriend(p.id).then(() => toast('Request cancelled')).catch(() => toast('Couldn’t update'))}>Cancel</LinkButton>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      {fr.friends.length > 0 && (
        <section className="mt-7">
          <SectionTitle aside={<span className="label">{fr.friends.length}</span>}>Your friends</SectionTitle>
          <ul className="lift m-0 list-none divide-y divide-line overflow-hidden rounded-[22px] p-0">
            {fr.friends.map(p => <FriendManage key={p.id} p={p} />)}
          </ul>
        </section>
      )}
      <p className="m-0 mt-6 text-center text-[13px] text-muted">Only your friends see what you post, and only the route shape, never the map location.</p>
    </>
  );
}
