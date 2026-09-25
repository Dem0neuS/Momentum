import { create } from 'zustand';
import { db } from '@/db/db';
import type { BlockType, DayPlan, DayPlanItem } from '@/lib/types';
import { addDays, dayKey, parseDayKey } from '@/lib/dates';
import { uid } from '@/lib/utils';
import { toastSimple, toastWithUndo } from '@/lib/toast';

interface DayPlanState {
  loaded: boolean;
  plans: DayPlan[];
  items: DayPlanItem[];

  load: (data?: { dayPlans: DayPlan[]; dayPlanItems: DayPlanItem[] }) => Promise<void>;
  reset: () => void;

  ensurePlan: (date: string) => DayPlan;
  deletePlan: (date: string) => void;

  addItem: (planId: string, blockType: BlockType, text: string, opts?: { time?: string; duration?: number; note?: string }) => void;
  updateItem: (id: string, patch: Partial<DayPlanItem>) => void;
  deleteItem: (id: string) => void;
  toggleItem: (id: string) => void;
  moveItem: (itemId: string, targetPlanId: string, targetBlock: BlockType, targetIndex: number) => void;
  reorderWithinBlock: (planId: string, blockType: BlockType, orderedIds: string[]) => void;
  setNotes: (planId: string, notes: string) => void;

  carryOverIncomplete: (planId: string) => void;
  getItemsFor: (planId: string, blockType?: BlockType) => DayPlanItem[];
  progress: (planId: string) => { done: number; total: number; pct: number };
  findPlanByDate: (date: string) => DayPlan | undefined;
}

function nextOrder(items: DayPlanItem[], planId: string, blockType: BlockType): number {
  const block = items.filter((i) => i.planId === planId && i.blockType === blockType);
  return block.length ? Math.max(...block.map((i) => i.order)) + 1 : 0;
}

/**
 * Схлопывает дубли планов на одну дату: остаётся план с наибольшим числом
 * пунктов, пункты остальных переносятся в него (с сохранением block/order).
 */
function dedupePlansByDate(
  plans: DayPlan[],
  items: DayPlanItem[],
): { plans: DayPlan[]; items: DayPlanItem[]; removedPlanIds: string[] } {
  const byDate = new Map<string, DayPlan[]>();
  for (const p of plans) {
    const arr = byDate.get(p.date) ?? [];
    arr.push(p);
    byDate.set(p.date, arr);
  }

  const removedPlanIds: string[] = [];
  const kept: DayPlan[] = [];
  const nextItems: DayPlanItem[] = [];

  for (const group of byDate.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      nextItems.push(...items.filter((i) => i.planId === group[0].id));
      continue;
    }
    const count = (id: string) => items.filter((i) => i.planId === id).length;
    const sorted = [...group].sort((a, b) => count(b.id) - count(a.id));
    const winner = sorted[0];
    kept.push(winner);
    const survivors = items.filter((i) => i.planId === winner.id);
    nextItems.push(...survivors);
    let extra = 0;
    for (const loser of sorted.slice(1)) {
      removedPlanIds.push(loser.id);
      for (const item of items.filter((i) => i.planId === loser.id).sort((a, b) => a.order - b.order)) {
        nextItems.push({ ...item, planId: winner.id, order: survivors.length + extra });
        extra += 1;
      }
    }
  }

  return { plans: kept, items: nextItems, removedPlanIds };
}

/**
 * Кладёт перенос/перестановку пунктов в историю сессии (Ctrl+Z / тост «Отменить»),
 * чтобы dnd плана откатывался так же, как перенос привычки между категориями.
 */
function pushPlanUndo(
  before: DayPlanItem[],
  label: string,
  description: string,
): void {
  const snapshot = before.map((i) => ({ ...i }));
  toastWithUndo(label, () => {
    const ids = new Set(snapshot.map((i) => i.id));
    useDayPlanStore.setState((st) => ({
      items: [...st.items.filter((i) => !ids.has(i.id)), ...snapshot],
    }));
    void db.dayPlanItems.bulkPut(snapshot);
  }, { description });
}

