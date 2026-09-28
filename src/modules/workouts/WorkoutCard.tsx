import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarX2, Check, Copy, Dumbbell, Pencil, Trash2 } from 'lucide-react';
import type { Workout } from '@/lib/types';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { WORKOUT_TYPE_META } from '@/lib/constants';
import { formatDayKeyShort } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { cn, vibrate } from '@/lib/utils';

export function WorkoutCard({
  workout,
  onEdit,
  onDuplicate,
  highlight = false,
}: {
  workout: Workout;
  onEdit: (w: Workout) => void;
  onDuplicate: (w: Workout) => void;
  highlight?: boolean;
}) {
  const exercises = useWorkoutsStore((s) => s.exercises.filter((e) => e.workoutId === workout.id));
  const toggleWorkout = useWorkoutsStore((s) => s.toggleWorkout);
  const deleteWorkout = useWorkoutsStore((s) => s.deleteWorkout);
  const cancelWorkout = useWorkoutsStore((s) => s.cancelWorkout);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const meta = WORKOUT_TYPE_META[workout.type];
  const totalSets = exercises.reduce((a, e) => a + e.sets, 0);
  const totalDistance = exercises.reduce((a, e) => a + (e.distance ?? 0), 0);
  const totalDuration = exercises.reduce((a, e) => a + (e.duration ?? 0), 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn(
        'group relative rounded-lg border border-border/70 bg-card p-2.5 shadow-card transition-all hover:z-20 focus-within:z-20',
        workout.completed && 'border-transparent bg-muted/50 opacity-75',
        highlight && 'ring-1 ring-primary/40',
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: meta.color }}
      />
      {/* В 7колоночной сетке (xl) действия переносятся на верхнюю строку, иначе
          название сжимается в пару пикселей. */}
      <div className="flex items-start gap-2 pl-1.5 xl:flex-wrap xl:gap-y-1.5">
        <button
          type="button"
          onClick={() => {
            toggleWorkout(workout.id);
            vibrate(10);
          }}
          className={cn(
            'relative mt-0.5 order-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all before:absolute before:-inset-2.5 before:content-[""] active:scale-90',
            workout.completed
              ? 'border-transparent bg-brand text-on-brand'
              : 'border-border/80 text-transparent hover:border-primary/50',
          )}
          aria-label={workout.completed ? 'Снять отметку' : 'Отметить выполненной'}
        >
          {workout.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>

        <button
          type="button"
          onClick={() => onEdit(workout)}
          className="order-2 min-w-0 flex-1 rounded-lg text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary/50 xl:order-3 xl:w-full xl:flex-none"
          aria-label={`Открыть и редактировать тренировку «${workout.name}»`}
          title="Открыть и редактировать"
        >
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="text-sm">
              {meta.emoji}
            </span>
            <p
              className={cn(
                'truncate text-sm font-semibold',
                workout.completed && 'line-through decoration-muted-foreground/60',
              )}
            >
              {workout.name}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium" style={{ color: meta.ink, backgroundColor: meta.soft }}>
              {meta.label}
            </span>
            {exercises.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Dumbbell className="h-3 w-3" />
                {exercises.length} упр.
              </span>
            )}
            {workout.type !== 'cardio' && totalSets > 0 && <span>· {totalSets} подходов</span>}
            {workout.type === 'cardio' && totalDistance > 0 && <span>· {formatMetric(totalDistance)} км</span>}
            {workout.type === 'cardio' && totalDuration > 0 && <span>· {formatMetric(totalDuration)} мин</span>}
          </div>
        </button>

        <Menu
          align="end"
          className="order-3 xl:order-2 xl:ml-auto"
          trigger={
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 opacity-70 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:h-9 sm:w-9"
              aria-label={`Открыть действия с тренировкой «${workout.name}»`}
              title="Открыть действия"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          }
          items={[
            { label: 'Открыть и редактировать', icon: <Pencil />, onClick: () => onEdit(workout) },
            { label: 'Создать копию', icon: <Copy />, onClick: () => onDuplicate(workout) },
            {
              label: 'Отменить тренировку',
              icon: <CalendarX2 />,
              onClick: () => {
                setCancelOpen(true);
              },
            },
            { separator: true },
            {
              label: 'Удалить',
              icon: <Trash2 />,
              danger: true,
              onClick: () => {
                setConfirmOpen(true);
              },
            },
          ]}
        />
      </div>

      {cancelOpen && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-skip-soft px-2 py-1.5 text-xs">
          <span>Убрать тренировку на {formatDayKeyShort(workout.date)}?</span>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" className="h-11 px-3 text-xs sm:h-7 sm:px-2" onClick={() => setCancelOpen(false)}>
              Оставить
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-11 px-3 text-xs sm:h-7 sm:px-2"
              onClick={() => {
                cancelWorkout(workout.id);
                setCancelOpen(false);
              }}
            >
              Отменить
            </Button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-danger-soft px-2 py-1.5 text-xs">
          <span className="text-danger-ink">Удалить тренировку?</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-11 px-3 text-xs sm:h-7 sm:px-2" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-11 px-3 text-xs sm:h-7 sm:px-2"
              onClick={() => {
                deleteWorkout(workout.id);
                setConfirmOpen(false);
              }}
            >
              Удалить
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function formatMetric(value: number): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}