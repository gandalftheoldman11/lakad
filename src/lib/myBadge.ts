import { useEffect, useMemo } from 'react';
import { useStore } from './store';
import { data, saveSettings } from './data';
import { badgeProgress, lifetimeSteps } from './badges';
import { stepsByDay } from './metrics';
import { account } from './account';
import { supabase } from './supabase';
import { openDialog, dialogs } from './dialogs';

/** Your current badge, kept up to date as you record activity */
export function useMyBadge() {
  const { acts, days, ready } = useStore(data);
  return useMemo(() => {
    const p = badgeProgress(lifetimeSteps(stepsByDay(acts, days)));
    return { ...p, computed: p.level, level: p.level, ready };
  }, [acts, days, ready]);
}

let lastSent = 0;
/**
 * Keeps the "best level" hold up to date, shows the level-up celebration once per new level,
 * and saves your level to your profile so friends can see it.
 */
export function useBadgeKeeper() {
  const b = useMyBadge();
  const { settings } = useStore(data);
  const acc = useStore(account);
  useEffect(() => {
    // wait until first-time setup is done, so a brand-new user still sees it
    if (!b.ready || !settings.onboarded) return;
    const seen = settings.badgeSeen ?? 1;
    if (b.level > seen) {
      void saveSettings({ badgeSeen: b.level });
      if (dialogs.get().d.kind === null) openDialog({ kind: 'levelup', level: b.level });
    }
  }, [b.ready, b.level, settings.badgeSeen, settings.onboarded]);
  useEffect(() => {
    const me = acc.session?.user.id;
    if (!supabase || !me || !b.ready || lastSent === b.level) return;
    lastSent = b.level;
    void supabase.from('profiles').update({ badge_level: b.level }).eq('id', me).then(({ error }) => { if (error) lastSent = 0; });
  }, [acc.session, b.ready, b.level]);
}
