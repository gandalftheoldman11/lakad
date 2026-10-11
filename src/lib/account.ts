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
export async function sendCode(email: string) {
  if (!supabase) throw new Error('Sign-in is not set up');
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw error;
}
export async function verifyCode(email: string, token: string) {
  if (!supabase) throw new Error('Sign-in is not set up');
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  if (error) throw error;
}
export async function signOut() { await supabase?.auth.signOut(); }
