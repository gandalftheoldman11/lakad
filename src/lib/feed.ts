import type { Activity, FeedPost } from '../types';
import { supabase } from './supabase';
import { account } from './account';
import { createStore } from './store';
import { shapeFromRoute, trimRoute } from './geo';
import { data } from './data';

export const feed = createStore({
  loading: false,
  loaded: false,
  error: '' as string,
  posts: [] as FeedPost[],
  cheers: new Map<string, Set<string>>()   // post id -> user ids
});

export async function loadFeed() {
  if (!supabase || !account.get().session) return;
  feed.set({ loading: true, error: '' });
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id,user_id,act_id,type,distance,duration,steps,elev_gain,note,shape,start,created_at,profiles(display_name)')
      .order('created_at', { ascending: false })
      .limit(150);
    if (error) throw error;
    const posts: FeedPost[] = (data || []).map((r: Record<string, unknown>) => {
      const prof = r.profiles as { display_name: string | null } | { display_name: string | null }[] | null;
      const p = Array.isArray(prof) ? prof[0] : prof;
      return { ...(r as unknown as FeedPost), display_name: p?.display_name ?? null };
    });
    const cheers = new Map<string, Set<string>>();
    if (posts.length) {
      const { data: c, error: ce } = await supabase.from('cheers').select('post_id,user_id').in('post_id', posts.map(p => p.id));
      if (ce) throw ce;
      for (const r of c || []) { if (!cheers.has(r.post_id)) cheers.set(r.post_id, new Set()); cheers.get(r.post_id)!.add(r.user_id); }
    }
    feed.set({ posts, cheers, loaded: true });
  } catch (e) {
    feed.set({ error: navigator.onLine ? "Couldn't load the feed." : "You're offline. The feed loads when you reconnect.", loaded: true });
    console.warn(e);
  } finally {
    feed.set({ loading: false });
  }
}

const uid = () => account.get().session?.user.id;

export async function postActivity(a: Activity) {
  const u = uid();
  if (!supabase || !u) throw new Error('Sign in to post');
  const { error } = await supabase.from('posts').upsert({
    user_id: u, act_id: a.id, type: a.type, distance: Math.round(a.distance), duration: Math.round(a.duration), steps: a.steps,
    elev_gain: a.elevGain == null ? null : Math.round(a.elevGain), note: (a.note || '').slice(0, 140) || null,
    shape: shapeFromRoute(trimRoute(a.route, data.get().settings.privacyTrim ?? 200)), start: a.start
  }, { onConflict: 'user_id,act_id' });
  if (error) throw error;
  await loadFeed();
}
/** Keep a posted activity's feed entry in step with edits */
export async function updatePostFor(a: Activity) {
  const u = uid();
  if (!supabase || !u) return;
  await supabase.from('posts').update({
    type: a.type, distance: Math.round(a.distance), duration: Math.round(a.duration), steps: a.steps,
    elev_gain: a.elevGain == null ? null : Math.round(a.elevGain), note: (a.note || '').slice(0, 140) || null, start: a.start
  }).eq('user_id', u).eq('act_id', a.id);
}
export async function removePostFor(actId: string) {
  const u = uid();
  if (!supabase || !u) return;
  await supabase.from('posts').delete().eq('user_id', u).eq('act_id', actId);
  feed.set(s => ({ posts: s.posts.filter(p => !(p.user_id === u && p.act_id === actId)) }));
}
export async function removePost(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
  feed.set(s => ({ posts: s.posts.filter(p => p.id !== id) }));
}
export async function toggleCheer(postId: string) {
  const u = uid();
  if (!supabase || !u) return;
  const set = new Set(feed.get().cheers.get(postId) || []);
  const had = set.has(u);
  had ? set.delete(u) : set.add(u);
  const cheers = new Map(feed.get().cheers); cheers.set(postId, set);
  feed.set({ cheers }); // optimistic
  const { error } = had
    ? await supabase.from('cheers').delete().eq('post_id', postId).eq('user_id', u)
    : await supabase.from('cheers').insert({ post_id: postId, user_id: u });
  if (error) { await loadFeed(); throw error; }
}
export const isPosted = (actId: string) => feed.get().posts.some(p => p.act_id === actId && p.user_id === uid());
