import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Eraser, Pause } from 'lucide-react';
import type { Habit } from '@/lib/types';
import { useHabitsStore } from '@/store/habitsStore';
import { addDays, dayKey, parseDayKey, formatMonthShort, isoSameDay, startOfWeek, todayKey } from '@/lib/dates';
import { SKIP_REASONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface DayMenu {
  dateKey: string;
  x: number;
  y: number;
  view: 'main' | 'reasons';
}

/** Heatmap в стиле GitHub за 52 недели */
export function HabitHeatmap({ habit }: { habit: Habit }) {
  const logs = useHabitsStore((s) => s.logs);
  const [menu, setMenu] = useState<DayMenu | null>(null);

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    const start = addDays(startOfWeek(today), -51 * 7);
    const weeks: Date[][] = [];
    const labels: (string | null)[] = [];
    let prevMonth = -1;
    for (let w = 0; w < 52; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(addDays(start, w * 7 + d));
      }
      const m = week[0].getMonth();
      labels.push(m !== prevMonth && w > 0 ? formatMonthShort(week[0]) : w === 0 ? formatMonthShort(week[0]) : null);
      prevMonth = m;
      weeks.push(week);
    }
    return { weeks, monthLabels: labels };
  }, []);

  const today = todayKey();

  const openMenu = (dateKey: string, e: React.MouseEvent) => {
    if (dateKey > today) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      dateKey,
      x: Math.min(rect.left, window.innerWidth - 200),
      y: rect.bottom + 6,
      view: 'main',
    });
  };

  const act = (status: 'done' | 'skipped' | 'none', reason?: string) => {
    if (!menu) return;
    useHabitsStore.getState().setLogStatus(habit.id, menu.dateKey, status, reason);
    setMenu(null);
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-max">
          {/* Метки месяцев */}
          <div className="mb-1 flex gap-[3px] pl-7">
            {weeks.map((_, i) => (
              <div key={i} className="w-3 shrink-0 text-[9px] leading-3 text-muted-foreground">
                {monthLabels[i] ?? ''}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {/* Метки дней */}
            <div className="mr-1 flex w-6 flex-col gap-[3px] text-[9px] leading-3 text-muted-foreground">
              {['Пн', '', 'Ср', '', 'Пт', '', 'Вс'].map((d, i) => (
                <div key={i} className="flex h-3 items-center">{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((d) => {
                  const key = dayKey(d);
                  const log = logs.find((l) => l.habitId === habit.id && l.date === key);
                  const status = log?.status ?? 'none';
                  const future = key > today;
                  return (
                    <button
                      key={key}
                      onClick={(e) => openMenu(key, e)}
                      title={
                        future
                          ? undefined
                          : `${key}${log?.skipReason ? ` — ${log.skipReason}` : ''} · ${
                              status === 'done'
                                ? 'выполнено'
                                : status === 'skipped'
                                  ? 'пропуск'
                                  : 'без отметки'
                            }`
                      }
                      className={cn(
                        'h-3 w-3 rounded-[3px] transition-transform hover:scale-125',
                        future && 'cursor-default',
                        status === 'none' && !future && 'bg-muted',
                        status === 'skipped' && 'ring-1 ring-inset ring-skip/70 bg-skip/15',
                        isoSameDay(d, new Date()) && !future && 'ring-2 ring-primary/70',
                      )}
                      style={
                        status === 'done'
                          ? { backgroundColor: habit.color }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-52 rounded-xl border border-border/70 bg-popover p-1.5 shadow-soft-lg"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {menu.view === 'main' ? (
              <>
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">
                  {parseDayKey(menu.dateKey).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </p>
                <HeatmapItem icon={Check} label="Отметить выполненной" onClick={() => act('done')} />
                <HeatmapItem icon={Pause} label="Пропустить день" onClick={() => setMenu({ ...menu, view: 'reasons' })} />
                <HeatmapItem icon={Eraser} label="Очистить" danger onClick={() => act('none')} />
              </>
            ) : (
              <>
                <button
                  className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
                  onClick={() => setMenu({ ...menu, view: 'main' })}
                >
                  ← Назад
                </button>
                <HeatmapItem label="Без причины" onClick={() => act('skipped')} />
                {SKIP_REASONS.filter((r) => r.value !== 'Свой вариант').map((r) => (
                  <HeatmapItem key={r.value} label={`${r.icon} ${r.value}`} onClick={() => act('skipped', r.value)} />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function HeatmapItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
        danger ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-accent',
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}