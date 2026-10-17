import { get, set } from 'idb-keyval';
import { createStore } from './store';
import type { LatLng, FootRoute } from './routing';

/** What the planner needs to reopen a route exactly as you left it */
export interface PlanDraft {
  target: number; custom: string; mode: 'loop' | 'draw'; start: LatLng | null;
  pts: LatLng[]; loop: boolean; back: boolean;
  loops: { heading: number; route: FootRoute; error: number }[]; pick: number;
}
/** A planned route: where you'll walk and the distance you're aiming for */
export interface Plan { id: string; target: number; coords: LatLng[]; distance: number; kind: 'loop' | 'drawn'; createdAt: number; draft?: PlanDraft }

/** `selected` is the plan the next recording will follow (remembered across app restarts) */
export const plans = createStore({ list: [] as Plan[], selected: null as Plan | null, loaded: false });

export async function loadPlans() {
  try {
    const list = ((await get('plans')) as Plan[] | undefined) ?? [];
    const id = (await get('planSelected')) as string | null | undefined;
    plans.set({ list, selected: list.find(p => p.id === id) ?? null, loaded: true });
  } catch { plans.set({ loaded: true }); }
}
export async function savePlan(p: Plan) {
  const list = [p, ...plans.get().list.filter(x => x.id !== p.id)].slice(0, 10);
  plans.set({ list, selected: p });
  try { await set('plans', list); await set('planSelected', p.id); } catch { /* storage full or blocked */ }
}
export const selectPlan = (p: Plan | null) => { plans.set({ selected: p }); void set('planSelected', p?.id ?? null).catch(() => {}); };

/* the route you're still working on in the planner, kept if you close the planner or the app */
const DRAFT = 'lakad.planDraft';
const DRAFT_DAYS = 1;   // an unfinished drawing is kept for a day; a chosen plan stays until you remove it
export function loadDraft(): PlanDraft | null {
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); return d && Date.now() - (d.at ?? 0) < DRAFT_DAYS * 86400000 ? d.draft : null; } catch { return null; }
}
export function saveDraft(d: PlanDraft) { try { localStorage.setItem(DRAFT, JSON.stringify({ at: Date.now(), draft: d })); } catch { /* storage full */ } }
export function clearDraft() { try { localStorage.removeItem(DRAFT); } catch { /* noop */ } }
