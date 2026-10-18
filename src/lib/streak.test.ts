import { describe, it, expect } from 'vitest';
import {
  logKey,
  logsMap,
  isScheduledOn,
  statusOn,
  computeStreaks,
  computeBestStreak,
} from '@/lib/streak';
import type { Habit, HabitFrequency, HabitLog, HabitStatus } from '@/lib/types';

function makeHabit(frequency: HabitFrequency, createdAt = '2026-01-01'): Habit {
  return {
    id: 'h1',
    name: 'Тест',
    icon: '💧',
    color: '#4A8CFF',
    categoryId: null,
    subcategoryId: null,
    frequency,
    targetCount: 0,
    counterUnit: '',
    allowSkips: true,
    createdAt,
    archived: false,
  };
}

function log(habitId: string, date: string, status: HabitStatus): HabitLog {
  return {
    id: `${habitId}:${date}`,
    habitId,
    date,
    value: 0,
    completed: status === 'done',
    status,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

describe('streak: вспомогательные функции', () => {
  it('logKey склеивает привычку и день', () => {
    expect(logKey('h1', '2026-01-05')).toBe('h1:2026-01-05');
  });

  it('logsMap строит карту по ключу', () => {
    const map = logsMap([log('h1', '2026-01-01', 'done'), log('h2', '2026-01-02', 'skipped')]);
    expect(map.size).toBe(2);
    expect(map.get('h1:2026-01-01')?.status).toBe('done');
    expect(map.get('h2:2026-01-02')?.status).toBe('skipped');
  });

  it('statusOn отдаёт статус или none', () => {
    const logs = [log('h1', '2026-01-01', 'done')];
    expect(statusOn(logs, 'h1', '2026-01-01')).toBe('done');
    expect(statusOn(logs, 'h1', '2026-01-02')).toBe('none');
  });

  it('isScheduledOn: daily — всегда', () => {
    const h = makeHabit({ type: 'daily' });
    expect(isScheduledOn(h, new Date(2026, 0, 5))).toBe(true);
  });

  it('isScheduledOn: days — только выбранные дни недели (Пн = 1)', () => {
    const h = makeHabit({ type: 'days', days: [1, 5] });
    expect(isScheduledOn(h, new Date(2026, 0, 5))).toBe(true); // понедельник
    expect(isScheduledOn(h, new Date(2026, 0, 2))).toBe(true); // пятница
    expect(isScheduledOn(h, new Date(2026, 0, 6))).toBe(false); // вторник
  });

  it('isScheduledOn: timesPerWeek считается доступным каждый день', () => {
    const h = makeHabit({ type: 'timesPerWeek', times: 3 });
    expect(isScheduledOn(h, new Date(2026, 0, 6))).toBe(true);
  });
});

describe('streak: computeStreaks', () => {
  const today = new Date(2026, 0, 5);

  it('считает серию из пяти выполненных дней подряд', () => {
    const h = makeHabit({ type: 'daily' });
    const logs = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'].map((d) =>
      log('h1', d, 'done'),
    );
    expect(computeStreaks(h, logs, today, 1)).toEqual({ current: 5, best: 5, totalDone: 5 });
  });

  it('два дня без отметки обрывают серию, но best остаётся', () => {
    const h = makeHabit({ type: 'daily' });
    const logs = [
      log('h1', '2026-01-01', 'done'),
      log('h1', '2026-01-02', 'done'),
      // 3 и 4 января — без отметки
      log('h1', '2026-01-05', 'done'),
    ];
    expect(computeStreaks(h, logs, today, 1)).toEqual({ current: 1, best: 2, totalDone: 3 });
  });

  it('один день без отметки серию не рвёт', () => {
    const h = makeHabit({ type: 'daily' });
    const logs = [
      log('h1', '2026-01-01', 'done'),
      // 2 января — без отметки (один день)
      log('h1', '2026-01-03', 'done'),
      log('h1', '2026-01-04', 'done'),
      log('h1', '2026-01-05', 'done'),
    ];
    expect(computeStreaks(h, logs, today, 1)).toEqual({ current: 4, best: 4, totalDone: 4 });
  });

  it('подряд идущие skip обрывают серию при превышении лимита', () => {
    const h = makeHabit({ type: 'daily' });
    const logs = [
      log('h1', '2026-01-01', 'done'),
      log('h1', '2026-01-02', 'skipped'),
      log('h1', '2026-01-03', 'skipped'),
      log('h1', '2026-01-04', 'done'),
    ];
    // лимит 1: два пропуска подряд → серия обнуляется
    expect(computeStreaks(h, logs, today, 1)).toEqual({ current: 1, best: 1, totalDone: 2 });
    // лимит 2: два пропуска допустимы
    expect(computeStreaks(h, logs, today, 2).current).toBe(2);
  });

  it('учитывает только запланированные дни недели', () => {
    // создана в понедельник 2025-12-29, отмечается по понедельникам
    const h = makeHabit({ type: 'days', days: [1] }, '2025-12-29');
    const logs = [log('h1', '2025-12-29', 'done'), log('h1', '2026-01-05', 'done')];
    // между ними пять дней без отметки — но они не запланированы
    expect(computeStreaks(h, logs, today, 1)).toEqual({ current: 2, best: 2, totalDone: 2 });
  });

  it('привычка, созданная в будущем, считается от сегодня', () => {
    const h = makeHabit({ type: 'daily' }, '2026-02-01');
    expect(computeStreaks(h, [], today, 1)).toEqual({ current: 0, best: 0, totalDone: 0 });
  });

  it('computeBestStreak совпадает с best из computeStreaks', () => {
    const h = makeHabit({ type: 'daily' });
    const logs = [log('h1', '2026-01-01', 'done'), log('h1', '2026-01-02', 'done')];
    expect(computeBestStreak(h, logs, today, 1)).toBe(2);
  });
});
