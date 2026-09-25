import { create } from 'zustand';
import { db } from '@/db/db';
import type {
  Category,
  Habit,
  HabitLog,
  HabitStatus,
  StreakInfo,
  Subcategory,
} from '@/lib/types';
import { computeStreaks } from '@/lib/streak';
import { addDays, dayKey, parseDayKey, startOfMonth } from '@/lib/dates';
import { nowIso, uid } from '@/lib/utils';
import { toastSimple, toastWithActions, toastWithUndo } from '@/lib/toast';
import { useSettingsStore } from './settingsStore';

export interface HabitInput {
  name: string;
  icon: string;
  color: string;
  categoryId: ID | null;
  subcategoryId: ID | null;
  frequency: Habit['frequency'];
  targetCount: number;
  counterUnit: string;
  allowSkips: boolean;
}

type ID = string;

interface HabitsState {
  loaded: boolean;
  categories: Category[];
  subcategories: Subcategory[];
  habits: Habit[];
  logs: HabitLog[];
  streaks: Record<string, StreakInfo>;

  load: (data?: {
    categories: Category[];
    subcategories: Subcategory[];
    habits: Habit[];
    habitLogs: HabitLog[];
    streaks: StreakInfo[];
  }) => Promise<void>;
  reset: () => void;

  addCategory: (input: { name: string; icon: string; color: string }) => void;
  updateCategory: (id: ID, patch: Partial<Category>) => void;
  deleteCategory: (id: ID) => void;
  addSubcategory: (input: { categoryId: ID; name: string; icon: string; color: string }) => void;
  updateSubcategory: (id: ID, patch: Partial<Subcategory>) => void;
  deleteSubcategory: (id: ID) => void;

  addHabit: (input: HabitInput) => void;
  updateHabit: (id: ID, patch: Partial<Habit>) => void;
  archiveHabit: (id: ID) => void;
  moveHabit: (habitId: ID, categoryId: ID | null, subcategoryId: ID | null) => void;

  getLog: (habitId: ID, date: string) => HabitLog | undefined;
  toggleHabit: (habitId: ID, date: string) => void;
  setFull: (habitId: ID, date: string, mark: boolean) => void;
  incrementHabit: (habitId: ID, date: string) => void;
  decrementHabit: (habitId: ID, date: string) => void;
  setHabitValue: (habitId: ID, date: string, value: number) => void;
  clearLog: (habitId: ID, date: string) => void;
  skipHabit: (habitId: ID, date: string, reason?: string) => void;
  setLogStatus: (habitId: ID, date: string, status: 'done' | 'skipped' | 'none', reason?: string) => void;

  /** Проверка прерванных серий: вызывается при загрузке и смене дня */
  recheckStreaksOnDayChange: () => void;
  /** Пересчитать streak одной привычки (после импорта/восстановления) */
  refreshStreakFor: (habitId: ID) => void;
}

const NO_CATEGORY = '_none';

function upsertLog(logs: HabitLog[], log: HabitLog): HabitLog[] {
  const idx = logs.findIndex((l) => l.id === log.id);
  if (idx === -1) return [...logs, log];
  const next = [...logs];
  next[idx] = log;
  return next;
}

/** Отслеживание уже показанных уведомлений о прерванной серии (в рамках сессии) */
const interruptedNotified = new Set<string>();

