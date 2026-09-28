import { useEffect, useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarClock, Check, GripVertical, Link2, Pencil, Trash2 } from 'lucide-react';
import type { DayPlanItem } from '@/lib/types';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { useHabitsStore } from '@/store/habitsStore';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { Menu } from '@/components/ui/menu';
import { Input } from '@/components/ui/input';
import { Popover } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PlanItem({ item }: { item: DayPlanItem }) {
  const toggleItem = useDayPlanStore((s) => s.toggleItem);
  const updateItem = useDayPlanStore((s) => s.updateItem);
  const deleteItem = useDayPlanStore((s) => s.deleteItem);
  const habits = useHabitsStore((s) => s.habits);
  const workouts = useWorkoutsStore((s) => s.workouts);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.text);
  const [time, setTime] = useState(item.time ?? '');
  const [duration, setDuration] = useState(item.duration ?? 0);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const linkedHabit = habits.find((h) => h.id === item.linkedHabitId);
  const linkedWorkout = workouts.find((w) => w.id === item.linkedWorkoutId);

  const meta = useMemo(() => ({ time: item.time, duration: item.duration }), [item.time, item.duration]);

  const commitText = () => {
    if (value.trim() && value.trim() !== item.text) updateItem(item.id, { text: value.trim() });
    updateItem(item.id, { time: time || undefined, duration: duration || undefined });
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 30 : undefined }}
      className={cn(
        'group flex min-h-row items-center gap-2 rounded-md border border-border/60 bg-background/50 px-2.5 py-2 transition-colors',
        isDragging && 'border-primary/50 shadow-pop',
        item.completed && 'bg-muted/40 opacity-75',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        data-drag-handle
        className="flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:text-foreground sm:h-8 sm:w-8"
        aria-label={`Перетащить «${item.text || 'пункт плана'}»`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        onClick={() => toggleItem(item.id)}
        className={cn(
          // Визуально 20 px, область нажатия на тач-экранах — 44 px.
          'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90',
          'before:absolute before:-inset-3 before:content-[""]',
          item.completed
            ? 'border-transparent bg-brand text-on-brand'
            : 'border-border/80 hover:border-primary/50',
        )}
        aria-label={item.completed ? 'Снять отметку' : 'Отметить выполненным'}
      >
        {item.completed && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      {editing ? (
        <div className="min-w-0 flex-1 space-y-1.5">
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText();
              if (e.key === 'Escape') {
                setValue(item.text);
                setEditing(false);
              }
            }}
            className="h-7 rounded-lg text-sm"
          />
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-7 w-28 rounded-lg text-xs"
              aria-label="Время"
            />
            <Input
              type="number"
              min={0}
              value={duration || ''}
              onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value || '0', 10)))}
              placeholder="минут"
              className="h-7 w-24 rounded-lg text-xs"
              aria-label="Длительность в минутах"
            />
            <span className="text-[11px] text-muted-foreground">мин</span>
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-medium',
              item.completed && 'line-through decoration-muted-foreground/60',
            )}
          >
            {item.text}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {(meta.time || meta.duration) && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                {meta.time}
                {meta.time && meta.duration ? ' · ' : ''}
                {meta.duration ? `${meta.duration} мин` : ''}
              </span>
            )}
            {linkedHabit && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-ink">
                {linkedHabit.icon} привычка
              </span>
            )}
            {linkedWorkout && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cardio-soft px-1.5 py-0.5 text-[10px] font-medium text-cardio-ink">
                🏋️ тренировка
              </span>
            )}
          </div>
        </div>
      )}

      <Menu
        align="end"
        trigger={
          <button
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground/50 opacity-70 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 sm:h-8 sm:w-8"
            aria-label="Действия с пунктом"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        }
        items={[
          { label: 'Редактировать текст', icon: <Pencil />, onClick: () => setEditing(true) },
          { separator: true },
          {
            label: 'Удалить',
            icon: <Trash2 />,
            danger: true,
            onClick: () => deleteItem(item.id),
          },
        ]}
      />

      <LinkPopover item={item} habits={habits} workouts={workouts} onLink={(patch) => updateItem(item.id, patch)} />
    </div>
  );
}

function LinkPopover({
  item,
  habits,
  workouts,
  onLink,
}: {
  item: DayPlanItem;
  habits: { id: string; name: string; icon: string }[];
  workouts: { id: string; name: string }[];
  onLink: (patch: Partial<DayPlanItem>) => void;
}) {
  return (
    <Popover
      trigger={
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 opacity-70 transition-opacity hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 group-hover:opacity-100 sm:h-8 sm:w-8"
          title="Связать с привычкой или тренировкой"
          aria-label="Связать с привычкой или тренировкой"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
      }
      align="end"
    >
      <div className="max-h-72 w-64 overflow-auto p-2">
        {habits.length > 0 && (
          <>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Привычки</p>
            <div className="mb-2 flex flex-col gap-0.5">
              {habits.slice(0, 6).map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => onLink({ linkedHabitId: h.id, linkedWorkoutId: null })}
                  className="flex min-h-tap items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
                >
                  <span>{h.icon}</span>
                  <span className="truncate">{h.name}</span>
                  {item.linkedHabitId === h.id && <Check className="ml-auto h-3.5 w-3.5 text-primary-ink" />}
                </button>
              ))}
            </div>
          </>
        )}
        {workouts.length > 0 && (
          <>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Тренировки</p>
            <div className="flex flex-col gap-0.5">
              {workouts.slice(0, 8).map((w) => (
                <button
                  type="button"
                  key={w.id}
                  onClick={() => onLink({ linkedWorkoutId: w.id, linkedHabitId: null })}
                  className="flex min-h-tap items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
                >
                  <span>🏋️</span>
                  <span className="truncate">{w.name}</span>
                  {item.linkedWorkoutId === w.id && <Check className="ml-auto h-3.5 w-3.5 text-primary-ink" />}
                </button>
              ))}
            </div>
          </>
        )}
        {(item.linkedHabitId || item.linkedWorkoutId) && (
          <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => onLink({ linkedHabitId: null, linkedWorkoutId: null })}>
            Убрать связь
          </Button>
        )}
      </div>
    </Popover>
  );
}