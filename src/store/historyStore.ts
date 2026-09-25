import { create } from 'zustand';
import type { UndoAction } from '@/lib/types';
import { uid } from '@/lib/utils';
import { useSettingsStore } from './settingsStore';

interface HistoryState {
  /** История действий сессии (в памяти) — для Ctrl+Z / кнопки «Отменить» */
  actions: UndoAction[];
  push: (action: Pick<UndoAction, 'label' | 'undo'> & Partial<Pick<UndoAction, 'type'>>) => string;
  /** Отменить последнее действие. Возвращает true, если действие найдено */
  undo: () => boolean;
  /** Отменить действие по id (кнопка «Отменить» в тосте) */
  undoById: (id: string) => boolean;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  actions: [],

  push: (action) => {
    const id = uid();
    const limit = useSettingsStore.getState().settings.undoHistoryLimit || 20;
    const entry: UndoAction = {
      id,
      type: action.type ?? 'generic',
      label: action.label,
      timestamp: Date.now(),
      undo: action.undo,
    };
    set((s) => ({ actions: [...s.actions.slice(-(limit - 1)), entry] }));
    return id;
  },

  undo: () => {
    const actions = get().actions;
    const last = actions[actions.length - 1];
    if (!last) return false;
    set({ actions: actions.slice(0, -1) });
    try {
      last.undo();
    } catch (e) {
      console.error('Undo failed', e);
    }
    return true;
  },

  undoById: (id) => {
    const actions = get().actions;
    const idx = actions.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    const entry = actions[idx];
    set({ actions: actions.filter((a) => a.id !== id) });
    try {
      entry.undo();
    } catch (e) {
      console.error('Undo failed', e);
    }
    return true;
  },

  clear: () => set({ actions: [] }),
}));