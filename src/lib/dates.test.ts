import { describe, it, expect } from 'vitest';
import {
  dayKey,
  todayKey,
  parseDayKey,
  addDays,
  startOfWeek,
  daysBetween,
  lastNDays,
  lastNDayKeys,
  isoSameDay,
  monthRange,
  dayOfYear,
  isoWeekday,
  nextNDaysFromToday,
  formatDayLong,
  formatDayTitle,
  formatDayKeyShort,
  formatMonthShort,
  isDateInPast,
  isDateInFuture,
  isToday,
  inRange,
  dayCountWord,
  greetingByHour,
} from '@/lib/dates';

/** 2026-01-05 — понедельник, удобная точка отсчёта. */
const monday = new Date(2026, 0, 5, 12, 0, 0);
const mondayKey = '2026-01-05';

describe('dates: ключи дней', () => {
  it('dayKey форматирует локальную дату как yyyy-MM-dd', () => {
    expect(dayKey(monday)).toBe(mondayKey);
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('todayKey возвращает сегодняшний ключ', () => {
    expect(todayKey()).toBe(dayKey(new Date()));
  });

  it('parseDayKey и dayKey — обратные операции', () => {
    const d = parseDayKey(mondayKey);
    expect(dayKey(d)).toBe(mondayKey);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(5);
  });

  it('addDays сдвигает через границу месяца', () => {
    expect(dayKey(addDays(monday, 27))).toBe('2026-02-01');
    expect(dayKey(addDays(monday, -5))).toBe('2025-12-31');
  });

  it('daysBetween считает календарные дни', () => {
    expect(daysBetween(monday, new Date(2026, 0, 9))).toBe(4);
    expect(daysBetween(monday, monday)).toBe(0);
    expect(daysBetween(monday, new Date(2026, 0, 1))).toBe(-4);
  });

  it('lastNDays заканчивается на заданном дне и идёт по возрастанию', () => {
    const days = lastNDays(3, monday);
    expect(days.map(dayKey)).toEqual(['2026-01-03', '2026-01-04', mondayKey]);
  });

  it('lastNDayKeys возвращает n ключей, последний — end', () => {
    expect(lastNDayKeys(3, monday)).toEqual(['2026-01-03', '2026-01-04', mondayKey]);
    expect(lastNDayKeys(1, monday)).toEqual([mondayKey]);
  });

  it('nextNDaysFromToday начинается с сегодня', () => {
    const keys = nextNDaysFromToday(3);
    expect(keys[0]).toBe(todayKey());
    expect(keys).toHaveLength(3);
  });

  it('isoSameDay сравнивает по календарю, а не по времени', () => {
    expect(isoSameDay(new Date(2026, 0, 5, 1), new Date(2026, 0, 5, 23))).toBe(true);
    expect(isoSameDay(monday, new Date(2026, 0, 6))).toBe(false);
  });

  it('monthRange даёт первое и последнее число месяца', () => {
    const { start, end } = monthRange(new Date(2026, 1, 15));
    expect(dayKey(start)).toBe('2026-02-01');
    expect(dayKey(end)).toBe('2026-02-28');
  });

  it('dayOfYear считает от начала года', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });
});

describe('dates: неделя', () => {
  it('startOfWeek — это понедельник', () => {
    expect(dayKey(startOfWeek(monday))).toBe('2026-01-05');
    expect(dayKey(startOfWeek(new Date(2026, 0, 7)))).toBe('2026-01-05'); // среда
    expect(dayKey(startOfWeek(new Date(2026, 0, 11)))).toBe('2026-01-05'); // воскресенье
  });

  it('isoWeekday: 1 = понедельник … 7 = воскресенье', () => {
    expect(isoWeekday(monday)).toBe(1);
    expect(isoWeekday(new Date(2026, 0, 10))).toBe(6); // суббота
    expect(isoWeekday(new Date(2026, 0, 11))).toBe(7); // воскресенье
  });
});

describe('dates: подписи для интерфейса', () => {
  it('formatDayKeyShort даёт «д месяц»', () => {
    expect(formatDayKeyShort(mondayKey)).toBe('5 января');
  });

  it('formatDayKeyShort на битом ключе возвращает его как есть', () => {
    expect(formatDayKeyShort('не-дата')).toBe('не-дата');
  });

  it('formatMonthShort убирает точку после сокращения', () => {
    expect(formatMonthShort(new Date(2026, 0, 15))).toBe('янв');
    expect(formatMonthShort(new Date(2026, 1, 15))).toBe('фев');
  });

  it('formatDayLong и formatDayTitle склоняют месяц', () => {
    expect(formatDayLong(monday)).toBe('понедельник, 5 января');
    expect(formatDayTitle(monday)).toBe('5 января 2026');
  });
});

describe('dates: сравнение с сегодня', () => {
  it('isToday ловит текущий день', () => {
    expect(isToday(new Date())).toBe(true);
    expect(isToday(monday)).toBe(false);
  });

  it('прошлое и будущее считаются по календарю', () => {
    expect(isDateInPast(addDays(new Date(), -1))).toBe(true);
    expect(isDateInPast(new Date())).toBe(false);
    expect(isDateInFuture(addDays(new Date(), 1))).toBe(true);
    expect(isDateInFuture(new Date())).toBe(false);
  });

  it('inRange включает границы и игнорирует время суток', () => {
    expect(inRange(new Date(2026, 0, 5, 23), new Date(2026, 0, 1), new Date(2026, 0, 9))).toBe(true);
    expect(inRange(new Date(2026, 0, 1), new Date(2026, 0, 1), new Date(2026, 0, 9))).toBe(true);
    expect(inRange(new Date(2026, 0, 9), new Date(2026, 0, 1), new Date(2026, 0, 9))).toBe(true);
    expect(inRange(new Date(2026, 0, 10), new Date(2026, 0, 1), new Date(2026, 0, 9))).toBe(false);
  });
});

describe('dates: русские склонения', () => {
  it('dayCountWord: 1 день, 2 дня, 5 дней', () => {
    expect(dayCountWord(1)).toBe('день');
    expect(dayCountWord(2)).toBe('дня');
    expect(dayCountWord(4)).toBe('дня');
    expect(dayCountWord(5)).toBe('дней');
    expect(dayCountWord(0)).toBe('дней');
  });

  it('dayCountWord: 11–14 всегда «дней»', () => {
    expect(dayCountWord(11)).toBe('дней');
    expect(dayCountWord(12)).toBe('дней');
    expect(dayCountWord(14)).toBe('дней');
    expect(dayCountWord(111)).toBe('дней');
  });

  it('dayCountWord: 21 день, 22 дня, 25 дней', () => {
    expect(dayCountWord(21)).toBe('день');
    expect(dayCountWord(22)).toBe('дня');
    expect(dayCountWord(25)).toBe('дней');
    expect(dayCountWord(101)).toBe('день');
  });

  it('dayCountWord работает и с отрицательными', () => {
    expect(dayCountWord(-1)).toBe('день');
    expect(dayCountWord(-3)).toBe('дня');
    expect(dayCountWord(-5)).toBe('дней');
  });
});

describe('dates: приветствие по часу', () => {
  it('разбивает сутки на четыре отрезка', () => {
    expect(greetingByHour(4)).toBe('Доброй ночи');
    expect(greetingByHour(5)).toBe('Доброе утро');
    expect(greetingByHour(11)).toBe('Доброе утро');
    expect(greetingByHour(12)).toBe('Добрый день');
    expect(greetingByHour(17)).toBe('Добрый день');
    expect(greetingByHour(18)).toBe('Добрый вечер');
    expect(greetingByHour(22)).toBe('Добрый вечер');
    expect(greetingByHour(23)).toBe('Доброй ночи');
    expect(greetingByHour(0)).toBe('Доброй ночи');
  });
});
