import { useMemo } from 'react';
import { useHabitsStore } from '@/store/habitsStore';
import { lastNDayKeys } from '@/lib/dates';
import { cn } from '@/lib/utils';

/** Мини-график из точек за последние 14 дней */
export function MiniGraph({ habitId, color }: { habitId: string; color: string }) {
  const logs = useHabitsStore((s) => s.logs);
  const days = useMemo(() => lastNDayKeys(14), []);

  return (
    <div className="flex items-end gap-[3px]" aria-label="Прогресс за 14 дней">
      {days.map((d) => {
        const log = logs.find((l) => l.habitId === habitId && l.date === d);
        const status = log?.status ?? 'none';
        return (
          <span
            key={d}
            title={d}
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              status === 'done' && 'opacity-100',
              status === 'skipped' && 'ring-1 ring-skip',
              status === 'none' && 'bg-muted',
            )}
            style={status === 'done' ? { backgroundColor: color } : status === 'skipped' ? { backgroundColor: 'transparent' } : undefined}
          />
        );
      })}
    </div>
  );
}