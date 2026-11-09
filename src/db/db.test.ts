import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { db } from '@/db/db';

/**
 * Схема версии 1 — такая, какой она была до появления синхронизации.
 * Нужна, чтобы проверить реальный путь обновления старой базы: версия 1 →
 * версия 2 (проставление меток) → версия 3 (заметки календаря).
 */
const V1_STORES = {
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
};

describe('MomentumDB: миграция', () => {
  it('обновляет базу версии 1 до текущей, сохраняет данные и создаёт заметки', async () => {
    await db.delete();

    const old = new Dexie('momentum');
    old.version(1).stores(V1_STORES);
    await old.open();
    await old.table('dayPlans').put({ id: 'p1', date: '2026-01-01', notes: 'старый план' });
    await old.table('dayPlanItems').put({
      id: 'i1',
      planId: 'p1',
      blockType: 'main',
      text: 'Старый пункт',
      completed: false,
      order: 0,
    });
    await old.table('categories').put({ id: 'c1', name: 'Старая', icon: 'x', color: '#000', order: 0 });
    old.close();

    // Синглтон приложения открывает базу уже на версии 3 и прогоняет апгрейды.
    await db.open();

    expect(await db.dayPlans.count()).toBe(1);
    expect((await db.dayPlans.get('p1'))?.notes).toBe('старый план');
    expect(await db.dayPlanItems.count()).toBe(1);
    expect(await db.categories.count()).toBe(1);

    // Апгрейд версии 2 проставляет updatedAt существующим строкам — иначе они
    // не уехали бы в облако. Новая таблица при этом ещё не должна мешать.
    const plan = (await db.dayPlans.get('p1')) as unknown as { updatedAt?: string };
    expect(plan.updatedAt).toBeTruthy();

    await db.calendarNotes.put({
      id: 'n1',
      date: '2026-01-01',
      text: 'Заметка после миграции',
      createdAt: '2026-01-01T10:00:00.000Z',
    });
    expect(await db.calendarNotes.count()).toBe(1);

    db.close();
  });
});
