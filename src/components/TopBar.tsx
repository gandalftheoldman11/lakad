import type { ReactNode } from 'react';
import { Logo } from './icons';
import { openDialog } from '../lib/dialogs';
import { useStore } from '../lib/store';
import { account } from '../lib/account';

export function TopBar({ title, action, compact }: { title?: string; action?: ReactNode; compact?: boolean }) {
  const acc = useStore(account);
  const initial = (acc.displayName || acc.session?.user.email || '?').trim().charAt(0).toUpperCase();
  return (
    <header className={`${compact ? 'mb-3' : 'mb-5'} flex items-center justify-between gap-3`}>
      <div className="flex items-center gap-2 text-[21px] font-black tracking-[-0.02em] [font-stretch:125%]"><Logo />{title ?? 'Lakad'}</div>
      <div className="flex items-center gap-3">
      {action}
      {acc.enabled && (
        acc.session ? (
          <button className="relative grid h-10 w-10 place-items-center rounded-full bg-cobalt-soft text-[15px] font-bold text-cobalt" onClick={() => openDialog({ kind: 'account' })} aria-label="Your account">
            {initial}
            {acc.syncing && <span className="dot-live absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-mango ring-2 ring-bg" aria-label="Syncing" />}
          </button>
        ) : (
          <button className="rounded-full bg-surface px-4 py-2 text-sm font-semibold shadow-[var(--lift)]" onClick={() => openDialog({ kind: 'account' })}>Sign in</button>
        )
      )}
      </div>
    </header>
  );
}
