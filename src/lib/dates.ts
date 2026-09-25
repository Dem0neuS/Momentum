import {
  format,
  parseISO,
  addDays as dfAddDays,
  startOfWeek as dfStartOfWeek,
  differenceInCalendarDays,
  eachDayOfInterval,
  getDayOfYear,
  getDay,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns';
import { ru } from 'date-fns/locale';

export const DAY_KEY_FMT = 'yyyy-MM-dd';

/** Ключ дня: 'yyyy-MM-dd' */
export function dayKey(d: Date): string {
  return format(d, DAY_KEY_FMT);
}

export function todayKey(): string {
  return dayKey(new Date());
}

export function parseDayKey(key: string): Date {
  return parseISO(key);
}

export function addDays(d: Date, n: number): Date {
  return dfAddDays(d, n);
}

export function startOfWeek(d: Date): Date {
  return dfStartOfWeek(d, { weekStartsOn: 1 });
}

export function daysBetween(from: Date, to: Date): number {
  return differenceInCalendarDays(to, from);
}

export function lastNDays(n: number, end = new Date()): Date[] {
  return eachDayOfInterval({ start: addDays(startOfDay(end), -(n - 1)), end: startOfDay(end) });
}

export function lastNDayKeys(n: number, end = new Date()): string[] {
  return lastNDays(n, end).map(dayKey);
}

export function isoSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function monthRange(d: Date): { start: Date; end: Date } {
  return { start: startOfMonth(d), end: endOfMonth(d) };
}

export { startOfMonth, endOfMonth } from 'date-fns';

export function dayOfYear(d: Date): number {
  return getDayOfYear(d);
}

/** ISO-день недели: 1 = Пн … 7 = Вс (для частот привычек) */
export function isoWeekday(d: Date): number {
  const js = getDay(d); // 0 = Вс
  return js === 0 ? 7 : js;
}

export function nextNDaysFromToday(n: number): string[] {
  return Array.from({ length: n }, (_, i) => dayKey(addDays(new Date(), i)));
}

export function formatDayLong(d: Date): string {
  return format(d, 'EEEE, d MMMM', { locale: ru });
}

export function formatDayTitle(d: Date): string {
  return format(d, 'd MMMM yyyy', { locale: ru });
}

/** Короткая подпись дня по ключу: '25 сентября' */
export function formatDayKeyShort(key: string): string {
  const d = parseDayKey(key);
  return isNaN(d.getTime()) ? key : format(d, 'd MMMM', { locale: ru });
}

export function formatWeekdayShort(d: Date): string {
  return format(d, 'EEE', { locale: ru });
}

export function formatMonthShort(d: Date): string {
  return format(d, 'LLLL', { locale: ru });
}

export function formatMonthYear(d: Date): string {
  return format(d, 'LLLL yyyy', { locale: ru });
}

export function isDateInPast(d: Date): boolean {
  return isBefore(startOfDay(d), startOfDay(new Date()));
}

export function isDateInFuture(d: Date): boolean {
  return isAfter(startOfDay(d), startOfDay(new Date()));
}

export function isToday(d: Date): boolean {
  return isoSameDay(d, new Date());
}

export function inRange(d: Date, start: Date, end: Date): boolean {
  return isWithinInterval(startOfDay(d), { start: startOfDay(start), end: startOfDay(end) });
}

/** Русская склонённая форма: 5 дней, 2 дня, 1 день */
export function dayCountWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (last > 1 && last < 5) return 'дня';
  if (last === 1) return 'день';
  return 'дней';
}

export function greetingByHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}