import { db } from './db';
import type { Category, Habit, Subcategory } from '@/lib/types';
import { DEFAULT_CATEGORIES, DEFAULT_SUBCATEGORIES, STARTER_HABITS } from '@/lib/constants';
import { todayKey } from '@/lib/dates';
import { uid } from '@/lib/utils';

/**
 * Начальное наполнение для первого запуска:
 * категории и подкатегории + несколько стартовых привычек.
 * Запускается один раз, пока settings.onboarded === false.
 */
export async function seedIfNeeded(): Promise<boolean> {
  const row = await db.settings.get('app');
  const onboarded = Boolean((row?.value as { onboarded?: boolean } | undefined)?.onboarded);

  // Дополнительная защита от повторного сидинга (гонки StrictMode и т.п.)
  const existingHabits = await db.habits.count();
  if (onboarded && existingHabits > 0) return false;
  if (existingHabits > 0) {
    // Уже есть данные, но флаг не выставлен — просто пометим как готово
    await db.settings.put({ key: 'app', value: { ...((row?.value as object) ?? {}), onboarded: true } });
    return false;
  }

  const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
    id: uid(),
    name: c.name,
    icon: c.icon,
    color: c.color,
    order: i,
  }));
  const catByName = new Map(categories.map((c) => [c.name, c]));

  const subcategories: Subcategory[] = DEFAULT_SUBCATEGORIES.map((s, i) => {
    const cat = catByName.get(s.category);
    return {
      id: uid(),
      categoryId: cat?.id ?? '',
      name: s.name,
      icon: s.icon,
      color: cat?.color ?? '#94A3B8',
      order: i,
    };
  });

  const subByName = new Map<string, Subcategory>();
  for (const s of subcategories) subByName.set(`${s.categoryId}:${s.name}`, s);

  const habits: Habit[] = STARTER_HABITS.map((h, i) => {
    const cat = catByName.get(h.category);
    const sub = h.subcategory && cat ? subByName.get(`${cat.id}:${h.subcategory}`) : undefined;
    return {
      id: uid(),
      name: h.name,
      icon: h.icon,
      color: h.color,
      categoryId: cat?.id ?? null,
      subcategoryId: sub?.id ?? null,
      frequency: { type: 'daily' },
      targetCount: h.targetCount,
      counterUnit: h.counterUnit,
      allowSkips: true,
      createdAt: todayKey(),
      archived: false,
    };
  });

  await db.transaction('rw', [db.categories, db.subcategories, db.habits, db.settings], async () => {
    await db.categories.bulkPut(categories);
    await db.subcategories.bulkPut(subcategories);
    await db.habits.bulkPut(habits);
    const existing = await db.settings.get('app');
    await db.settings.put({
      key: 'app',
      value: { ...((existing?.value as object) ?? {}), onboarded: true },
    });
  });

  return true;
}