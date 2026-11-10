import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import { listTombstones, addTombstone } from '@/sync/meta';
import type { AllData, Habit, HabitLog, StreakInfo } from '@/lib/types';

/**
 * В Node нет localStorage, а журнал удалений и метки синхронизации живут
 * именно там. Для проверки слияния достаточно простого хранилища в памяти.
 */
class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

let mergeLocalData: (data: AllData) => Promise<number>;

beforeAll(async () => {
  // supabase.ts вычисляет адрес возврата из location уже при импорте.
  vi.stubGlobal('location', { origin: 'http://localhost' });
  vi.stubGlobal('localStorage', new MemoryStorage());
  ({ mergeLocalData } = await import('@/sync/engine'));
  await db.open();
});

beforeEach(async () => {
  localStorage.clear();
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
});

function habit(id: string, name: string): Habit {
  return {
    id,
    name,
    icon: 'circle',
    color: '#000000',
    categoryId: null,
    subcategoryId: null,
    frequency: { type: 'daily' },
    targetCount: 1,
    counterUnit: '',
    allowSkips: true,
    createdAt: '2026-01-01',
    archived: false,
  };
}

function backup(): AllData {
  return {
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    categories: [],
    subcategories: [],
    habits: [habit('h1', 'Текущая'), habit('h2', 'Из старой копии')],
    habitLogs: [
      { id: 'l2', habitId: 'h2', date: '2025-12-31', value: 1, completed: true, status: 'done', updatedAt: '' } as HabitLog,
    ],
    streaks: [
      { habitId: 'h2', current: 1, best: 1, totalDone: 1, lastResetAt: null } as StreakInfo,
    ],
    workouts: [],
    exercises: [],
    workoutTemplates: [],
    sheets: [],
    cells: [],
    dayPlans: [],
    dayPlanItems: [],
    calendarNotes: [],
    settings: { ...DEFAULT_SETTINGS, profileName: 'Из старой копии' },
  };
}

describe('mergeLocalData: восстановление старой копии', () => {
  it('добавляет только недостающие записи и не трогает настройки', async () => {
    await db.habits.put(habit('h1', 'Текущая'));
    await db.settings.put({ key: 'app', value: { ...DEFAULT_SETTINGS, profileName: 'Текущее' } });

    const added = await mergeLocalData(backup());

    expect(added).toBe(3); // h2 + отметка + серия
    expect(await db.habits.get('h2')).toBeTruthy();
    expect((await db.habits.get('h1'))?.name).toBe('Текущая');
    expect(await db.habitLogs.get('l2')).toBeTruthy();
    expect(await db.streaks.get('h2')).toBeTruthy();
    expect((await db.settings.get('app'))?.value).toMatchObject({ profileName: 'Текущее' });
  });

  it('проставляет свежую метку, чтобы записи уехали в облако', async () => {
    await mergeLocalData(backup());
    const row = await db.habits.get('h2');
    expect((row as unknown as { updatedAt?: string }).updatedAt).toBeTruthy();
  });

  it('снимает tombstone: восстановленная запись не считается удалённой', async () => {
    addTombstone('habits', 'h2', Date.now());
    expect(listTombstones().some((t) => t.table === 'habits' && t.id === 'h2')).toBe(true);

    await mergeLocalData(backup());

    expect(listTombstones().some((t) => t.table === 'habits' && t.id === 'h2')).toBe(false);
  });

  it('повторное восстановление ничего не добавляет', async () => {
    expect(await mergeLocalData(backup())).toBe(4);
    expect(await mergeLocalData(backup())).toBe(0);
  });
});
