
interface BadgeColors {
  rimTop: string; rimBottom: string; base: string; bevelTop: string; bevelBottom: string;
  faceLight: string; face: string; faceDark: string; footTop: string; footBottom: string; footShade: string;
  gemLight: string; gemDark: string; wingTop?: string; wingBottom?: string; spike?: string; spark?: string; glow?: string;
  /** colour of the element particles */
  fx: string;
  tab?: string; tabMid?: string; spikeDark?: string; wingMid?: string;
  /** inner panel, top to bottom */
  panelTop?: string; panelBottom?: string;
}
export type Element = 'frost' | 'ember' | 'leaf' | 'water' | 'storm' | 'wind' | 'fire' | 'cosmic';
export interface BadgeLevel { level: number; name: string; steps: number; element: Element; colors: BadgeColors }

/** Level = active days in the last 28. Rest days are fine: the top level needs 24 of 28. */
export const BADGES: BadgeLevel[] = [
  { level: 1, name: 'Starter', steps: 0, element: 'frost', colors: { panelTop: '#3F79B8', panelBottom: '#8CC4EE', rimTop: '#C9ECFF', rimBottom: '#7CC2EE', base: '#4F86B8', bevelTop: '#5FA5DE', bevelBottom: '#3E7FC2', faceLight: '#BFE6FF', face: '#6FB2EE', faceDark: '#3E7FC2', footTop: '#FFFFFF', footBottom: '#D6F0FF', footShade: '#2F6AA8', gemLight: '#FFFFFF', gemDark: '#8EC8F2', fx: '#E6F7FF', tab: '#B9D3EA', tabMid: '#E4F1FB' } },
  { level: 2, name: 'Stroller', steps: 20000, element: 'ember', colors: { panelTop: '#7A1220', panelBottom: '#A8202E', rimTop: '#FF7A6E', rimBottom: '#E2414A', base: '#9E1B2A', bevelTop: '#D8333F', bevelBottom: '#A81E2C', faceLight: '#FF6B6B', face: '#D62F3C', faceDark: '#9E1B2A', footTop: '#FFFFFF', footBottom: '#FFC6CA', footShade: '#8E1626', gemLight: '#FFD3CC', gemDark: '#E0545C', fx: '#FFB25C', tab: '#C42234', tabMid: '#FF6B6B' } },
  { level: 3, name: 'Walker', steps: 75000, element: 'leaf', colors: { panelTop: '#0F6B2A', panelBottom: '#1E9E3E', rimTop: '#62EB72', rimBottom: '#27C04A', base: '#127A31', bevelTop: '#22A63F', bevelBottom: '#178A35', faceLight: '#7DF07A', face: '#2BBD48', faceDark: '#158A34', footTop: '#FBFFE8', footBottom: '#C8FF6B', footShade: '#0F6E2C', gemLight: '#E8FF9C', gemDark: '#5FD12C', fx: '#9BF06A', tab: '#1D9E3D', tabMid: '#4FDB62' } },
  { level: 4, name: 'Hiker', steps: 200000, element: 'water', colors: { panelTop: '#16137E', panelBottom: '#2A2FBE', rimTop: '#7F86FF', rimBottom: '#4A4FEA', base: '#2422A6', bevelTop: '#3134C9', bevelBottom: '#2A2BB4', faceLight: '#5C9BFF', face: '#3A47DD', faceDark: '#2224A6', footTop: '#F2FBFF', footBottom: '#7FD8FF', footShade: '#1F1E96', gemLight: '#E3D6FF', gemDark: '#9C82F5', fx: '#9FE3FF', tab: '#3C3FD6', tabMid: '#6A70FA', spike: '#C9C4FF', spikeDark: '#8F86EE' } },
  { level: 5, name: 'Trailblazer', steps: 400000, element: 'storm', colors: { panelTop: '#4A0A80', panelBottom: '#7418B8', rimTop: '#E07BFF', rimBottom: '#B44BEE', base: '#5E148C', bevelTop: '#8A24CC', bevelBottom: '#7A1FBE', faceLight: '#C060FF', face: '#8E2BD6', faceDark: '#5E148C', footTop: '#FFF4FF', footBottom: '#F7B2FF', footShade: '#5E148C', gemLight: '#FFC9F4', gemDark: '#E04BC8', spike: '#FF8FE3', spikeDark: '#E058C4', spark: '#FFC2F1', fx: '#F7B5FF', tab: '#D06AE8', tabMid: '#F29BFF' } },
  { level: 6, name: 'Pathfinder', steps: 750000, element: 'wind', colors: { panelTop: '#2F55C9', panelBottom: '#6FB8FF', rimTop: '#7FCBFF', rimBottom: '#4D9BF2', base: '#1E50B0', bevelTop: '#3A6FE0', bevelBottom: '#2F5FD0', faceLight: '#8FD8FF', face: '#4A86EE', faceDark: '#5A3FD0', footTop: '#FFFFFF', footBottom: '#D6EEFF', footShade: '#1E3E9E', gemLight: '#EBDDFF', gemDark: '#A07DFF', wingTop: '#E6D9FF', wingMid: '#C6B0FA', wingBottom: '#A88EEE', spike: '#BFEFFF', spikeDark: '#7FC6F2', spark: '#DDF5FF', fx: '#E8F7FF', tab: '#3F86E8', tabMid: '#7FC7FF' } },
  { level: 7, name: 'Summit', steps: 1250000, element: 'fire', colors: { panelTop: '#7A1410', panelBottom: '#B42A1E', rimTop: '#FF8A68', rimBottom: '#EF4E3A', base: '#9E2414', bevelTop: '#C9302A', bevelBottom: '#B32720', faceLight: '#FF7350', face: '#E2452F', faceDark: '#A8241A', footTop: '#FFF8D6', footBottom: '#FFC52E', footShade: '#9C5A00', gemLight: '#FFE680', gemDark: '#F2A900', wingTop: '#FFD2BF', wingMid: '#FFA88A', wingBottom: '#F57A5E', spike: '#FFD166', spikeDark: '#F2A43A', spark: '#FFE7A0', glow: '#FF8A3D', fx: '#FFB13D', tab: '#D93A2B', tabMid: '#FF7A5E' } },
  { level: 8, name: 'Legend', steps: 2000000, element: 'cosmic', colors: { panelTop: '#0A4F22', panelBottom: '#13803A', rimTop: '#5BE37A', rimBottom: '#26B44E', base: '#0E6E2E', bevelTop: '#17923B', bevelBottom: '#128238', faceLight: '#4BDB6E', face: '#1A9A42', faceDark: '#0C6428', footTop: '#FFF8D6', footBottom: '#FFC52E', footShade: '#8A5A00', gemLight: '#E8FF9C', gemDark: '#5FD12C', wingTop: '#FFE27A', wingMid: '#FFC93C', wingBottom: '#F2A100', spike: '#FFC93C', spikeDark: '#F29A00', spark: '#FFE7A0', glow: '#FFD24D', fx: '#FFE27A', tab: '#1FA346', tabMid: '#55DB72' } }
];

/** a single day counts for at most this many steps toward your level (far above real walking; stops typed-in totals like 999,999) */
export const DAY_CAP = 60000;

/**
 * Your level comes from your total steps of all time: recorded walks and runs, your phone's step
 * counter, and totals you add yourself. Each day uses the higher of recorded or phone steps (never
 * both), and counts for at most DAY_CAP. Steps only add up, so your level never goes down.
 */
export function lifetimeSteps(map: Map<number, number>) {
  let total = 0;
  for (const v of map.values()) total += Math.min(Math.max(0, v), DAY_CAP);
  return total;
}

export const levelForSteps = (n: number) => [...BADGES].reverse().find(b => n >= b.steps)!.level;

export function badgeProgress(steps: number) {
  const L = levelForSteps(steps), next = BADGES[L];   // BADGES[L] is the next level (0-based)
  return { level: L, steps, next: next ?? null, toNext: next ? next.steps - steps : 0 };
}

/** 20,000 → "20k", 1,250,000 → "1.25M" */
export const shortSteps = (n: number) => n >= 1e6 ? `${+(n / 1e6).toFixed(2)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n);