export const useDayPlanStore = create<DayPlanState>((set, get) => ({
  loaded: false,
  plans: [],
  items: [],

  load: async (data) => {
    if (!data) {
      const [dayPlans, dayPlanItems] = await Promise.all([
        db.dayPlans.toArray(),
        db.dayPlanItems.toArray(),
      ]);
      data = { dayPlans, dayPlanItems };
    }
    // Инвариант: один план на дату. Если в БД остались дубли (гонка
    // ensurePlan до загрузки), схлопываем их и переносим пункты в живой план.
    const { plans, items, removedPlanIds } = dedupePlansByDate(data.dayPlans, data.dayPlanItems);
    set({ loaded: true, plans, items });
    if (removedPlanIds.length) {
      void db.dayPlans.bulkDelete(removedPlanIds);
      void db.dayPlanItems.bulkPut(items);
    }
  },

  reset: () => set({ loaded: false, plans: [], items: [] }),

  findPlanByDate: (date) => get().plans.find((p) => p.date === date),

  ensurePlan: (date) => {
    const s = get();
    const existing = s.findPlanByDate(date);
    if (existing) return existing;
    const plan: DayPlan = { id: uid(), date, notes: '' };
    set({ plans: [...s.plans, plan] });
    void db.dayPlans.put(plan);
    return plan;
  },

  deletePlan: (date) => {
    const s = get();
    const plan = s.findPlanByDate(date);
    if (!plan) return;
    const removed = s.items.filter((i) => i.planId === plan.id);
    set({
      plans: s.plans.filter((p) => p.id !== plan.id),
      items: s.items.filter((i) => i.planId !== plan.id),
    });
    void db.dayPlans.delete(plan.id);
    if (removed.length) void db.dayPlanItems.bulkDelete(removed.map((i) => i.id));
  },

  addItem: (planId, blockType, text, opts) => {
    const s = get();
    const item: DayPlanItem = {
      id: uid(),
      planId,
      blockType,
      text: text.trim() || 'Новый пункт',
      completed: false,
      time: opts?.time,
      duration: opts?.duration,
      order: nextOrder(s.items, planId, blockType),
      note: opts?.note,
      linkedHabitId: null,
      linkedWorkoutId: null,
    };
    set({ items: [...s.items, item] });
    void db.dayPlanItems.put(item);
  },

  updateItem: (id, patch) => {
    const s = get();
    const item = s.items.find((i) => i.id === id);
    if (!item) return;
    const next = { ...item, ...patch };
    set({ items: s.items.map((i) => (i.id === id ? next : i)) });
    void db.dayPlanItems.put(next);
  },

  deleteItem: (id) => {
    const s = get();
    set({ items: s.items.filter((i) => i.id !== id) });
    void db.dayPlanItems.delete(id);
  },

  toggleItem: (id) => {
    const s = get();
    const item = s.items.find((i) => i.id === id);
    if (!item) return;
    const next = { ...item, completed: !item.completed };
    set({ items: s.items.map((i) => (i.id === id ? next : i)) });
    void db.dayPlanItems.put(next);
    toastWithUndo(next.completed ? 'Пункт выполнен' : 'Отметка снята', () => {
      const cur = get().items.find((i) => i.id === id);
      if (!cur) return;
      const restored = { ...cur, completed: !cur.completed };
      set({ items: get().items.map((i) => (i.id === id ? restored : i)) });
      void db.dayPlanItems.put(restored);
    }, { description: next.text });
  },

  moveItem: (itemId, targetPlanId, targetBlock, targetIndex) => {
    const s = get();
    const item = s.items.find((i) => i.id === itemId);
    if (!item) return;
    const sourceBlock = item.blockType;
    const sourcePlanId = item.planId;

    if (sourceBlock === targetBlock && sourcePlanId === targetPlanId) {
      // Перестановка внутри блока
      const blockItems = s.items
        .filter((i) => i.planId === targetPlanId && i.blockType === targetBlock)
        .sort((a, b) => a.order - b.order);
      const ids = blockItems.map((i) => i.id);
      const from = ids.indexOf(itemId);
      if (from === -1) return;
      const to = Math.max(0, Math.min(targetIndex, ids.length - 1));
      if (from === to) return;
      const before = [item, ...blockItems.filter((i) => i.id !== itemId)];
      ids.splice(from, 1);
      ids.splice(to, 0, itemId);
      const updated = ids.map((id, idx) => {
        const it = blockItems.find((b) => b.id === id)!;
        return { ...it, order: idx };
      });
      set({ items: s.items.map((i) => updated.find((u) => u.id === i.id) ?? i) });
      void db.dayPlanItems.bulkPut(updated);
      pushPlanUndo(before, 'Пункт перемещён', item.text);
      return;
    }

    // Перенос между блоками/планами
    const targetBefore = s.items
      .filter((i) => i.planId === targetPlanId && i.blockType === targetBlock)
      .sort((a, b) => a.order - b.order);
    const before = [item, ...targetBefore.filter((i) => i.id !== itemId)];

    const updated: DayPlanItem[] = [];
    const blockItems = targetBefore.filter((i) => i.id !== itemId).map((i) => ({ ...i }));
    const inserted: DayPlanItem = {
      ...item,
      planId: targetPlanId,
      blockType: targetBlock,
    };
    const idx = Math.max(0, Math.min(targetIndex, blockItems.length));
    blockItems.splice(idx, 0, inserted);
    blockItems.forEach((it, i) => updated.push({ ...it, order: i }));

    const targetOldIds = new Set(blockItems.map((b) => b.id));
    const rest = s.items.filter((i) => i.id !== itemId && !targetOldIds.has(i.id));
    set({ items: [...rest, ...updated] });
    void db.dayPlanItems.bulkPut(updated);
    pushPlanUndo(before, 'Пункт перемещён', item.text);
  },

  reorderWithinBlock: (planId, blockType, orderedIds) => {
    const s = get();
    const before = s.items
      .filter((i) => i.planId === planId && i.blockType === blockType)
      .sort((a, b) => a.order - b.order);
    const updated = orderedIds.map((id, idx) => {
      const item = s.items.find((i) => i.id === id);
      return item ? { ...item, order: idx } : item;
    }).filter(Boolean) as DayPlanItem[];
    const changed = updated.some((u, i) => before[i]?.id !== u.id);
    if (!changed) return;
    set({ items: s.items.map((i) => updated.find((u) => u.id === i.id) ?? i) });
    void db.dayPlanItems.bulkPut(updated);
    const label = before.length ? `Пункт перемещён` : 'Порядок изменён';
    pushPlanUndo(before, label, before[0]?.text ?? '');
  },

  setNotes: (planId, notes) => {
    const s = get();
    const plan = s.plans.find((p) => p.id === planId);
    if (!plan) return;
    const next = { ...plan, notes };
    set({ plans: s.plans.map((p) => (p.id === planId ? next : p)) });
    void db.dayPlans.put(next);
  },

  carryOverIncomplete: (planId) => {
    const s = get();
    const plan = s.plans.find((p) => p.id === planId);
    if (!plan) return;
    const incomplete = s.items
      .filter((i) => i.planId === planId && !i.completed)
      .sort((a, b) => a.order - b.order);
    if (incomplete.length === 0) {
      toastSimple('Переносить нечего', 'Все пункты уже выполнены');
      return;
    }
    const nextDate = dayKey(addDays(parseDayKey(plan.date), 1));
    const target = s.ensurePlan(nextDate);
    const moved: DayPlanItem[] = incomplete.map((item, i) => ({
      ...item,
      id: uid(),
      planId: target.id,
      order: i,
    }));
    set({
      items: s.items.filter((i) => i.planId !== planId || i.completed).concat(moved),
    });
    void db.dayPlanItems.bulkPut(moved);
    void db.dayPlanItems.bulkDelete(incomplete.map((i) => i.id));
    toastWithUndo(`Перенесено: ${incomplete.length}`, () => {
      const cur = get();
      const restored = incomplete.map((item, i) => ({ ...item, order: item.order }));
      set({
        items: cur.items
          .filter((i) => !moved.some((m) => m.id === i.id) || i.planId !== target.id)
          .concat(restored),
      });
      void db.dayPlanItems.bulkPut(restored);
      void db.dayPlanItems.bulkDelete(moved.map((m) => m.id));
    });
  },

  getItemsFor: (planId, blockType) => {
    const all = get().items.filter((i) => i.planId === planId);
    const filtered = blockType ? all.filter((i) => i.blockType === blockType) : all;
    return filtered.sort((a, b) => a.order - b.order);
  },

  progress: (planId) => {
    const items = get().items.filter((i) => i.planId === planId);
    const done = items.filter((i) => i.completed).length;
    const total = items.length;
    // pct — доля 0..1 (как ожидает ProgressRing), а не проценты
    return { done, total, pct: total === 0 ? 0 : done / total };
  },
}));