export const useHabitsStore = create<HabitsState>((set, get) => ({
  loaded: false,
  categories: [],
  subcategories: [],
  habits: [],
  logs: [],
  streaks: {},

  load: async (data) => {
    if (!data) {
      const [categories, subcategories, habits, habitLogs, streaks] = await Promise.all([
        db.categories.toArray(),
        db.subcategories.toArray(),
        db.habits.toArray(),
        db.habitLogs.toArray(),
        db.streaks.toArray(),
      ]);
      data = { categories, subcategories, habits, habitLogs, streaks };
    }

    const storedStreaks = new Map(data.streaks.map((s) => [s.habitId, s]));
    const maxSkips = useSettingsStore.getState().settings.skipPolicy.maxConsecutiveSkips;
    const today = todayKey();
    const streaks: Record<string, StreakInfo> = {};
    const toPersist: StreakInfo[] = [];

    for (const habit of data.habits) {
      const logs = data.habitLogs.filter((l) => l.habitId === habit.id);
      const res = computeStreaks(habit, logs, new Date(), maxSkips);
      const prev = storedStreaks.get(habit.id);
      const streak: StreakInfo = {
        habitId: habit.id,
        current: res.current,
        best: Math.max(res.best, prev?.best ?? 0),
        totalDone: res.totalDone,
        lastResetAt: prev?.lastResetAt ?? null,
      };
      streaks[habit.id] = streak;
      toPersist.push(streak);

      // Серия прервалась из-за пропущенных дней (2+ дня без отметки)
      if (
        prev &&
        prev.current >= 1 &&
        res.current === 0 &&
        !habit.archived &&
        habit.createdAt < addDays(new Date(), -1).toISOString().slice(0, 10) &&
        !interruptedNotified.has(habit.id)
      ) {
        interruptedNotified.add(habit.id);
        showInterruptedToast(habit);
      }
    }
    if (toPersist.length > 0) void db.streaks.bulkPut(toPersist);

    set({
      loaded: true,
      categories: data.categories,
      subcategories: data.subcategories,
      habits: data.habits,
      logs: data.habitLogs,
      streaks,
    });
  },

  reset: () =>
    set({
      loaded: false,
      categories: [],
      subcategories: [],
      habits: [],
      logs: [],
      streaks: {},
    }),

  // ---------- Категории ----------
  addCategory: (input) => {
    const s = get();
    const cat: Category = { id: uid(), ...input, order: s.categories.length };
    set({ categories: [...s.categories, cat] });
    void db.categories.put(cat);
  },

  updateCategory: (id, patch) => {
    const s = get();
    const cat = s.categories.find((c) => c.id === id);
    if (!cat) return;
    const next = { ...cat, ...patch };
    set({ categories: s.categories.map((c) => (c.id === id ? next : c)) });
    void db.categories.put(next);
  },

  deleteCategory: (id) => {
    const s = get();
    const kept = s.categories.filter((c) => c.id !== id);
    const removedSubs = s.subcategories.filter((sc) => sc.categoryId === id);
    set({
      categories: kept,
      subcategories: s.subcategories.filter((sc) => sc.categoryId !== id),
      habits: s.habits.map((h) =>
        h.categoryId === id
          ? { ...h, categoryId: null, subcategoryId: null }
          : h,
      ),
    });
    void db.categories.delete(id);
    void db.subcategories.bulkDelete(removedSubs.map((sc) => sc.id));
    void db.habits.bulkPut(
      s.habits.filter((h) => h.categoryId === id).map((h) => ({ ...h, categoryId: null, subcategoryId: null })),
    );
  },

  addSubcategory: (input) => {
    const s = get();
    const sub: Subcategory = { id: uid(), ...input, order: s.subcategories.length };
    set({ subcategories: [...s.subcategories, sub] });
    void db.subcategories.put(sub);
  },

  updateSubcategory: (id, patch) => {
    const s = get();
    const sub = s.subcategories.find((x) => x.id === id);
    if (!sub) return;
    const next = { ...sub, ...patch };
    set({ subcategories: s.subcategories.map((x) => (x.id === id ? next : x)) });
    void db.subcategories.put(next);
  },

  deleteSubcategory: (id) => {
    const s = get();
    set({
      subcategories: s.subcategories.filter((x) => x.id !== id),
      habits: s.habits.map((h) => (h.subcategoryId === id ? { ...h, subcategoryId: null } : h)),
    });
    void db.subcategories.delete(id);
    void db.habits.bulkPut(s.habits.filter((h) => h.subcategoryId === id).map((h) => ({ ...h, subcategoryId: null })));
  },

  // ---------- Привычки ----------
  addHabit: (input) => {
    const s = get();
    const habit: Habit = {
      id: uid(),
      ...input,
      createdAt: todayKey(),
      archived: false,
    };
    set({ habits: [...s.habits, habit] });
    void db.habits.put(habit);
  },

  updateHabit: (id, patch) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === id);
    if (!habit) return;
    const next = { ...habit, ...patch };
    set({ habits: s.habits.map((h) => (h.id === id ? next : h)) });
    void db.habits.put(next);
  },

  archiveHabit: (id) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === id);
    if (!habit) return;
    const next = { ...habit, archived: !habit.archived };
    set({ habits: s.habits.map((h) => (h.id === id ? next : h)) });
    void db.habits.put(next);
  },

  moveHabit: (habitId, categoryId, subcategoryId) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const prevCat = habit.categoryId;
    const prevSub = habit.subcategoryId;
    const next = { ...habit, categoryId, subcategoryId };
    set({ habits: s.habits.map((h) => (h.id === habitId ? next : h)) });
    void db.habits.put(next);
    toastWithUndo('Привычка перемещена', () => {
      const cur = get().habits.find((h) => h.id === habitId);
      if (!cur) return;
      const restored = { ...cur, categoryId: prevCat, subcategoryId: prevSub };
      set({ habits: get().habits.map((h) => (h.id === habitId ? restored : h)) });
      void db.habits.put(restored);
    });
  },

  // ---------- Логи и отметки ----------
  getLog: (habitId, date) => get().logs.find((l) => l.habitId === habitId && l.date === date),

  toggleHabit: (habitId, date) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit || habit.archived) return;
    const lastById = s.getLog(habitId, date) ?? null;

    if (lastById?.status === 'done') {
      const next: HabitLog = {
        ...lastById,
        status: 'none',
        value: 0,
        completed: false,
        updatedAt: nowIso(),
      };
      toastWithUndo('Отметка снята', () => restoreLog( lastById, habitId, date), {
        description: habit.name,
      });
      applyLog( next);
      return;
    }

    const target = habit.targetCount || 1;
    const unit = habit.counterUnit ? ` ${habit.counterUnit}` : '';
    const next: HabitLog = {
      id: lastById?.id ?? uid(),
      habitId,
      date,
      value: habit.targetCount > 0 ? target : 1,
      completed: true,
      status: 'done',
      updatedAt: nowIso(),
    };
    toastWithUndo('Привычка отмечена', () => restoreLog( lastById, habitId, date), {
      description: habit.targetCount > 0 ? `${habit.name}: ${target} из ${target}${unit}` : habit.name,
    });
    applyLog( next);
  },

  setFull: (habitId, date, mark) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const prev = s.getLog(habitId, date) ?? null;
    if (mark) {
      const next: HabitLog = {
        id: prev?.id ?? uid(),
        habitId,
        date,
        value: habit.targetCount > 0 ? habit.targetCount : 1,
        completed: true,
        status: 'done',
        updatedAt: nowIso(),
      };
      toastWithUndo('Привычка отмечена', () => restoreLog( prev, habitId, date), {
        description: habit.name,
      });
      applyLog( next);
    } else {
      const next: HabitLog = {
        id: prev?.id ?? uid(),
        habitId,
        date,
        value: 0,
        completed: false,
        status: 'none',
        updatedAt: nowIso(),
      };
      toastWithUndo('Отметка снята', () => restoreLog( prev, habitId, date), {
        description: habit.name,
      });
      applyLog( next);
    }
  },

  incrementHabit: (habitId, date) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const prev = s.getLog(habitId, date) ?? null;
    const value = (prev?.value ?? 0) + 1;
    const target = habit.targetCount || 1;
    const status: HabitStatus = value >= target ? 'done' : 'none';
    const next: HabitLog = {
      id: prev?.id ?? uid(),
      habitId,
      date,
      value,
      completed: status === 'done',
      status,
      updatedAt: nowIso(),
    };
    toastWithUndo('Счётчик увеличен', () => restoreLog( prev, habitId, date), {
      description: habit.name,
    });
    applyLog( next);
  },

  decrementHabit: (habitId, date) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const prev = s.getLog(habitId, date) ?? null;
    const value = Math.max(0, (prev?.value ?? 0) - 1);
    const target = habit.targetCount || 1;
    const status: HabitStatus = value >= target ? 'done' : 'none';
    const next: HabitLog = {
      id: prev?.id ?? uid(),
      habitId,
      date,
      value,
      completed: status === 'done',
      status,
      updatedAt: nowIso(),
    };
    toastWithUndo('Счётчик уменьшен', () => restoreLog( prev, habitId, date), {
      description: habit.name,
    });
    applyLog( next);
  },

  setHabitValue: (habitId, date, value) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const prev = s.getLog(habitId, date) ?? null;
    const v = Math.max(0, Math.round(value));
    const target = habit.targetCount || 1;
    const status: HabitStatus = v >= target ? 'done' : 'none';
    const next: HabitLog = {
      id: prev?.id ?? uid(),
      habitId,
      date,
      value: v,
      completed: status === 'done',
      status,
      updatedAt: nowIso(),
    };
    toastWithUndo('Значение обновлено', () => restoreLog( prev, habitId, date), {
      description: habit.name,
    });
    applyLog( next);
  },

  clearLog: (habitId, date) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const prev = s.getLog(habitId, date) ?? null;
    if (!prev) return;
    toastWithUndo('Запись очищена', () => restoreLog( prev, habitId, date), {
      description: habit.name,
    });
    applyLog( {
      ...prev,
      value: 0,
      completed: false,
      status: 'none',
      skipReason: undefined,
      updatedAt: nowIso(),
    });
  },

  skipHabit: (habitId, date, reason) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (!habit.allowSkips) {
      toastSimple('Пропуски отключены', 'Включите «Разрешить пропуски» в настройках привычки');
      return;
    }
    const prev = s.getLog(habitId, date) ?? null;

    if (prev?.status === 'skipped') {
      // Снять пропуск
      toastWithUndo('Пропуск снят', () => restoreLog( prev, habitId, date), {
        description: habit.name,
      });
      applyLog( { ...prev, status: 'none', value: 0, completed: false, updatedAt: nowIso() });
      return;
    }

    // Лимит пропусков в месяц
    const policy = useSettingsStore.getState().settings.skipPolicy;
    if (policy.maxSkipsPerMonth > 0) {
      const monthStart = dayKey(startOfMonth(parseDayKey(date)));
      const monthSkips = s.logs.filter(
        (l) => l.habitId === habitId && l.status === 'skipped' && l.date >= monthStart,
      ).length;
      if (monthSkips >= policy.maxSkipsPerMonth) {
        toastSimple('Лимит пропусков на месяц исчерпан', `В этом месяце уже ${monthSkips} пропусков`);
        return;
      }
    }

    const next: HabitLog = {
      id: prev?.id ?? uid(),
      habitId,
      date,
      value: 0,
      completed: false,
      status: 'skipped',
      skipReason: reason,
      updatedAt: nowIso(),
    };
    toastWithUndo('Пропуск дня', () => restoreLog( prev, habitId, date), {
      description: reason ? `${habit.name} — ${reason}` : habit.name,
      icon: '🚫',
    });
    applyLog( next);
  },

  setLogStatus: (habitId, date, status, reason) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (status === 'done') {
      s.setFull(habitId, date, true);
    } else if (status === 'skipped') {
      s.skipHabit(habitId, date, reason);
    } else {
      s.clearLog(habitId, date);
    }
  },

  recheckStreaksOnDayChange: () => {
    const s = get();
    const maxSkips = useSettingsStore.getState().settings.skipPolicy.maxConsecutiveSkips;
    const updated: StreakInfo[] = [];
    for (const habit of s.habits) {
      if (habit.archived) continue;
      const logs = s.logs.filter((l) => l.habitId === habit.id);
      const res = computeStreaks(habit, logs, new Date(), maxSkips);
      const prev = s.streaks[habit.id];
      if (!prev) continue;
      if (prev.current >= 1 && res.current === 0 && !interruptedNotified.has(habit.id)) {
        interruptedNotified.add(habit.id);
        showInterruptedToast(habit);
      }
      if (res.current >= 1) interruptedNotified.delete(habit.id);
      const streak: StreakInfo = {
        habitId: habit.id,
        current: res.current,
        best: Math.max(res.best, prev.best),
        totalDone: res.totalDone,
        lastResetAt: prev.lastResetAt ?? null,
      };
      updated.push(streak);
    }
    if (updated.length === 0) return;
    set((st) => ({
      streaks: { ...st.streaks, ...Object.fromEntries(updated.map((u) => [u.habitId, u])) },
    }));
    void db.streaks.bulkPut(updated);
  },

  refreshStreakFor: (habitId) => {
    const s = get();
    const habit = s.habits.find((h) => h.id === habitId);
    if (!habit || habit.archived) return;
    const maxSkips = useSettingsStore.getState().settings.skipPolicy.maxConsecutiveSkips;
    const logs = s.logs.filter((l) => l.habitId === habitId);
    const res = computeStreaks(habit, logs, new Date(), maxSkips);
    const prev = s.streaks[habitId];
    // Уведомление о разрыве серии (2+ дня без отметки или 2 пропуска подряд)
    if (prev && prev.current >= 1 && res.current === 0 && !interruptedNotified.has(habitId)) {
      interruptedNotified.add(habitId);
      showInterruptedToast(habit);
    }
    if (res.current >= 1) interruptedNotified.delete(habitId);
    const streak: StreakInfo = {
      habitId,
      current: res.current,
      best: Math.max(res.best, prev?.best ?? 0),
      totalDone: res.totalDone,
      lastResetAt: prev?.lastResetAt ?? null,
    };
    set((st) => ({ streaks: { ...st.streaks, [habitId]: streak } }));
    void db.streaks.put(streak);
  },
}));

