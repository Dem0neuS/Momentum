import { useMemo, useState } from 'react';
import { Check, Flame, Pencil, Pause, Trophy } from 'lucide-react';
import type { Habit } from '@/lib/types';
import { useHabitsStore } from '@/store/habitsStore';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { todayKey } from '@/lib/dates';
import { plural } from '@/lib/utils';
import { HabitHeatmap } from './HabitHeatmap';
import { MiniGraph } from './MiniGraph';
import { SkipMenuDialog } from './SkipMenu';

export function HabitDetail({
  habit,
  onClose,
  onEdit,
}: {
  habit: Habit | null;
  onClose: () => void;
  onEdit: (h: Habit) => void;
}) {
  const logs = useHabitsStore((s) => s.logs);
  const streaks = useHabitsStore((s) => s.streaks);
  const archiveHabit = useHabitsStore((s) => s.archiveHabit);
  const [skipOpen, setSkipOpen] = useState(false);

  const today = todayKey();

  const data = useMemo(() => {
    if (!habit) return null;
    const habitLogs = logs.filter((l) => l.habitId === habit.id);
    const streak = streaks[habit.id];
    const monthKey = today.slice(0, 7);
    const thisMonth = habitLogs.filter((l) => l.date.startsWith(monthKey)).length;
    return { habitLogs, streak, thisMonth };
  }, [habit, logs, streaks, today]);

  if (!habit || !data) return null;

  const logToday = logs.find((l) => l.habitId === habit.id && l.date === today);
  const statusToday = logToday?.status ?? 'none';

  return (
    <>
      <Dialog
        open={!!habit}
        onClose={onClose}
        title={null}
        ariaLabel={habit ? `Привычка «${habit.name}»` : 'Привычка'}
        size="lg"
      >
        <div className="space-y-5">
          {/* Шапка */}
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl"
              style={{ backgroundColor: `${habit.color}22` }}
            >
              {habit.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold leading-tight">{habit.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {habit.frequency.type === 'daily' && 'Ежедневно'}
                {habit.frequency.type === 'days' && `По дням: ${habit.frequency.days.length} ${plural(habit.frequency.days.length, ['день', 'дня', 'дней'])}`}
                {habit.frequency.type === 'timesPerWeek' && `${habit.frequency.times} раз в неделю`}
                {habit.targetCount > 0 && ` · цель ${habit.targetCount}${habit.counterUnit ? ` ${habit.counterUnit}` : ''}`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(habit)}>
              <Pencil className="h-3.5 w-3.5" /> Изменить
            </Button>
          </div>

          {/* Серия */}
          <div className="grid grid-cols-4 gap-2">
            <StatCard icon={<Flame className="h-4 w-4 text-warning-ink" />} value={data.streak?.current ?? 0} label="текущая серия" />
            <StatCard icon={<Trophy className="h-4 w-4 text-warning-ink" />} value={data.streak?.best ?? 0} label="лучшая серия" />
            <StatCard icon={<Check className="h-4 w-4 text-success-ink" />} value={data.streak?.totalDone ?? 0} label={`выполнено ${plural(data.streak?.totalDone ?? 0, ['день', 'дня', 'дней'])}`} />
            <StatCard icon={<span className="text-xs">📅</span>} value={data.thisMonth} label="в этом месяце" />
          </div>

          {/* Сегодня */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] text-on-brand"
                style={{ backgroundColor: habit.color }}
              >
                {habit.icon}
              </span>
              Сегодня:
            </div>
            {habit.allowSkips && (
              <Button size="sm" variant={statusToday === 'skipped' ? 'skip' : 'outline'} onClick={() => setSkipOpen(true)}>
                <Pause className="h-3.5 w-3.5" /> {statusToday === 'skipped' ? 'Пропуск' : 'Пропустить'}
              </Button>
            )}
            <Button
              size="sm"
              variant={statusToday === 'done' ? 'success' : 'gradient'}
              onClick={() => useHabitsStore.getState().setFull(habit.id, today, statusToday !== 'done')}
            >
              <Check className="h-3.5 w-3.5" /> {statusToday === 'done' ? 'Снять отметку' : 'Отметить'}
            </Button>
            {statusToday !== 'none' && (
              <Button size="sm" variant="ghost" onClick={() => useHabitsStore.getState().clearLog(habit.id, today)}>
                Очистить
              </Button>
            )}
          </div>

          {/* 14 дней */}
          <div>
            <p className="mb-2 text-sm font-semibold">Последние 14 дней</p>
            <div className="flex items-center gap-1.5">
              <MiniGraph habitId={habit.id} color={habit.color} />
              {logToday?.skipReason && <Badge variant="skip">причина: {logToday.skipReason}</Badge>}
            </div>
          </div>

          {/* Heatmap */}
          <div>
            <p className="mb-2 text-sm font-semibold">Год в деталях</p>
            <HabitHeatmap habit={habit} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Клик по дню — отметить, пропустить или очистить. Пропуск отображается янтарным.
            </p>
          </div>

          {/* Действия */}
          <div className="flex items-center justify-between border-t border-border/50 pt-4">
            <Button variant="ghost" size="sm" onClick={() => archiveHabit(habit.id)}>
              {habit.archived ? 'Вернуть из архива' : 'В архив'}
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>Закрыть</Button>
          </div>
        </div>
      </Dialog>

      <SkipMenuDialog open={skipOpen} onClose={() => setSkipOpen(false)} habit={habit} date={today} />
    </>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-background/40 px-2 py-3 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}