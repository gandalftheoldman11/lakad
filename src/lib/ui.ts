import { createStore } from './store';

export const ui = createStore({ toast: '' as string, toastKey: 0 });
let timer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  ui.set(s => ({ toast: msg, toastKey: s.toastKey + 1 }));
  clearTimeout(timer);
  timer = setTimeout(() => ui.set({ toast: '' }), 2600);
}
