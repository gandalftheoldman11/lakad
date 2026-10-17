import { createStore } from './store';

export type DialogState =
  | { kind: null }
  | { kind: 'detail'; id: string }
  | { kind: 'share'; id: string }
  | { kind: 'form'; id?: string }
  | { kind: 'day' }
  | { kind: 'settings' }
  | { kind: 'finish' }
  | { kind: 'account' }
  | { kind: 'badges' }
  | { kind: 'levelup'; level: number }
  | { kind: 'plan' }
  | { kind: 'friend'; id: string }
  | { kind: 'streak' };

export const dialogs = createStore<{ d: DialogState }>({ d: { kind: null } });
export const openDialog = (d: DialogState) => dialogs.set({ d });
export const closeDialog = () => dialogs.set({ d: { kind: null } });
