import { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Ban, GripVertical } from 'lucide-react';
import type { Habit } from '@/lib/types';
import { useHabitsStore } from '@/store/habitsStore';
import { useLongPress } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { StreakBadge } from './StreakBadge';
import { MiniGraph } from './MiniGraph';
import { HabitRing } from './HabitRing';
import { SkipMenuDialog } from './SkipMenu';

export function HabitCard({
  habit,
  date,
  categoryColor,
  onOpenDetail,
  isDraggingOver,
}: {
  habit: Habit;
  date: string;
  categoryColor?: string;
  onOpenDetail: (habit: Habit) => void;
  isDraggingOver?: boolean;
}) {
  const [skipOpen, setSkipOpen] = useState(false);
  const log = useHabitsStore((s) => s.logs.find((l) => l.habitId === habit.id && l.date === date));
  const streak = useHabitsStore((s) => s.streaks[habit.id]);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: habit.id,
  });

  // Свайп влево → меню пропуска
  const swipeStart = useRef<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);

  const accent = categoryColor ?? habit.color;

  const openSkip = () => {
    if (habit.allowSkips) setSkipOpen(true);
  };

  const longPress = useLongPress(openSkip, 480);

  return (
    <>
      <div
        {...longPress}
        ref={setNodeRef}
        onPointerDown={(e) => {
          // Удержание ручки перетаскивания не должно открывать меню пропуска
          if ((e.target as HTMLElement).closest('[data-drag-handle]')) return;
          longPress.onPointerDown();
        }}
        style={{
          transform:
            swipeX !== 0
              ? `translateX(${swipeX}px)`
              : transform
                ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.04 : 1})`
                : isDragging
                  ? 'scale(1.04)'
                  : undefined,
          zIndex: isDragging ? 50 : undefined,
          opacity: isDragging ? 0.9 : 1,
        }}
        className={cn(
          'group relative flex min-h-row select-none items-center gap-2 rounded-lg border border-border/70 bg-card p-3 pl-4 shadow-card transition-shadow hover:shadow-pop',
          isDraggingOver && 'ring-2 ring-primary/40',
          isDragging && 'cursor-grabbing border-primary/40',
          swipeX < -8 && 'border-brand/40',
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          openSkip();
        }}
        onTouchStart={(e) => {
          swipeStart.current = e.touches[0].clientX;
          setSwipeX(0);
        }}
        onTouchMove={(e) => {
          if (swipeStart.current === null) return;
          const dx = e.touches[0].clientX - swipeStart.current;
          // Жест превратился в свайп — отменяем долгое нажатие
          if (Math.abs(dx) > 10) longPress.onPointerCancel();
          setSwipeX(Math.max(-90, Math.min(0, dx)));
        }}
        onTouchEnd={() => {
          longPress.onTouchEnd();
          if (swipeX < -64) {
            openSkip();
            vibrate();
          }
          setSwipeX(0);
          swipeStart.current = null;
        }}
      >
        {/* Цветная полоска категории */}
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-[60%] w-[4px] -translate-y-1/2 rounded-full"
          style={{ backgroundColor: accent }}
        />

        {/* Ручка перетаскивания */}
        <button
          {...attributes}
          {...listeners}
          data-drag-handle
          className="flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/50 opacity-60 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing sm:h-6 sm:w-6"
          aria-label={`Перетащить «${habit.name}» в другую категорию`}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Тело карточки */}
        <button
          className="flex min-h-tap min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          onClick={() => onOpenDetail(habit)}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ backgroundColor: `${accent}1f` }}
          >
            {habit.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{habit.name}</p>
            <div className="mt-1 flex items-center gap-2.5">
              <StreakBadge count={streak?.current ?? 0} />
              <MiniGraph habitId={habit.id} color={habit.color} />
              {habit.targetCount > 0 && (
                <span className="text-[11px] font-medium text-muted-foreground">
                  {(log?.value ?? 0)}/{habit.targetCount}
                  {habit.counterUnit ? ` ${habit.counterUnit}` : ''}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Кольцо и кнопка пропуска */}
        <div className="flex shrink-0 flex-col items-center gap-0.5 pr-1">
          <HabitRing habit={habit} log={log} date={date} size={44} onOpenSkip={openSkip} />
          {habit.allowSkips && (
            <button
              onClick={openSkip}
              title="Пропустить день"
              aria-label="Пропустить день"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:text-skip-ink sm:h-auto sm:w-auto sm:p-0.5"
            >
              <Ban className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <SkipMenuDialog
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        habit={habit}
        date={date}
      />
    </>
  );
}

function vibrate() {
  try {
    if ('vibrate' in navigator) navigator.vibrate(8);
  } catch {
    /* no-op */
  }
}