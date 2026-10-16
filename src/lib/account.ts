import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { createStore } from './store';

export const account = createStore({
  enabled: !!supabase,
  session: null as Session | null,
  displayName: '' as string,
  syncing: false,
  lastSync: 0,
  syncError: '' as string
});

export async function loadProfile() {
  const s = account.get().session;
  if (!supabase || !s) return;
  const { data } = await supabase.from('profiles').select('display_name').eq('id', s.user.id).maybeSingle();
  account.set({ displayName: data?.display_name || '' });
}
export async function setDisplayName(name: string) {
  const s = account.get().session;
  if (!supabase || !s) return;
  const clean = name.trim().slice(0, 40);
  const { error } = await supabase.from('profiles').upsert({ id: s.user.id, display_name: clean || null });
  if (error) throw error;
  account.set({ displayName: clean });
}
/** Friendly wording for sign-in problems */
function explain(message: string) {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'That email already has an account. Sign in instead.';
  if (m.includes('password should') || m.includes('weak')) return 'Choose a longer password: at least 8 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Wait a minute and try again.';
  if (m.includes('fetch') || m.includes('network')) return 'Couldn’t reach the server. Check your connection.';
  return message;
}
/** New account with email and password (no email confirmation step) */
export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Accounts aren’t set up for this copy of Lakad.');
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(explain(error.message));
  // with "Confirm email" off you're signed in straight away; if it's ever turned on, say so
  if (!data.session) throw new Error('Account created. Check your email to confirm it, then sign in.');
}
export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Accounts aren’t set up for this copy of Lakad.');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(explain(error.message));
}
export async function signOut() { await supabase?.auth.signOut(); }
