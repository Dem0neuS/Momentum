import { useMemo, useState } from 'react';
import { CheckCircle2, Dumbbell, Flame } from 'lucide-react';
import type { Workout } from '@/lib/types';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { addDays, dayKey, startOfWeek, todayKey } from '@/lib/dates';
import { WeekGrid } from './WeekGrid';
import { WorkoutForm } from './WorkoutForm';

export function WorkoutsPage() {
  const workouts = useWorkoutsStore((s) => s.workouts);
  const exercises = useWorkoutsStore((s) => s.exercises);

  const [weekStart, setWeekStart] = useState(() => dayKey(startOfWeek(new Date())));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);
  const [addDate, setAddDate] = useState(todayKey());

  const week = useMemo(() => {
    const d = new Date(weekStart + 'T12:00:00');
    if (isNaN(d.getTime())) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const dd = addDays(d, i);
      return dayKey(dd);
    });
  }, [weekStart]);

  const weekWorkouts = workouts.filter((w) => week.includes(w.date));
  const done = weekWorkouts.filter((w) => w.completed).length;
  const totalEx = weekWorkouts.reduce(
    (a, w) => a + exercises.filter((e) => e.workoutId === w.id).length,
    0,
  );
  const totalWeight = weekWorkouts.reduce((a, w) => {
    return (
      a +
      exercises
        .filter((e) => e.workoutId === w.id)
        .reduce((x, e) => x + e.weight * e.sets * e.reps, 0)
    );
  }, 0);

  const today = todayKey();
  const todayCount = workouts.filter((w) => w.date === today && !w.completed).length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Тренировки</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {weekWorkouts.length === 0
              ? 'План на неделю пуст — добавьте первую тренировку'
              : `${weekWorkouts.length} ${weekWord(weekWorkouts.length)} на этой неделе`}
            {todayCount > 0 ? ` · сегодня: ${todayCount}` : ''}
          </p>
        </div>
      </div>

      {/* Сводка недели */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Выполнено" value={`${done} из ${weekWorkouts.length}`} />
        <SummaryCard icon={<Dumbbell className="h-4 w-4" />} label="Упражнений" value={`${totalEx}`} />
        <SummaryCard
          icon={<Flame className="h-4 w-4" />}
          label="Объём"
          value={totalWeight > 0 ? `${Math.round(totalWeight / 100) / 10} т` : '0'}
        />
      </div>

      <WeekGrid
        weekStart={weekStart}
        onWeekChange={setWeekStart}
        onAddWorkout={(date) => {
          setEditing(null);
          setAddDate(date);
          setFormOpen(true);
        }}
        onEditWorkout={(w) => {
          setEditing(w);
          setFormOpen(true);
        }}
        onDuplicate={(w) => {
          setEditing(null);
          setAddDate(w.date);
          setFormOpen(true);
        }}
      />

      <WorkoutForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        workout={editing}
        defaultDate={addDate}
        onWorkoutCreated={(id) => {
          setEditing(useWorkoutsStore.getState().workouts.find((w) => w.id === id) ?? null);
        }}
      />
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-soft">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold leading-none">{value}</p>
    </div>
  );
}

function weekWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'тренировок';
  if (last > 1 && last < 5) return 'тренировки';
  if (last === 1) return 'тренировка';
  return 'тренировок';
}