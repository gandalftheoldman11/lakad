type P = { size?: number; color?: string };
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Logo = ({ size = 24 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d="M3 18c4-1 5-9 9-9s5 8 9 7" fill="none" stroke="var(--cobalt)" strokeWidth="3" strokeLinecap="round" /><circle cx="21" cy="16" r="2.8" fill="var(--mango)" /></svg>
);
export const IconToday = ({ size = 24 }: P) => <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M3 19c4-1 5-10 9-10s5 9 9 8" /><circle cx="12" cy="9" r="2.2" fill="currentColor" stroke="none" /></svg>;
export const IconProgress = ({ size = 24 }: P) => <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M5 20v-6M12 20V6M19 20v-9" /></svg>;
export const IconFeed = ({ size = 24 }: P) => <svg viewBox="0 0 24 24" width={size} height={size} {...base}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.6c2.4.2 4.3 2 5 5" /></svg>;
export const IconGear = ({ size = 24 }: P) => <svg viewBox="0 0 24 24" width={size} height={size} {...base}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
export const IconRecord = ({ size = 24 }: P) => <svg viewBox="0 0 24 24" width={size} height={size} {...base} strokeWidth={2.4}><path d="M7 17c3-1 3.5-7 6-7s3 5 4.5 4.5" /><circle cx="18" cy="14" r="1.6" fill="currentColor" stroke="none" /></svg>;
export const IconWalk = ({ size = 26, color = 'var(--cobalt)' }: P) => <svg viewBox="0 0 24 24" width={size} height={size} {...base} stroke={color}><circle cx="12" cy="4.5" r="2" /><path d="M12 8v6l-3 7M12 14l3 7M8 11l4-3 4 3" /></svg>;
export const IconRun = ({ size = 26, color = 'var(--cobalt)' }: P) => <svg viewBox="0 0 24 24" width={size} height={size} {...base} stroke={color}><circle cx="14" cy="4.5" r="2" /><path d="M6 21l3-5 3 2 2-6-3-2-3 3M14 12l3 3h4" /></svg>;
export const IconShare = ({ size = 20 }: P) => <svg viewBox="0 0 24 24" width={size} height={size} {...base}><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>;
export const IconPause = ({ size = 22 }: P) => <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>;
export const IconPlay = ({ size = 22 }: P) => <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>;
export const IconStop = ({ size = 20 }: P) => <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>;

/** expand to full screen */
export function IconExpand({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
}
/** back from full screen */
export function IconCollapse({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>;
}
/** re-center on your position */
export function IconLocate({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2.2" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
}
