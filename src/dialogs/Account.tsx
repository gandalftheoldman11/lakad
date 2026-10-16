import { useState } from 'react';
import { useStore } from '../lib/store';
import { account, setDisplayName, signIn, signOut, signUp } from '../lib/account';
import { syncNow } from '../lib/sync';
import { closeDialog } from '../lib/dialogs';
import { toast } from '../lib/ui';
import { Actions, Button, ErrorText, Field, Segmented, SheetTitle } from '../components/ui';

export function AccountDialog() {
  const acc = useStore(account);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState(acc.displayName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr((e as Error).message || 'Something went wrong.'); } finally { setBusy(false); } };

  if (acc.session) return (
    <>
      <SheetTitle sub={acc.session.user.email}>Your account</SheetTitle>
      <Field label="Your name (shown to your friends)" id="aName"><input id="aName" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mill" /></Field>
      <p className="m-0 mt-3 text-sm text-muted">
        {acc.syncing ? 'Syncing…' : acc.syncError || (acc.lastSync ? `Synced at ${new Date(acc.lastSync).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.` : 'Not synced yet.')}
      </p>
      <ErrorText>{err}</ErrorText>
      <Actions>
        <Button variant="primary" disabled={busy} onClick={() => run(async () => { await setDisplayName(name); toast('Name saved'); closeDialog(); })}>Save name</Button>
        <Button disabled={busy || acc.syncing} onClick={() => void syncNow()}>Sync now</Button>
      </Actions>
      <Actions><Button variant="danger" disabled={busy} onClick={() => run(async () => { await syncNow(); await signOut(); toast('Signed out. Your data stays on this device.'); closeDialog(); })}>Sign out</Button></Actions>
    </>
  );

  const okEmail = /.+@.+\..+/.test(email.trim()), okPass = password.length >= 8;
  const go = () => run(async () => {
    if (mode === 'signup') { await signUp(email, password); toast('Account created. You’re signed in.'); }
    else { await signIn(email, password); toast('Signed in'); }
    closeDialog();
  });
  return (
    <>
      <SheetTitle sub="Back up your activities, use Lakad on more than one phone, and add friends.">{mode === 'signup' ? 'Create your account' : 'Sign in'}</SheetTitle>
      <div className="mt-4 flex justify-center">
        <Segmented value={mode} onChange={m => { setMode(m); setErr(''); }} label="Sign in or create an account" options={[['signin', 'Sign in'], ['signup', 'Create account']]} />
      </div>
      <form onSubmit={e => { e.preventDefault(); if (okEmail && okPass && !busy) void go(); }}>
        <Field label="Email" id="aEmail"><input id="aEmail" type="email" autoComplete="email" inputMode="email" autoCapitalize="off" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label={mode === 'signup' ? 'Choose a password (8+ characters)' : 'Password'} id="aPass">
          <div className="relative">
            <input id="aPass" type={show ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="pr-16" />
            <button type="button" onClick={() => setShow(v => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 text-[14px] font-semibold text-cobalt" aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </Field>
        {mode === 'signup' && <p className="m-0 mt-2 text-[13px] text-muted">Use an email you’ll remember: it’s how you sign in on a new phone. Friends only ever see your name, not your email.</p>}
        <ErrorText>{err}</ErrorText>
        <Actions>
          <Button type="submit" variant="primary" disabled={busy || !okEmail || !okPass}>{busy ? (mode === 'signup' ? 'Creating…' : 'Signing in…') : mode === 'signup' ? 'Create account' : 'Sign in'}</Button>
          <Button type="button" onClick={closeDialog}>Cancel</Button>
        </Actions>
      </form>
    </>
  );
}
