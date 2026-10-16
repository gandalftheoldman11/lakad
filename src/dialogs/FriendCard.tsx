import { useStore } from '../lib/store';
import { friends, type Person } from '../lib/friends';
import { feed } from '../lib/feed';
import { data } from '../lib/data';
import { closeDialog } from '../lib/dialogs';
import { BADGES } from '../lib/badges';
import { LevelBanner } from '../components/LevelBanner';
import { Button } from '../components/ui';
import { dateLabel, fmtDist, fmtDur, unitL } from '../lib/format';
import type { FeedPost, Units } from '../types';

const startOfWeek = (now = new Date()) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

/** The card itself, kept separate from the stores so it can be previewed */
export function FriendCardView({ person, posts, units }: { person: Person; posts: FeedPost[]; units: Units }) {
  const level = person.level ?? 1, b = BADGES[level - 1];
  const mine = posts.filter(p => p.user_id === person.id).sort((a, z) => z.start - a.start);
  const wk = startOfWeek(), week = mine.filter(p => p.start >= wk);
  const weekDist = week.reduce((s, p) => s + p.distance, 0);
  const weekDays = new Set(week.map(p => new Date(p.start).toDateString())).size;
  return (
    <>
      <LevelBanner level={level} />
      <div className="mt-4 text-center">
        <h2 className="m-0 text-[26px] font-black tracking-[-0.02em]">{person.name || 'No name yet'}</h2>
        <p className="m-0 mt-1.5 flex items-center justify-center gap-2 text-[14px]">
          <span className="rounded-full px-3 py-1 text-[13px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${b.colors.panelTop ?? b.colors.faceDark}, color-mix(in srgb, ${b.colors.panelTop ?? b.colors.faceDark} 75%, #000))`, boxShadow: `inset 0 0 0 1.5px ${b.colors.fx}66, inset 0 1px 0 rgba(255,255,255,.2)` }}>{b.name}</span>
          <span className="text-muted">Level {level} of 8</span>
        </p>
        <p className="m-0 mt-0.5 text-[13px] text-muted">Friends since {dateLabel(person.since)}</p>
      </div>
      <div className="lift mt-4 grid grid-cols-3 divide-x divide-line rounded-[20px] py-3 text-center">
        <span><span className="num block text-[22px]">{fmtDist(weekDist, units)}</span><span className="text-[12px] text-muted">{unitL(units)} this week</span></span>
        <span><span className="num block text-[22px]">{weekDays}</span><span className="text-[12px] text-muted">active days</span></span>
        <span><span className="num block text-[22px]">{mine.length}</span><span className="text-[12px] text-muted">shared walks</span></span>
      </div>
      <p className="m-0 mt-5 mb-2 text-[15px] font-bold">Recent walks and runs</p>
      {mine.length ? (
        <ul className="lift m-0 list-none divide-y divide-line rounded-[20px] p-0">
          {mine.slice(0, 5).map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0"><strong className="block truncate text-[15px]">{p.note || (p.type === 'run' ? 'Run' : 'Walk')}</strong><span className="text-[13px] text-muted">{dateLabel(p.start)} · {fmtDur(p.duration)}</span></span>
              <span className="num shrink-0 text-[18px]">{fmtDist(p.distance, units)}<span className="text-[12px] text-muted"> {unitL(units)}</span></span>
            </li>
          ))}
        </ul>
      ) : <p className="m-0 rounded-[18px] bg-surface-2 px-4 py-3 text-[14px] text-muted">No shared walks yet. When {person.name || 'they'} share one, it shows here.</p>}
      <p className="m-0 mt-2 text-[12px] text-muted">Only walks and runs they shared with friends are shown.</p>
    </>
  );
}

export function FriendCard({ id }: { id: string }) {
  const fr = useStore(friends), f = useStore(feed), { settings } = useStore(data);
  const person = fr.friends.find(p => p.id === id);
  // someone you see in the feed but who isn't in your list (yet): build a minimal profile from their posts
  const fromFeed = f.posts.find(p => p.user_id === id);
  const p: Person | null = person ?? (fromFeed ? { id, name: fromFeed.display_name, since: Date.parse(fromFeed.created_at), level: fromFeed.badge_level ?? null } : null);
  if (!p) return <><p className="m-0 mt-4 text-muted">This profile isn’t available right now.</p><Button className="mt-4 w-full" onClick={closeDialog}>Close</Button></>;
  return <><FriendCardView person={p} posts={f.posts} units={settings.units} /><Button className="mt-5 w-full" onClick={closeDialog}>Close</Button></>;
}
