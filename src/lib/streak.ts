import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import type { Habit, HabitLog, HabitStatus } from './types';
import { dayKey, isoWeekday } from './dates';

export interface StreakResult {
  current: number;
  best: number;
  totalDone: number;
}

export function logKey(habitId: string, dateKey: string): string {
  return `${habitId}:${dateKey}`;
}

export function logsMap(logs: HabitLog[]): Map<string, HabitLog> {
  return new Map(logs.map((l) => [logKey(l.habitId, l.date), l]));
}

export function isScheduledOn(habit: Habit, date: Date): boolean {
  switch (habit.frequency.type) {
    case 'daily':
      return true;
    case 'days':
      return habit.frequency.days.includes(isoWeekday(date));
    case 'timesPerWeek':
      return true;
  }
}

export function statusOn(logs: HabitLog[], habitId: string, dateKey: string): HabitStatus {
  const log = logs.find((l) => l.habitId === habitId && l.date === dateKey);
  return log?.status ?? 'none';
}

/**
 * Правила серии (streak):
 * - «выполнено» — увеличивает серию;
 * - «пропуск» (skip) — не увеличивает, но и не обрывает, пока число пропусков
 *   подряд не превысит maxConsecutiveSkips;
 * - «нет отметки» — 2+ дня подряд обрывают серию.
 * Серия считается по дням, когда привычка запланирована (частота).
 */
export function computeStreaks(
  habit: Habit,
  logs: HabitLog[],
  today: Date,
  maxConsecutiveSkips: number,
): StreakResult {
  const map = logsMap(logs);
  let run = 0;
  let best = 0;
  let totalDone = 0;
  let missedRun = 0;
  let skipRun = 0;

  let start: Date;
  try {
    start = parseISO(habit.createdAt.slice(0, 10));
  } catch {
    start = today;
  }
  if (differenceInCalendarDays(today, start) < 0) start = today;

  const days = differenceInCalendarDays(today, start);

  for (let i = 0; i <= days; i++) {
    const d = addDays(start, i);
    if (!isScheduledOn(habit, d)) continue;

    const log = map.get(logKey(habit.id, dayKey(d)));
    const status: HabitStatus = log?.status ?? 'none';

    if (status === 'done') {
      run += 1;
      missedRun = 0;
      skipRun = 0;
      totalDone += 1;
    } else if (status === 'skipped') {
      skipRun += 1;
      if (skipRun > maxConsecutiveSkips) {
        run = 0; // слишком много пропусков подряд — серия оборвана
      }
      missedRun = 0;
    } else {
      missedRun += 1;
      skipRun = 0;
      if (missedRun >= 2) {
        run = 0; // 2+ дня без отметки — серия оборвана
      }
    }

    if (run > best) best = run;
  }

  return { current: run, best, totalDone };
}

/**
 * Лучшая серия за всё время с учётом тех же правил обрыва.
 * Нужна, когда best по какой-то причине не был посчитан ранее.
 */
export function computeBestStreak(
  habit: Habit,
  logs: HabitLog[],
  today: Date,
  maxConsecutiveSkips: number,
): number {
  return computeStreaks(habit, logs, today, maxConsecutiveSkips).best;
}