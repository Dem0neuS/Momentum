import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { addDays, dayKey, todayKey } from '@/lib/dates';
import type { DayPlan, DayPlanItem } from '@/lib/types';

const initial = {
  loaded: false,
  plans: [],
  items: [],
  selectedDate: todayKey(),
};

const tomorrow = () => dayKey(addDays(new Date(), 1));

function item(id: string, planId: string, order: number): DayPlanItem {
  return {
    id,
    planId,
    blockType: 'main',
    text: `Пункт ${id}`,
    completed: false,
    order,
    linkedHabitId: null,
    linkedWorkoutId: null,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  useDayPlanStore.setState(initial);
});

describe('dayPlanStore: выбранная дата', () => {
  it('не сбрасывается на «сегодня» при повторном открытии вкладки', () => {
    const date = tomorrow();
    useDayPlanStore.getState().setSelectedDate(date);

    // Смена вкладки размонтирует страницу, но стор живёт дальше —
    // именно из него страница теперь берёт дату.
    const state = useDayPlanStore.getState();
    expect(state.selectedDate).toBe(date);
    expect(state.selectedDate).not.toBe(todayKey());
  });

  it('сбрасывается на «сегодня» только при полном reset', () => {
    useDayPlanStore.getState().setSelectedDate(tomorrow());
    useDayPlanStore.getState().reset();
    expect(useDayPlanStore.getState().selectedDate).toBe(todayKey());
  });
});

describe('dayPlanStore: план на завтра', () => {
  it('создаёт ровно один план на дату', async () => {
    const date = tomorrow();
    const first = useDayPlanStore.getState().ensurePlan(date);
    const second = useDayPlanStore.getState().ensurePlan(date);

    expect(second.id).toBe(first.id);
    expect(useDayPlanStore.getState().plans.filter((p) => p.date === date)).toHaveLength(1);
    await vi.waitFor(async () => {
      expect(await db.dayPlans.where('date').equals(date).count()).toBe(1);
    });
  });

  it('пункт, добавленный на завтра, переживает перезагрузку стора', async () => {
    const date = tomorrow();
    useDayPlanStore.getState().setSelectedDate(date);
    const plan = useDayPlanStore.getState().ensurePlan(date);
    useDayPlanStore.getState().addItem(plan.id, 'main', 'Позвонить врачу');

    await vi.waitFor(async () => {
      expect(await db.dayPlanItems.count()).toBe(1);
    });

    // Как после возврата на вкладку: данные читаются из IndexedDB заново.
    await useDayPlanStore.getState().load();

    const state = useDayPlanStore.getState();
    expect(state.selectedDate).toBe(date);
    expect(state.plans.filter((p) => p.date === date)).toHaveLength(1);
    expect(state.items.filter((i) => i.planId === plan.id)).toHaveLength(1);
    expect(state.items.find((i) => i.planId === plan.id)?.text).toBe('Позвонить врачу');
  });

  it('схлопывает дубли планов на одну дату при загрузке', async () => {
    const date = tomorrow();
    const keep: DayPlan = { id: 'keep', date, notes: '' };
    const extra: DayPlan = { id: 'extra', date, notes: '' };
    await db.dayPlans.bulkPut([keep, extra]);
    await db.dayPlanItems.bulkPut([item('a', 'keep', 0), item('b', 'extra', 0)]);

    await useDayPlanStore.getState().load();

    const state = useDayPlanStore.getState();
    expect(state.plans.filter((p) => p.date === date)).toHaveLength(1);
    expect(state.items).toHaveLength(2);
    expect(state.items.every((i) => i.planId === state.plans[0].id)).toBe(true);
    await vi.waitFor(async () => {
      expect(await db.dayPlans.count()).toBe(1);
    });
  });
});
