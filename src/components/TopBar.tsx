import { IconGear, Logo } from './icons';
import { openDialog } from '../lib/dialogs';
import { useStore } from '../lib/store';
import { account } from '../lib/account';

export function TopBar() {
  const acc = useStore(account);
  return (
    <header className="mb-[18px] flex items-center justify-between">
      <div className="flex items-center gap-2 text-[22px] font-black [font-stretch:125%]"><Logo />Lakad</div>
      <div className="flex items-center gap-2">
        {acc.enabled && (
          <button className="rounded-full border border-line px-3.5 py-2 text-sm font-semibold" onClick={() => openDialog({ kind: 'account' })}>
            {acc.session ? (acc.syncing ? 'Syncing…' : acc.displayName || 'Account') : 'Sign in'}
          </button>
        )}
        <button className="grid h-10 w-10 place-items-center rounded-full border border-line" onClick={() => openDialog({ kind: 'settings' })} aria-label="Settings"><IconGear /></button>
      </div>
    </header>
  );
}
