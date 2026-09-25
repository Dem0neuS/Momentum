import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus } from 'lucide-react';
import type { Workout } from '@/lib/types';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { dayKey, formatWeekdayShort, startOfWeek, todayKey } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkoutCard } from './WorkoutCard';
import { cn } from '@/lib/utils';

export function WeekGrid({
  weekStart,
  onWeekChange,
  onAddWorkout,
  onEditWorkout,
  onDuplicate,
}: {
  weekStart: string; // yyyy-MM-dd первого дня недели (Пн)
  onWeekChange: (start: string) => void;
  onAddWorkout: (date: string) => void;
  onEditWorkout: (w: Workout) => void;
  onDuplicate: (w: Workout) => void;
}) {
  const workouts = useWorkoutsStore((s) => s.workouts);
  const copyWeek = useWorkoutsStore((s) => s.copyWeek);
  const [copyOpen, setCopyOpen] = useState(false);

  const start = useMemo(() => {
    const d = new Date(weekStart + 'T12:00:00');
    return isNaN(d.getTime()) ? startOfWeek(new Date()) : d;
  }, [weekStart]);

  const days = useMemo(() => {
    const dd = new Date(start);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() + i);
      return { key: dayKey(d), date: d };
    });
  }, [start]);

  const byDate = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of workouts) {
      const arr = m.get(w.date) ?? [];
      arr.push(w);
      m.set(w.date, arr);
    }
    return m;
  }, [workouts]);

  const today = todayKey();
  const isCurrentWeek = days.some((d) => d.key === today);

  const shift = (n: number) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + n * 7);
    onWeekChange(dayKey(d));
  };

  return (
    <div className="space-y-3">
      {/* Навигация по неделе */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Предыдущая неделя">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Следующая неделя">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="truncate text-sm font-semibold">
            {days[0].date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} —{' '}
            {days[6].date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={() => onWeekChange(startOfWeek(new Date()).toISOString().slice(0, 10))}>
              Сегодня
            </Button>
          )}
          <Input
            type="date"
            value={weekStart}
            onChange={(e) => e.target.value && onWeekChange(e.target.value)}
            className="h-8 w-40 rounded-lg text-xs"
            aria-label="Перейти к неделе"
          />
          <Button variant="outline" size="sm" onClick={() => setCopyOpen(!copyOpen)} title="Скопировать неделю">
            <Copy className="h-3.5 w-3.5" /> Копировать
          </Button>
        </div>
      </div>

      {copyOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3 text-sm">
          <span className="text-muted-foreground">Скопировать эту неделю в:</span>
          <Input
            type="date"
            className="h-8 w-40 rounded-lg text-xs"
            defaultValue={dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7))}
            id="copy-to-date"
            aria-label="Неделя-получатель"
          />
          <Button
            variant="gradient"
            size="sm"
            onClick={() => {
              const el = document.getElementById('copy-to-date') as HTMLInputElement | null;
              if (el?.value) {
                copyWeek(weekStart, el.value);
                setCopyOpen(false);
              }
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Копировать
          </Button>
        </div>
      )}

      {/* Сетка 7 дней */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-7 md:items-start">
        {days.map(({ key, date }) => {
          const list = byDate.get(key) ?? [];
          const isToday = key === today;
          return (
            <div
              key={key}
              className={cn(
                'flex min-h-[88px] flex-col gap-1.5 rounded-2xl border p-2 md:min-h-[220px]',
                isToday ? 'border-primary/40 bg-primary/[0.04]' : 'border-border/50 bg-card/60',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-[11px] font-semibold uppercase tracking-wide', isToday ? 'text-primary' : 'text-muted-foreground')}>
                  {formatWeekdayShort(date)}
                </span>
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                    isToday ? 'bg-gradient-to-br from-violet-500 to-blue-500 text-white' : 'text-muted-foreground',
                  )}
                >
                  {date.getDate()}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1.5">
                {list.map((w) => (
                  <WorkoutCard key={w.id} workout={w} onEdit={onEditWorkout} />
                ))}
                {list.length === 0 && (
                  <p className="hidden text-[11px] text-muted-foreground/60 md:block">Отдых — тоже прогресс</p>
                )}
              </div>

              <button
                onClick={() => onAddWorkout(key)}
                className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Plus className="h-3 w-3" /> Тренировка
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}