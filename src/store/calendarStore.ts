import { create } from 'zustand';
import { db } from '@/db/db';
import type { CalendarNote } from '@/lib/types';
import { todayKey } from '@/lib/dates';
import { uid } from '@/lib/utils';
import { toastWithUndo } from '@/lib/toast';

interface CalendarState {
  loaded: boolean;
  notes: CalendarNote[];
  /**
   * Выбранная дата живёт в сторе, а не в состоянии страницы: при переходе
   * в «План» и обратно календарь размонтируется и без этого открывался бы
   * на «сегодня», теряя выбранный день.
   */
  selectedDate: string;

  load: (notes?: CalendarNote[]) => Promise<void>;
  reset: () => void;
  setSelectedDate: (date: string) => void;

  addNote: (date: string, text: string) => void;
  updateNote: (id: string, text: string) => void;
  deleteNote: (id: string) => void;
  notesFor: (date: string) => CalendarNote[];
}

/** Заметки дня в порядке добавления: так они читаются как запись в дневнике. */
function byCreatedAt(a: CalendarNote, b: CalendarNote): number {
  return a.createdAt.localeCompare(b.createdAt);
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  loaded: false,
  notes: [],
  selectedDate: todayKey(),

  load: async (notes) => {
    const rows = notes ?? (await db.calendarNotes.toArray());
    set({ loaded: true, notes: [...rows].sort(byCreatedAt) });
  },

  reset: () => set({ loaded: false, notes: [], selectedDate: todayKey() }),

  setSelectedDate: (date) => set({ selectedDate: date }),

  addNote: (date, text) => {
    const clean = text.trim();
    if (!clean) return;
    const note: CalendarNote = {
      id: uid(),
      date,
      text: clean,
      createdAt: new Date().toISOString(),
    };
    set({ notes: [...get().notes, note].sort(byCreatedAt) });
    void db.calendarNotes.put(note);
  },

  updateNote: (id, text) => {
    const clean = text.trim();
    if (!clean) return;
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    const next = { ...note, text: clean };
    set({ notes: get().notes.map((n) => (n.id === id ? next : n)) });
    void db.calendarNotes.put(next);
  },

  deleteNote: (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    set({ notes: get().notes.filter((n) => n.id !== id) });
    void db.calendarNotes.delete(id);
    toastWithUndo(
      'Заметка удалена',
      () => {
        useCalendarStore.setState((st) => ({
          notes: [...st.notes.filter((n) => n.id !== note.id), note].sort(byCreatedAt),
        }));
        void db.calendarNotes.put(note);
      },
      { description: note.text.length > 80 ? `${note.text.slice(0, 80)}…` : note.text },
    );
  },

  notesFor: (date) => get().notes.filter((n) => n.date === date).sort(byCreatedAt),
}));
