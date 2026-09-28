import { addDays, dayKey, parseDayKey } from '@/lib/dates';
import type { Habit, HabitLog, StreakInfo, Workout } from '@/lib/types';

/**
 * Сводка для экрана «Профиль».
 *
 * Все числа берутся из уже существующих сторов — отдельного хранилища
 * ради пяти цифр не заводим.
 */

export interface ProfileMetrics {
  /** Сколько дней в приложении есть хоть какая-то запись. */
  daysWithActivity: number;
  /** Выполнение за 30 дней, в процентах. */
  completion30: number;
  /** Самая длинная серия среди всех привычек. */
  bestStreak: number;
  workoutsTotal: number;
  /** Занято браузером под это приложение, байты. */
  storageBytes: number;
  /** Всего записей о привычках — для счётчика рядом с экспортом. */
  logCount: number;
}

/**
 * Дни, в которые привычка должна была быть отмечена.
 *
 * Считаем только дни начиная с создания привычки: иначе привычка,
 * созданная вчера, портила бы среднее как «не выполнено 29 из 30».
 */
function isDue(habit: Habit, key: string): boolean {
  const date = parseDayKey(key);
  if (key < habit.createdAt) return false;
  const f = habit.frequency;
  if (f.type === 'daily') return true;
  if (f.type === 'days') {
    // isoWeekday в датах: 1 = понедельник … 7 = воскресенье.
    const d = date.getDay();
    return f.days.includes(d === 0 ? 7 : d);
  }
  // timesPerWeek: точный счёт дней не вывести, поэтому день считается
  // пригодным для отметки, но не входит в знаменатель точным числом.
  return true;
}

export function computeMetrics(
  habits: Habit[],
  logs: HabitLog[],
  streaks: Record<string, StreakInfo>,
  workouts: Workout[],
): Omit<ProfileMetrics, 'storageBytes'> {
  const active = habits.filter((h) => !h.archived);

  // Дни с активностью: объединение дат отметок и тренировок.
  const days = new Set<string>();
  for (const l of logs) days.add(l.date);
  for (const w of workouts) days.add(w.date);

  // Выполнение за 30 дней.
  const window: string[] = [];
  const start = addDays(new Date(), -29);
  for (let i = 0; i < 30; i++) window.push(dayKey(addDays(start, i)));

  const doneByKey = new Map<string, Set<string>>();
  for (const l of logs) {
    if (l.status !== 'done') continue;
    const set = doneByKey.get(`${l.habitId}:${l.date}`);
    if (set) set.add(l.habitId);
    else doneByKey.set(`${l.habitId}:${l.date}`, new Set([l.habitId]));
  }

  let dueTotal = 0;
  let doneTotal = 0;
  for (const habit of active) {
    if (habit.frequency.type === 'timesPerWeek') continue; // нет честного знаменателя
    for (const key of window) {
      if (!isDue(habit, key)) continue;
      dueTotal++;
      if (doneByKey.get(`${habit.id}:${key}`)) doneTotal++;
    }
  }

  let bestStreak = 0;
  for (const s of Object.values(streaks)) bestStreak = Math.max(bestStreak, s.best ?? 0);

  return {
    daysWithActivity: days.size,
    completion30: dueTotal === 0 ? 0 : Math.round((doneTotal / dueTotal) * 100),
    bestStreak,
    workoutsTotal: workouts.length,
    logCount: logs.length,
  };
}

/**
 * Занятое браузером место. Точной цифры «сколько весит Momentum»
 * браузер не отдаёт, поэтому это честная оценка хранилища origin'а.
 */
export async function storageUsed(): Promise<number> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return 0;
  try {
    const { usage } = await navigator.storage.estimate();
    return Number(usage ?? 0);
  } catch {
    return 0;
  }
}

/** Байты в вид, который читается: «1,2 МБ» или «340 КБ». */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 КБ';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/** Инициалы для аватара: «Иван Петров» → «ИП», без имени → «М». */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'М';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
