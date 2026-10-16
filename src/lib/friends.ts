import { Share } from '@capacitor/share';
import { supabase } from './supabase';
import { account } from './account';
import { createStore } from './store';
import { isNative } from './platform';
import { loadFeed } from './feed';

export interface Person { id: string; name: string | null; since: number; level: number | null }

export const friends = createStore({
  loaded: false,
  loading: false,
  error: '' as string,
  myCode: '' as string,
  friends: [] as Person[],
  incoming: [] as Person[],   // asked you
  outgoing: [] as Person[],   // you asked them
  savedAt: 0                  // showing the copy saved last time (offline)
});
const snapKey = () => `lakad.friends.${account.get().session?.user.id ?? ''}`;

/** Loads your code, friends and requests. The server only returns rows that involve you. */
export async function loadFriends() {
  const me = account.get().session?.user.id;
  if (!supabase || !me) return;
  // show the copy from last time straight away, then refresh it (offline: the copy is all we have)
  if (!friends.get().loaded) {
    try { const snap = JSON.parse(localStorage.getItem(snapKey()) || 'null'); if (snap) friends.set({ ...snap, loaded: true, savedAt: snap.at }); } catch { /* bad copy */ }
  }
  if (!navigator.onLine) { if (!friends.get().loaded) friends.set({ error: "You're offline. Friends load when you reconnect." }); return; }
  friends.set({ loading: true, error: '' });
  try {
    const [{ data: mine, error: e1 }, { data: rows, error: e2 }] = await Promise.all([
      supabase.from('profiles').select('friend_code').eq('id', me).maybeSingle(),
      supabase.from('friendships').select('requester,addressee,status,created_at')
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const list = (rows || []) as { requester: string; addressee: string; status: string; created_at: string }[];
    const ids = [...new Set(list.map(r => (r.requester === me ? r.addressee : r.requester)))];
    const nameOf = new Map<string, string | null>(), levelOf = new Map<string, number | null>();
    if (ids.length) {
      const { data: profs, error: e3 } = await supabase.from('profiles').select('id,display_name,badge_level').in('id', ids);
      if (e3) throw e3;
      for (const p of profs || []) { nameOf.set(p.id as string, (p.display_name as string) || null); levelOf.set(p.id as string, (p.badge_level as number) ?? null); }
    }
    const person = (r: (typeof list)[number]): Person => {
      const id = r.requester === me ? r.addressee : r.requester;
      return { id, name: nameOf.get(id) ?? null, since: new Date(r.created_at).getTime(), level: levelOf.get(id) ?? null };
    };
    const byName = (a: Person, b: Person) => (a.name || '').localeCompare(b.name || '');
    friends.set({
      loaded: true,
      myCode: (mine?.friend_code as string) || '',
      friends: list.filter(r => r.status === 'accepted').map(person).sort(byName),
      incoming: list.filter(r => r.status === 'pending' && r.addressee === me).map(person),
      outgoing: list.filter(r => r.status === 'pending' && r.requester === me).map(person)
    });
    try { const f = friends.get(); localStorage.setItem(snapKey(), JSON.stringify({ at: Date.now(), myCode: f.myCode, friends: f.friends, incoming: f.incoming, outgoing: f.outgoing })); friends.set({ savedAt: 0 }); } catch { /* storage full */ }
  } catch {
    if (friends.get().loaded) return;   // keep showing the saved copy
    friends.set({ error: navigator.onLine ? "Couldn't load your friends. Check your connection and try again." : "You're offline. Friends load when you reconnect." });
  } finally {
    friends.set({ loading: false });
  }
}

const RESULTS: Record<string, string> = {
  sent: 'Request sent. You’ll see each other’s walks once they accept.',
  accepted: 'You’re now friends!',
  already_sent: 'You already sent them a request.',
  already_friends: 'You’re already friends.',
  self: 'That’s your own code.',
  not_found: 'No one has that code. Check it and try again.'
};

/** Returns a message to show. Codes are case-insensitive; spaces and dashes are ignored. */
export async function addFriend(code: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Friends aren’t set up for this copy of Lakad.' };
  if (!navigator.onLine) return { ok: false, message: 'You’re offline. Add friends when you’re back online.' };
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 6) return { ok: false, message: 'Friend codes have 6 letters and numbers.' };
  const { data, error } = await supabase.rpc('send_friend_request', { code: clean });
  if (error) return { ok: false, message: 'Couldn’t send the request. Check your connection.' };
  const r = String(data);
  await loadFriends();
  if (r === 'accepted') void loadFeed();
  return { ok: r === 'sent' || r === 'accepted', message: RESULTS[r] || 'Something went wrong.' };
}

export async function respond(other: string, accept: boolean) {
  if (!supabase) return;
  const { error } = await supabase.rpc('respond_friend_request', { other, accept });
  if (error) throw error;
  await loadFriends();
  if (accept) void loadFeed();
}

/** Removes a friend, or cancels a request you sent */
export async function removeFriend(other: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('remove_friend', { other });
  if (error) throw error;
  await loadFriends();
  void loadFeed();
}

export async function blockPerson(other: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('block_user', { other });
  if (error) throw error;
  await loadFriends();
  void loadFeed();
}

export async function shareMyCode(code: string) {
  const text = `Add me on Lakad! My friend code is ${code}`;
  try {
    if (isNative) { await Share.share({ text }); return 'shared'; }
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
  } catch { /* cancelled */ return 'cancelled'; }
  await navigator.clipboard?.writeText(code);
  return 'copied';
}
