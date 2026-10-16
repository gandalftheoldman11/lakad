import { StatusBar, Style } from '@capacitor/status-bar';
import { data } from './data';
import { isNative } from './platform';
import type { Settings } from '../types';

const BG = { light: '#EDF0F5', dark: '#070E1C' };
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

/** light or dark, after following the phone when the theme is "System" */
export function effectiveTheme(s: Pick<Settings, 'theme'>): 'light' | 'dark' {
  if (s.theme === 'light' || s.theme === 'dark') return s.theme;
  return media?.matches ? 'dark' : 'light';
}

let last = '';
/** Applies Settings › Appearance to the page, the browser bar and the phone's status bar */
export function applyTheme(s: Settings) {
  const root = document.documentElement, mode = effectiveTheme(s);
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme; else delete root.dataset.theme;
  if (s.accent && s.accent !== 'blue') root.dataset.accent = s.accent; else delete root.dataset.accent;
  try { localStorage.setItem('lakad.look', JSON.stringify({ t: s.theme, a: s.accent })); } catch { /* private mode */ }
  const key = `${mode}`;
  if (key === last) return;
  last = key;
  // browser / home-screen app bar colour
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  const meta = document.createElement('meta'); meta.name = 'theme-color'; meta.content = BG[mode]; document.head.appendChild(meta);
  // phone status bar: light icons on dark, dark icons on light (keeps the clock and battery readable)
  if (isNative) {
    void StatusBar.setStyle({ style: mode === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: BG[mode] }).catch(() => {});   // Android only; ignored where not supported
  }
}

export function initTheme() {
  applyTheme(data.get().settings);
  data.subscribe(() => applyTheme(data.get().settings));
  // "System" follows the phone switching between light and dark
  media?.addEventListener('change', () => { last = ''; applyTheme(data.get().settings); });
}
