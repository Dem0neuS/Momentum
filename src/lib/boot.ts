import { loadAllData } from '@/db/db';
import { seedIfNeeded } from '@/db/seed';
import { useSettingsStore } from '@/store/settingsStore';
import { useHabitsStore } from '@/store/habitsStore';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { useCalendarStore } from '@/store/calendarStore';
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
      // Таблицы не грузим на старте: их стор тянет HyperFormula. Раздел
      // «Таблицы» загружается по требованию и сам вызовет load().
      await reloadAll({ sheets: false });
    })().finally(() => {
      appInitPromise = null;
    });
  }
  return appInitPromise;
}

/** Полная перезагрузка данных из IndexedDB во все сторы */
export async function reloadAll(opts: { sheets?: boolean } = {}): Promise<void> {
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
  // Динамический импорт: на старте (sheets: false) чанк с формулами
  // не запрашивается вовсе. При импорте бэкапа и синхронизации — грузим.
  if (opts.sheets !== false) {
    const { useSheetsStore } = await import('@/store/sheetsStore');
    await useSheetsStore.getState().load({ sheets: data.sheets, cells: data.cells });
  }
  await useDayPlanStore.getState().load({ dayPlans: data.dayPlans, dayPlanItems: data.dayPlanItems });
  await useCalendarStore.getState().load(data.calendarNotes);
}