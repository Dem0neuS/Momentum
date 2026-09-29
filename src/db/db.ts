import Dexie, { type Table } from 'dexie';
import type {
  AllData,
  AppSettings,
  Category,
  Cell,
  DayPlan,
  DayPlanItem,
  Exercise,
  Habit,
  HabitLog,
  Sheet,
  StreakInfo,
  Subcategory,
  Workout,
  WorkoutTemplate,
} from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

/**
 * Таблицы, которые уезжают в облако. Объявлены здесь, а не в движке
 * синхронизации, потому что нужны ещё и миграции схемы.
 */
export const SYNC_TABLES = [
  'categories',
  'subcategories',
  'habits',
  'habitLogs',
  'streaks',
  'workouts',
  'exercises',
  'workoutTemplates',
  'sheets',
  'cells',
  'dayPlans',
  'dayPlanItems',
  'settings',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export class MomentumDB extends Dexie {
  categories!: Table<Category, string>;
  subcategories!: Table<Subcategory, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  streaks!: Table<StreakInfo, string>;
  workouts!: Table<Workout, string>;
  exercises!: Table<Exercise, string>;
  workoutTemplates!: Table<WorkoutTemplate, string>;
  sheets!: Table<Sheet, string>;
  cells!: Table<Cell, string>;
  dayPlans!: Table<DayPlan, string>;
  dayPlanItems!: Table<DayPlanItem, string>;
  settings!: Table<{ key: string; value: unknown; updatedAt?: string }, string>;

  constructor() {
    super('momentum');
    this.version(1).stores({
      categories: 'id, name, order',
      subcategories: 'id, categoryId, name, order',
      habits: 'id, name, categoryId, subcategoryId, archived, createdAt',
      habitLogs: 'id, habitId, date, status, updatedAt',
      streaks: 'habitId, current, best',
      workouts: 'id, date, type, completed',
      exercises: 'id, workoutId, order',
      workoutTemplates: 'id, name',
      sheets: 'id, name',
      cells: 'id, sheetId, row, col',
      dayPlans: 'id, date',
      dayPlanItems: 'id, planId, blockType, order',
      settings: 'key',
    });

    // Версия 2 добавляет синхронизацию. Изменений данных нет: только индекс
    // updatedAt, по которому движок отбирает изменённые после последней
    // отправки строки, и проставление меток уже существующим записям.
    // Без меток они бы выглядели как никогда не менявшиеся и в облако не уехали.
    this.version(2)
      .stores({
        categories: 'id, name, order, updatedAt',
        subcategories: 'id, categoryId, name, order, updatedAt',
        habits: 'id, name, categoryId, subcategoryId, archived, createdAt, updatedAt',
        habitLogs: 'id, habitId, date, status, updatedAt',
        streaks: 'habitId, current, best, updatedAt',
        workouts: 'id, date, type, completed, updatedAt',
        exercises: 'id, workoutId, order, updatedAt',
        workoutTemplates: 'id, name, updatedAt',
        sheets: 'id, name, updatedAt',
        cells: 'id, sheetId, row, col, updatedAt',
        dayPlans: 'id, date, updatedAt',
        dayPlanItems: 'id, planId, blockType, order, updatedAt',
        settings: 'key, updatedAt',
      })
      .upgrade(async (tx) => {
        const stamp = new Date().toISOString();
        for (const name of SYNC_TABLES) {
          await tx.table(name).toCollection().modify((obj: Record<string, unknown>) => {
            obj.updatedAt = stamp;
          });
        }
      });
  }
}

export const db = new MomentumDB();

/** Загрузка всех данных приложения одной пачкой */
export async function loadAllData(): Promise<{
  categories: Category[];
  subcategories: Subcategory[];
  habits: Habit[];
  habitLogs: HabitLog[];
  streaks: StreakInfo[];
  workouts: Workout[];
  exercises: Exercise[];
  workoutTemplates: WorkoutTemplate[];
  sheets: Sheet[];
  cells: Cell[];
  dayPlans: DayPlan[];
  dayPlanItems: DayPlanItem[];
  settings: AppSettings;
}> {
  const [categories, subcategories, habits, habitLogs, streaks, workouts, exercises, workoutTemplates, sheets, cells, dayPlans, dayPlanItems, settingsRows] =
    await Promise.all([
      db.categories.toArray(),
      db.subcategories.toArray(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.streaks.toArray(),
      db.workouts.toArray(),
      db.exercises.toArray(),
      db.workoutTemplates.toArray(),
      db.sheets.toArray(),
      db.cells.toArray(),
      db.dayPlans.toArray(),
      db.dayPlanItems.toArray(),
      db.settings.toArray(),
    ]);

  const settingsRow = settingsRows.find((r) => r.key === 'app');
  const saved = settingsRow?.value as Partial<AppSettings> | undefined;
  const settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) } as AppSettings;

  return {
    categories,
    subcategories,
    habits,
    habitLogs,
    streaks,
    workouts,
    exercises,
    workoutTemplates,
    sheets,
    cells,
    dayPlans,
    dayPlanItems,
    settings,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: 'app', value: settings });
}

/** Полная замена данных (импорт JSON / сброс) */
export async function replaceAllData(data: AllData): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.categories, db.subcategories, db.habits, db.habitLogs, db.streaks,
      db.workouts, db.exercises, db.workoutTemplates, db.sheets, db.cells,
      db.dayPlans, db.dayPlanItems, db.settings,
    ],
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.subcategories.clear(),
        db.habits.clear(),
        db.habitLogs.clear(),
        db.streaks.clear(),
        db.workouts.clear(),
        db.exercises.clear(),
        db.workoutTemplates.clear(),
        db.sheets.clear(),
        db.cells.clear(),
        db.dayPlans.clear(),
        db.dayPlanItems.clear(),
        db.settings.clear(),
      ]);
      await db.categories.bulkPut(data.categories ?? []);
      await db.subcategories.bulkPut(data.subcategories ?? []);
      await db.habits.bulkPut(data.habits ?? []);
      await db.habitLogs.bulkPut(data.habitLogs ?? []);
      await db.streaks.bulkPut(data.streaks ?? []);
      await db.workouts.bulkPut(data.workouts ?? []);
      await db.exercises.bulkPut(data.exercises ?? []);
      await db.workoutTemplates.bulkPut(data.workoutTemplates ?? []);
      await db.sheets.bulkPut(data.sheets ?? []);
      await db.cells.bulkPut(data.cells ?? []);
      await db.dayPlans.bulkPut(data.dayPlans ?? []);
      await db.dayPlanItems.bulkPut(data.dayPlanItems ?? []);
      if (data.settings) await saveSettings(data.settings);
    },
  );
}

export async function clearAllData(): Promise<void> {
  await replaceAllData({} as AllData);
}

export async function collectAllData(settings: AppSettings): Promise<AllData> {
  const [categories, subcategories, habits, habitLogs, streaks, workouts, exercises, workoutTemplates, sheets, cells, dayPlans, dayPlanItems] =
    await Promise.all([
      db.categories.toArray(),
      db.subcategories.toArray(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.streaks.toArray(),
      db.workouts.toArray(),
      db.exercises.toArray(),
      db.workoutTemplates.toArray(),
      db.sheets.toArray(),
      db.cells.toArray(),
      db.dayPlans.toArray(),
      db.dayPlanItems.toArray(),
    ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    subcategories,
    habits,
    habitLogs,
    streaks,
    workouts,
    exercises,
    workoutTemplates,
    sheets,
    cells,
    dayPlans,
    dayPlanItems,
    settings,
  };
}