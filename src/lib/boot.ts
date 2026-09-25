import { loadAllData } from '@/db/db';
import { seedIfNeeded } from '@/db/seed';
import { useSettingsStore } from '@/store/settingsStore';
import { useHabitsStore } from '@/store/habitsStore';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { useSheetsStore } from '@/store/sheetsStore';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { DEFAULT_SETTINGS } from '@/lib/constants';

/**
 * Общий промис — инициализация выполняется один раз, даже если
 * `initApp()` вызывается несколько раз (напр. double-mount StrictMode в dev).
 */
let appInitPromise: Promise<void> | null = null;

/** Первичная инициализация: сидинг + загрузка всех сторов */
export async function initApp(): Promise<void> {
  if (!appInitPromise) {
    appInitPromise = (async () => {
      await seedIfNeeded();
      await reloadAll();
    })().finally(() => {
      appInitPromise = null;
    });
  }
  return appInitPromise;
}

/** Полная перезагрузка данных из IndexedDB во все сторы */
export async function reloadAll(): Promise<void> {
  const data = await loadAllData();
  useSettingsStore.getState().load(data.settings ?? DEFAULT_SETTINGS);
  useHabitsStore.getState().load({
    categories: data.categories,
    subcategories: data.subcategories,
    habits: data.habits,
    habitLogs: data.habitLogs,
    streaks: data.streaks,
  });
  await useWorkoutsStore.getState().load({
    workouts: data.workouts,
    exercises: data.exercises,
    workoutTemplates: data.workoutTemplates,
  });
  await useSheetsStore.getState().load({ sheets: data.sheets, cells: data.cells });
  await useDayPlanStore.getState().load({ dayPlans: data.dayPlans, dayPlanItems: data.dayPlanItems });
}