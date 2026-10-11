import { createStore } from './store';

export type DialogState =
  | { kind: null }
  | { kind: 'detail'; id: string }
  | { kind: 'form'; id?: string }
  | { kind: 'day' }
  | { kind: 'settings' }
  | { kind: 'finish' }
  | { kind: 'account' };

export const dialogs = createStore<{ d: DialogState }>({ d: { kind: null } });
export const openDialog = (d: DialogState) => dialogs.set({ d });
export const closeDialog = () => dialogs.set({ d: { kind: null } });
