import { get, set } from 'idb-keyval';
import { createStore } from './store';
import type { LatLng } from './routing';

/** A planned route: where you'll walk and the distance you're aiming for */
export interface Plan { id: string; target: number; coords: LatLng[]; distance: number; kind: 'loop' | 'drawn'; createdAt: number }

/** `selected` is the plan the next recording will follow */
export const plans = createStore({ list: [] as Plan[], selected: null as Plan | null, loaded: false });

export async function loadPlans() {
  try { const list = ((await get('plans')) as Plan[] | undefined) ?? []; plans.set({ list, loaded: true }); } catch { plans.set({ loaded: true }); }
}
export async function savePlan(p: Plan) {
  const list = [p, ...plans.get().list.filter(x => x.id !== p.id)].slice(0, 10);
  plans.set({ list, selected: p });
  try { await set('plans', list); } catch { /* storage full or blocked */ }
}
export const selectPlan = (p: Plan | null) => plans.set({ selected: p });
