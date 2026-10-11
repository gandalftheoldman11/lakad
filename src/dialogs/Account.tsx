import { useState } from 'react';
import { useStore } from '../lib/store';
import { account, sendCode, setDisplayName, signOut, verifyCode } from '../lib/account';
import { syncNow } from '../lib/sync';
import { closeDialog } from '../lib/dialogs';
import { toast } from '../lib/ui';
import { Actions, Button, ErrorText, Field, SheetTitle } from '../components/ui';

export function AccountDialog() {
  const acc = useStore(account);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [name, setName] = useState(acc.displayName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr((e as Error).message || 'Something went wrong.'); } finally { setBusy(false); } };

  if (acc.session) return (
    <>
      <SheetTitle sub={acc.session.user.email}>Your account</SheetTitle>
      <Field label="Display name (shown on the feed)" id="aName"><input id="aName" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mill" /></Field>
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

  return (
    <>
      <SheetTitle sub="Sign in to back up your activities, use Lakad on more than one device, and join the feed. No password needed.">Sign in</SheetTitle>
      {stage === 'email' ? (
        <>
          <Field label="Email" id="aEmail"><input id="aEmail" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <ErrorText>{err}</ErrorText>
          <Actions>
            <Button variant="primary" disabled={busy || !/.+@.+\..+/.test(email)} onClick={() => run(async () => { await sendCode(email); setStage('code'); })}>{busy ? 'Sending…' : 'Email me a code'}</Button>
            <Button onClick={closeDialog}>Cancel</Button>
          </Actions>
        </>
      ) : (
        <>
          <p className="m-0 mt-3">We sent a code to <strong>{email}</strong>. It can take a minute to arrive.</p>
          <Field label="Code" id="aCode"><input id="aCode" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
          <ErrorText>{err}</ErrorText>
          <Actions>
            <Button variant="primary" disabled={busy || code.length < 6} onClick={() => run(async () => { await verifyCode(email, code); toast('Signed in'); closeDialog(); })}>{busy ? 'Checking…' : 'Sign in'}</Button>
            <Button disabled={busy} onClick={() => { setStage('email'); setCode(''); }}>Use another email</Button>
          </Actions>
        </>
      )}
    </>
  );
}
