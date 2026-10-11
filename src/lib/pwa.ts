import { registerSW } from 'virtual:pwa-register';
import { createStore } from './store';

export const pwa = createStore({ updateReady: false });
let apply: ((reload?: boolean) => Promise<void>) | null = null;

export function initPwa() {
  apply = registerSW({
    immediate: true,
    onNeedRefresh() { pwa.set({ updateReady: true }); },
    // Check for a new version every hour while the app stays open
    onRegisteredSW(_url, reg) { if (reg) setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000); }
  });
}
export const applyUpdate = () => apply?.(true);
