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
          <div className="mb-1 flex gap-3 pl-[47px] sm:gap-[3px] sm:pl-7">
            {weeks.map((_, i) => (
              <div
                key={i}
                className="w-11 shrink-0 whitespace-nowrap text-[9px] leading-3 text-muted-foreground sm:w-3"
              >
                {monthLabels[i] ?? ''}
              </div>
            ))}
          </div>
          <div className="flex gap-3 sm:gap-[3px]">
            {/* Метки дней */}
            <div className="mr-1 flex w-10 flex-col gap-3 whitespace-nowrap text-[9px] leading-3 text-muted-foreground sm:w-6 sm:gap-[3px]">
              {['Пн', '', 'Ср', '', 'Пт', '', 'Вс'].map((d, i) => (
                <div key={i} className="flex h-11 items-center justify-center sm:h-3 sm:justify-start">
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-3 sm:gap-[3px]">
                {week.map((d) => {
                  const key = dayKey(d);
                  const log = logs.find((l) => l.habitId === habit.id && l.date === key);
                  const status = log?.status ?? 'none';
                  const future = key > today;
                  const level = getHeatLevel(habit, log);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => openMenu(key, e)}
                      disabled={future}
                      aria-label={`${key}: ${
                        status === 'done'
                          ? 'выполнено'
                          : status === 'skipped'
                            ? 'пропуск'
                            : 'без отметки'
                      }`}
                      aria-haspopup="menu"
                      aria-current={isoSameDay(d, new Date()) && !future ? 'date' : undefined}
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
                      className="group flex h-11 w-11 items-center justify-center rounded-md focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-default sm:h-3 sm:w-3"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'pointer-events-none h-3.5 w-3.5 rounded-sm transition-transform group-hover:scale-125 sm:h-3 sm:w-3',
                          status === 'skipped' && 'ring-1 ring-inset ring-skip/70',
                          isoSameDay(d, new Date()) && !future && 'ring-2 ring-primary/70',
                        )}
                        style={{
                          backgroundColor:
                            status === 'done'
                              ? `var(--heat-${level})`
                              : status === 'skipped'
                                ? 'var(--skip-soft)'
                                : 'var(--heat-0)',
                        }}
                      />
                    </button>
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
            role="menu"
            aria-label="Действия с отметкой дня"
            className="fixed z-50 w-52 rounded-lg border border-border/70 bg-popover p-1.5 shadow-pop"
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
                  type="button"
                  role="menuitem"
                  className="mb-1 min-h-tap w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
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

function getHeatLevel(habit: Habit, log: { value: number; status: string } | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!log || (log.status !== 'done' && log.value <= 0)) return 0;
  if (habit.targetCount <= 0) return log.status === 'done' ? 4 : 0;
  return Math.max(1, Math.min(4, Math.ceil((log.value / habit.targetCount) * 4))) as 1 | 2 | 3 | 4;
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
      type="button"
      onClick={onClick}
      role="menuitem"
      className={cn(
        'flex min-h-tap w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60',
        danger ? 'text-destructive-ink hover:bg-destructive/10' : 'hover:bg-accent',
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}