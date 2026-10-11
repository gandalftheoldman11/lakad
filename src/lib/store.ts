import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get(): T;
  set(update: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(l: () => void): () => void;
}
export function createStore<T extends object>(init: T): Store<T> {
  let state = init;
  const ls = new Set<() => void>();
  return {
    get: () => state,
    set(update) {
      const patch = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...patch };
      ls.forEach(l => l());
    },
    subscribe(l) { ls.add(l); return () => { ls.delete(l); }; }
  };
}
export function useStore<T extends object>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
/** Subscribe to one derived value; re-renders only when it changes (use primitives or stable references) */
export function useSel<T extends object, U>(store: Store<T>, sel: (s: T) => U): U {
  return useSyncExternalStore(store.subscribe, () => sel(store.get()), () => sel(store.get()));
}
