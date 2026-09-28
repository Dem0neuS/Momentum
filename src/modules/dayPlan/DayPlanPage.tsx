import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CalendarDays, ChevronLeft, ChevronRight, Forward, History } from 'lucide-react';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { addDays, dayKey, formatDayTitle, todayKey } from '@/lib/dates';
import { createDndAnnouncements, dndScreenReaderInstructions } from '@/lib/dndA11y';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ProgressRing';
import { Input } from '@/components/ui/input';
import { PlanBlock } from './PlanBlock';
import { cn } from '@/lib/utils';

export function DayPlanPage() {
  const plans = useDayPlanStore((s) => s.plans);
  const items = useDayPlanStore((s) => s.items);
  const loaded = useDayPlanStore((s) => s.loaded);
  const ensurePlan = useDayPlanStore((s) => s.ensurePlan);
  const moveItem = useDayPlanStore((s) => s.moveItem);
  const reorderWithinBlock = useDayPlanStore((s) => s.reorderWithinBlock);
  const carryOverIncomplete = useDayPlanStore((s) => s.carryOverIncomplete);
  const progress = useDayPlanStore((s) => s.progress);

  const [date, setDate] = useState(todayKey());
  const [historyOpen, setHistoryOpen] = useState(false);

  // План создаём только после загрузки стора, иначе ensurePlan успевает
  // добавить дубль на ту же дату (гонка рендера с асинхронным load).
  const plan = useMemo(() => {
    if (!loaded) return null;
    return plans.find((p) => p.date === date) ?? ensurePlan(date);
  }, [loaded, plans, date, ensurePlan]);

  const planItems = useMemo(
    () => (plan ? items.filter((i) => i.planId === plan.id) : []),
    [items, plan],
  );

  const byBlock = (b: 'main' | 'medium' | 'small') =>
    planItems.filter((i) => i.blockType === b).sort((a, b2) => a.order - b2.order);

  const pr = plan ? progress(plan.id) : { done: 0, total: 0, pct: 0 };

  const isToday = date === todayKey();
  const isPast = date < todayKey();

  const sensors = useSensors(
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || !plan) return;
    const itemId = String(active.id);
    const overId = String(over.id);
    if (overId === itemId) return;

    if (overId === 'main' || overId === 'medium' || overId === 'small') {
      moveItem(itemId, plan.id, overId as 'main' | 'medium' | 'small', 9999);
      return;
    }

    // перемещение внутри блока
    if (planItems.some((i) => i.id === overId)) {
      const target = planItems.find((i) => i.id === overId);
      if (!target) return;
      const block = target.blockType;
      const list = byBlock(block);
      const oldIndex = list.findIndex((i) => i.id === itemId);
      const newIndex = list.findIndex((i) => i.id === overId);
      if (oldIndex === -1) {
        // пришёл из другого блока
        moveItem(itemId, plan.id, block, Math.max(0, newIndex));
      } else if (oldIndex !== newIndex) {
        const next = [...list.map((i) => i.id)];
        next.splice(oldIndex, 1);
        next.splice(newIndex, 0, itemId);
        reorderWithinBlock(plan.id, block, next);
      }
    }
  };

  const historyDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(new Date(), -(i + 1))).map(dayKey);
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">План 3-2-1</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatDayTitle(new Date(date + 'T12:00:00'))}</p>
        </div>
        <ProgressRing
          size={56}
          stroke={5}
          progress={pr.pct}
          gradient
          glow
          label="Прогресс плана"
          valueText={`${pr.done} из ${pr.total}`}
        >
          <span className="text-xs font-bold">
            {pr.total > 0 ? Math.round(pr.pct * 100) : 0}%
          </span>
        </ProgressRing>
      </div>

      {/* Навигация по датам */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => setDate(dayKey(addDays(new Date(date + 'T12:00:00'), -1)))} aria-label="Предыдущий день">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-40 rounded-md text-xs"
            aria-label="Дата плана"
          />
        </div>
        {!isToday && (
          <Button variant="ghost" size="sm" onClick={() => setDate(todayKey())}>
            Сегодня
          </Button>
        )}
        <Button variant="outline" size="icon-sm" onClick={() => setDate(dayKey(addDays(new Date(date + 'T12:00:00'), 1)))} aria-label="Следующий день">
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(!historyOpen)}
            className={cn(historyOpen && 'bg-accent text-foreground')}
          >
            <History className="h-3.5 w-3.5" /> История
          </Button>
          {/* Перенос доступен для сегодняшнего и будущих дней; в прошлом — нет. */}
          {plan && !isPast ? (
            <Button variant="gradient" size="sm" onClick={() => carryOverIncomplete(plan.id)} title="Перенести невыполненные пункты на завтра">
              <Forward className="h-3.5 w-3.5" /> На завтра
            </Button>
          ) : null}
        </div>
      </div>

      {/* История */}
      {historyOpen && (
        <div className="rounded-lg border border-border/70 bg-card p-3 shadow-card">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Прошедшие дни
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {historyDays.map((d) => {
              const p = plans.find((x) => x.date === d);
              const prog = p ? progress(p.id) : { done: 0, total: 0, pct: 0 };
              const dd = new Date(d + 'T12:00:00');
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDate(d);
                    setHistoryOpen(false);
                  }}
                  className={cn(
                    'flex min-h-tap w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-border/60 p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    date === d && 'border-primary/50 bg-primary/5',
                  )}
                >
                  <span className="text-lg font-bold">{dd.getDate()}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {dd.toLocaleDateString('ru-RU', { month: 'short' })}
                  </span>
                  <span className={cn('text-[11px] font-medium', prog.total > 0 && prog.pct >= 1 ? 'text-success-ink' : 'text-muted-foreground')}>
                    {prog.done}/{prog.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Блоки */}
      {plan && (
        <DndContext
          sensors={sensors}
          accessibility={{
            screenReaderInstructions: dndScreenReaderInstructions,
            announcements: createDndAnnouncements(
              (id) => planItems.find((i) => i.id === id)?.text,
            ),
          }}
          onDragEnd={onDragEnd}
        >
          <div className="space-y-4">
            <PlanBlock plan={plan} block="main" items={byBlock('main')} />
            <PlanBlock plan={plan} block="medium" items={byBlock('medium')} />
            <PlanBlock plan={plan} block="small" items={byBlock('small')} />
          </div>
        </DndContext>
      )}
    </div>
  );
}