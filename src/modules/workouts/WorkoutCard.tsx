import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Dumbbell, Pencil, Trash2 } from 'lucide-react';
import type { Workout } from '@/lib/types';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { WORKOUT_TYPE_META } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { cn, vibrate } from '@/lib/utils';

export function WorkoutCard({
  workout,
  onEdit,
  highlight = false,
}: {
  workout: Workout;
  onEdit: (w: Workout) => void;
  highlight?: boolean;
}) {
  const exercises = useWorkoutsStore((s) => s.exercises.filter((e) => e.workoutId === workout.id));
  const toggleWorkout = useWorkoutsStore((s) => s.toggleWorkout);
  const deleteWorkout = useWorkoutsStore((s) => s.deleteWorkout);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const meta = WORKOUT_TYPE_META[workout.type];
  const totalSets = exercises.reduce((a, e) => a + e.sets, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-2.5 shadow-soft transition-all',
        workout.completed && 'border-transparent bg-muted/50 opacity-75',
        highlight && 'ring-1 ring-primary/40',
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: meta.color }}
      />
      <div className="flex items-start gap-2 pl-1.5">
        <button
          onClick={() => {
            toggleWorkout(workout.id);
            vibrate(10);
          }}
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90',
            workout.completed
              ? 'border-transparent bg-gradient-to-br from-violet-500 to-blue-500 text-white'
              : 'border-border/80 text-transparent hover:border-primary/50',
          )}
          aria-label={workout.completed ? 'Снять отметку' : 'Отметить выполненной'}
        >
          {workout.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
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
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium" style={{ color: meta.color, backgroundColor: `${meta.color}18` }}>
              {meta.label}
            </span>
            {exercises.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Dumbbell className="h-3 w-3" />
                {exercises.length} упр.
              </span>
            )}
            {totalSets > 0 && <span>· {totalSets} подходов</span>}
          </div>
        </div>

        <Menu
          align="end"
          trigger={
            <button
              className="rounded-lg p-1 text-muted-foreground/60 opacity-70 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
              aria-label="Действия с тренировкой"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          }
          items={[
            { label: 'Редактировать', icon: <Pencil />, onClick: () => onEdit(workout) },
            { label: 'Копировать на другой день', icon: <Copy />, onClick: () => onEdit(workout) },
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

      {confirmOpen && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs">
          <span className="text-destructive">Удалить тренировку?</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
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