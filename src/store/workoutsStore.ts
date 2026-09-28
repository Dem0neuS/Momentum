import { create } from 'zustand';
import { db } from '@/db/db';
import type { Exercise, TemplateExercise, Workout, WorkoutTemplate, WorkoutType } from '@/lib/types';
import { dayKey, formatDayKeyShort, parseDayKey } from '@/lib/dates';
import { nowIso, uid } from '@/lib/utils';
import { toastSimple, toastWithUndo } from '@/lib/toast';

function hasCardioMetrics(exercise: Partial<Exercise>): boolean {
  return (
    exercise.incline !== undefined ||
    exercise.speed !== undefined ||
    exercise.distance !== undefined ||
    exercise.duration !== undefined
  );
}

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
  /** Убрать запланированную тренировку на день отдыха; действие можно отменить из тоста. */
  cancelWorkout: (id: string) => void;
  toggleWorkout: (id: string) => void;
  duplicateWorkout: (id: string, date: string) => string;

  addExercise: (workoutId: string, partial?: Partial<Exercise>) => void;
  updateExercise: (id: string, patch: Partial<Exercise>) => void;
  deleteExercise: (id: string) => void;
  reorderExercises: (workoutId: string, order: string[]) => void;
  /** Атомарно заменяет список упражнений тренировки; используется при сохранении формы. */
  replaceExercises: (workoutId: string, exercises: Exercise[]) => void;

  saveTemplateFromWorkout: (workoutId: string, name?: string, exercisesOverride?: Exercise[]) => void;
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

  cancelWorkout: (id) => {
    const s = get();
    const workoutIndex = s.workouts.findIndex((x) => x.id === id);
    const workout = workoutIndex >= 0 ? s.workouts[workoutIndex] : undefined;
    if (!workout) return;

    const removedExercises = s.exercises.filter((e) => e.workoutId === id);
    set({
      workouts: s.workouts.filter((x) => x.id !== id),
      exercises: s.exercises.filter((e) => e.workoutId !== id),
    });
    void db.transaction('rw', [db.workouts, db.exercises], async () => {
      await db.workouts.delete(id);
      if (removedExercises.length) {
        await db.exercises.bulkDelete(removedExercises.map((e) => e.id));
      }
    });

    toastWithUndo(
      'Тренировка отменена',
      () => {
        const current = get();
        // Не восстанавливаем запись, если пользователь уже успел изменить этот же id.
        if (current.workouts.some((x) => x.id === workout.id)) return;
        const existingExerciseIds = new Set(current.exercises.map((e) => e.id));
        const exercisesToRestore = removedExercises.filter((e) => !existingExerciseIds.has(e.id));
        const workouts = [...current.workouts];
        workouts.splice(Math.min(workoutIndex, workouts.length), 0, workout);
        set({
          workouts,
          exercises: [...current.exercises, ...exercisesToRestore],
        });
        void db.transaction('rw', [db.workouts, db.exercises], async () => {
          await db.workouts.put(workout);
          if (exercisesToRestore.length) {
            await db.exercises.bulkPut(exercisesToRestore);
          }
        });
      },
      { description: `${formatDayKeyShort(workout.date)} · ${workout.name}` },
    );
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
      ...(partial?.incline !== undefined ? { incline: partial.incline } : {}),
      ...(partial?.speed !== undefined ? { speed: partial.speed } : {}),
      ...(partial?.distance !== undefined ? { distance: partial.distance } : {}),
      ...(partial?.duration !== undefined ? { duration: partial.duration } : {}),
      ...(partial?.restTime !== undefined ? { restTime: partial.restTime } : {}),
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

  replaceExercises: (workoutId, exercises) => {
    const s = get();
    const next = exercises.map((e, i) => ({ ...e, workoutId, order: i }));
    const previous = s.exercises.filter((e) => e.workoutId === workoutId);
    set({ exercises: [...s.exercises.filter((e) => e.workoutId !== workoutId), ...next] });
    void db.transaction('rw', [db.exercises], async () => {
      if (previous.length) await db.exercises.bulkDelete(previous.map((e) => e.id));
      if (next.length) await db.exercises.bulkPut(next);
    });
  },

  saveTemplateFromWorkout: (workoutId, name, exercisesOverride) => {
    const s = get();
    const w = s.workouts.find((x) => x.id === workoutId);
    const sourceExercises = exercisesOverride ?? s.exercises.filter((e) => e.workoutId === workoutId);
    const exs = sourceExercises
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(
        (e, i): TemplateExercise => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          ...(e.incline !== undefined ? { incline: e.incline } : {}),
          ...(e.speed !== undefined ? { speed: e.speed } : {}),
          ...(e.distance !== undefined ? { distance: e.distance } : {}),
          ...(e.duration !== undefined ? { duration: e.duration } : {}),
          ...(e.restTime !== undefined ? { restTime: e.restTime } : {}),
          note: e.note,
          order: i,
        }),
      );
    const tpl: WorkoutTemplate = {
      id: uid(),
      name: name?.trim() || w?.name || 'Шаблон',
      ...(w?.type ? { type: w.type } : {}),
      exercises: exs,
    };
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
      type: tpl.type ?? (tpl.exercises.some(hasCardioMetrics) ? 'cardio' : 'strength'),
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
      ...(e.incline !== undefined ? { incline: e.incline } : {}),
      ...(e.speed !== undefined ? { speed: e.speed } : {}),
      ...(e.distance !== undefined ? { distance: e.distance } : {}),
      ...(e.duration !== undefined ? { duration: e.duration } : {}),
      ...(e.restTime !== undefined ? { restTime: e.restTime } : {}),
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