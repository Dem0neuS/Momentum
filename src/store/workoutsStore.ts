import { create } from 'zustand';
import { db } from '@/db/db';
import type { Exercise, TemplateExercise, Workout, WorkoutTemplate, WorkoutType } from '@/lib/types';
import { dayKey, parseDayKey } from '@/lib/dates';
import { nowIso, uid } from '@/lib/utils';
import { toastSimple, toastWithUndo } from '@/lib/toast';

export interface WorkoutInput {
  name: string;
  date: string;
  type: WorkoutType;
  notes?: string;
}

interface WorkoutsState {
  loaded: boolean;
  workouts: Workout[];
  exercises: Exercise[];
  templates: WorkoutTemplate[];

  load: (data?: { workouts: Workout[]; exercises: Exercise[]; workoutTemplates: WorkoutTemplate[] }) => Promise<void>;
  reset: () => void;

  addWorkout: (input: WorkoutInput) => string;
  updateWorkout: (id: string, patch: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  toggleWorkout: (id: string) => void;
  duplicateWorkout: (id: string, date: string) => string;

  addExercise: (workoutId: string, partial?: Partial<Exercise>) => void;
  updateExercise: (id: string, patch: Partial<Exercise>) => void;
  deleteExercise: (id: string) => void;
  reorderExercises: (workoutId: string, order: string[]) => void;

  saveTemplateFromWorkout: (workoutId: string, name?: string) => void;
  applyTemplate: (templateId: string, date: string) => string | null;
  deleteTemplate: (templateId: string) => void;

  copyWeek: (fromStart: string, toStart: string) => void;
  workoutsForDate: (date: string) => Workout[];
}

export const useWorkoutsStore = create<WorkoutsState>((set, get) => ({
  loaded: false,
  workouts: [],
  exercises: [],
  templates: [],

  load: async (data) => {
    if (!data) {
      const [workouts, exercises, workoutTemplates] = await Promise.all([
        db.workouts.toArray(),
        db.exercises.toArray(),
        db.workoutTemplates.toArray(),
      ]);
      data = { workouts, exercises, workoutTemplates };
    }
    set({
      loaded: true,
      workouts: data.workouts,
      exercises: data.exercises,
      templates: data.workoutTemplates,
    });
  },

  reset: () => set({ loaded: false, workouts: [], exercises: [], templates: [] }),

  addWorkout: (input) => {
    const id = uid();
    const w: Workout = {
      id,
      name: input.name.trim() || 'Тренировка',
      date: input.date,
      type: input.type,
      notes: input.notes ?? '',
      completed: false,
    };
    set((s) => ({ workouts: [...s.workouts, w] }));
    void db.workouts.put(w);
    return id;
  },

  updateWorkout: (id, patch) => {
    const s = get();
    const w = s.workouts.find((x) => x.id === id);
    if (!w) return;
    const next = { ...w, ...patch };
    set({ workouts: s.workouts.map((x) => (x.id === id ? next : x)) });
    void db.workouts.put(next);
  },

  deleteWorkout: (id) => {
    const s = get();
    set({ workouts: s.workouts.filter((x) => x.id !== id) });
    set({ exercises: s.exercises.filter((e) => e.workoutId !== id) });
    void db.workouts.delete(id);
    void db.exercises.bulkDelete(s.exercises.filter((e) => e.workoutId === id).map((e) => e.id));
  },

  toggleWorkout: (id) => {
    const s = get();
    const w = s.workouts.find((x) => x.id === id);
    if (!w) return;
    const next = { ...w, completed: !w.completed };
    set({ workouts: s.workouts.map((x) => (x.id === id ? next : x)) });
    void db.workouts.put(next);
    toastWithUndo(next.completed ? 'Тренировка отмечена' : 'Отметка снята', () => {
      const cur = get().workouts.find((x) => x.id === id);
      if (!cur) return;
      const restored = { ...cur, completed: !cur.completed };
      set({ workouts: get().workouts.map((x) => (x.id === id ? restored : x)) });
      void db.workouts.put(restored);
    }, { description: next.name });
  },

  duplicateWorkout: (id, date) => {
    const s = get();
    const w = s.workouts.find((x) => x.id === id);
    if (!w) return '';
    const newId = s.addWorkout({
      name: w.name,
      date,
      type: w.type,
      notes: w.notes,
    });
    const exs = s.exercises
      .filter((e) => e.workoutId === id)
      .sort((a, b) => a.order - b.order)
      .map((e) => ({ ...e, id: uid(), workoutId: newId }));
    if (exs.length) {
      set((st) => ({ exercises: [...st.exercises, ...exs] }));
      void db.exercises.bulkPut(exs);
    }
    return newId;
  },

  addExercise: (workoutId, partial) => {
    const s = get();
    const order = s.exercises.filter((e) => e.workoutId === workoutId).length;
    const ex: Exercise = {
      id: uid(),
      workoutId,
      name: partial?.name?.trim() || 'Новое упражнение',
      sets: partial?.sets ?? 3,
      reps: partial?.reps ?? 10,
      weight: partial?.weight ?? 0,
      note: partial?.note ?? '',
      order,
    };
    set({ exercises: [...s.exercises, ex] });
    void db.exercises.put(ex);
  },

  updateExercise: (id, patch) => {
    const s = get();
    const ex = s.exercises.find((e) => e.id === id);
    if (!ex) return;
    const next = { ...ex, ...patch };
    set({ exercises: s.exercises.map((e) => (e.id === id ? next : e)) });
    void db.exercises.put(next);
  },

  deleteExercise: (id) => {
    const s = get();
    set({ exercises: s.exercises.filter((e) => e.id !== id) });
    void db.exercises.delete(id);
  },

  reorderExercises: (workoutId, order) => {
    const s = get();
    const map = new Map(order.map((id, i) => [id, i]));
    const next = s.exercises
      .filter((e) => e.workoutId === workoutId)
      .map((e) => ({ ...e, order: map.get(e.id) ?? e.order }));
    set({ exercises: s.exercises.map((e) => next.find((n) => n.id === e.id) ?? e) });
    void db.exercises.bulkPut(next);
  },

  saveTemplateFromWorkout: (workoutId, name) => {
    const s = get();
    const w = s.workouts.find((x) => x.id === workoutId);
    const exs = s.exercises
      .filter((e) => e.workoutId === workoutId)
      .sort((a, b) => a.order - b.order)
      .map((e, i): TemplateExercise => ({ name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, note: e.note, order: i }));
    const tpl: WorkoutTemplate = { id: uid(), name: name?.trim() || w?.name || 'Шаблон', exercises: exs };
    set({ templates: [...s.templates, tpl] });
    void db.workoutTemplates.put(tpl);
    toastSimple('Шаблон сохранён', tpl.name);
  },

  applyTemplate: (templateId, date) => {
    const s = get();
    const tpl = s.templates.find((t) => t.id === templateId);
    if (!tpl) return null;
    const id = uid();
    const w: Workout = {
      id,
      name: tpl.name,
      date,
      type: 'strength',
      notes: '',
      completed: false,
    };
    const exs: Exercise[] = tpl.exercises.map((e, i) => ({
      id: uid(),
      workoutId: id,
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      weight: e.weight,
      note: e.note ?? '',
      order: i,
    }));
    set((st) => ({
      workouts: [...st.workouts, w],
      exercises: [...st.exercises, ...exs],
    }));
    void db.workouts.put(w);
    if (exs.length) void db.exercises.bulkPut(exs);
    return id;
  },

  deleteTemplate: (templateId) => {
    const s = get();
    set({ templates: s.templates.filter((t) => t.id !== templateId) });
    void db.workoutTemplates.delete(templateId);
  },

  copyWeek: (fromStart, toStart) => {
    const s = get();
    const s1 = parseDayKey(fromStart);
    const s2 = parseDayKey(toStart);
    let copied = 0;
    for (let i = 0; i < 7; i++) {
      const from = dayKey(new Date(s1.getFullYear(), s1.getMonth(), s1.getDate() + i));
      const to = dayKey(new Date(s2.getFullYear(), s2.getMonth(), s2.getDate() + i));
      for (const w of s.workouts.filter((x) => x.date === from)) {
        s.duplicateWorkout(w.id, to);
        copied++;
      }
    }
    if (copied > 0) toastSimple('Неделя скопирована', `Перенесено тренировок: ${copied}`);
    else toastSimple('Нечего копировать', 'В этой неделе нет тренировок');
  },

  workoutsForDate: (date) => get().workouts.filter((w) => w.date === date),
}));

export function exerciseCount(store: WorkoutsState, workoutId: string): number {
  return store.exercises.filter((e) => e.workoutId === workoutId).length;
}