export const NO_CATEGORY_MARK = NO_CATEGORY;

// ---------- Внутренние помощники ----------

function todayKey(): string {
  return dayKey(new Date());
}

function applyLog(log: HabitLog): void {
  if (log.status === 'none' && log.value === 0) {
    useHabitsStore.setState((s) => ({ logs: s.logs.filter((l) => l.id !== log.id) }));
    void db.habitLogs.delete(log.id);
  } else {
    useHabitsStore.setState((s) => ({ logs: upsertLog(s.logs, log) }));
    void db.habitLogs.put(log);
  }
  useHabitsStore.getState().refreshStreakFor(log.habitId);
}

function restoreLog(prev: HabitLog | null, habitId: ID, date: string): void {
  if (prev) {
    applyLog({ ...prev });
  } else {
    const existing = useHabitsStore.getState().getLog(habitId, date);
    if (existing) {
      useHabitsStore.setState((s) => ({ logs: s.logs.filter((l) => l.id !== existing.id) }));
      void db.habitLogs.delete(existing.id);
      useHabitsStore.getState().refreshStreakFor(habitId);
    }
  }
}

function showInterruptedToast(habit: Habit): void {
  const today = todayKey();
  const yesterday = dayKey(addDays(new Date(), -1));
  toastWithActions(`Серия «${habit.name}» прервалась — начнём заново?`, [
    {
      label: 'Отметить сегодня',
      onClick: () => useHabitsStore.getState().toggleHabit(habit.id, today),
    },
    {
      label: 'Пропуск за вчера',
      onClick: () => useHabitsStore.getState().skipHabit(habit.id, yesterday),
    },
  ], { description: 'Серия сброшена: 2 пропуска подряд или 2+ дня без отметки.' });
}