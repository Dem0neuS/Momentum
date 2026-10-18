import { describe, it, expect } from 'vitest';
import { computeMetrics, formatBytes, initialsOf } from '@/lib/metrics';
import { todayKey } from '@/lib/dates';
import type { Habit, HabitFrequency, HabitLog, StreakInfo, Workout } from '@/lib/types';

function habit(id: string, frequency: HabitFrequency, archived = false, createdAt = '2000-01-01'): Habit {
  return {
    id,
    name: id,
    icon: '💧',
    color: '#4A8CFF',
    categoryId: null,
    subcategoryId: null,
    frequency,
    targetCount: 0,
    counterUnit: '',
    allowSkips: true,
    createdAt,
    archived,
  };
}

function doneLog(habitId: string, date: string): HabitLog {
  return {
    id: `${habitId}:${date}`,
    habitId,
    date,
    value: 1,
    completed: true,
    status: 'done',
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

function streak(habitId: string, best: number): StreakInfo {
  return { habitId, current: 0, best, totalDone: 0, lastResetAt: null };
}

function workout(id: string, date: string): Workout {
  return { id, name: id, date, type: 'other', notes: '', completed: true };
}

describe('metrics: сводка профиля', () => {
  it('считает выполнение за 30 дней как долю запланированного', () => {
    const h = habit('h1', { type: 'daily' });
    const today = todayKey();
    const m = computeMetrics(
      [h],
      [doneLog('h1', today)],
      { h1: streak('h1', 7) },
      [workout('w1', '2020-05-05')],
    );
    // 30 запланированных дней, выполнен 1 → 3%
    expect(m.completion30).toBe(3);
    expect(m.daysWithActivity).toBe(2); // сегодняшняя отметка + тренировка
    expect(m.bestStreak).toBe(7);
    expect(m.workoutsTotal).toBe(1);
    expect(m.logCount).toBe(1);
  });

  it('привычка, созданная сегодня, не портит среднее прошлыми днями', () => {
    const h = habit('h1', { type: 'daily' }, false, todayKey());
    const m = computeMetrics([h], [doneLog('h1', todayKey())], {}, []);
    // единственный запланированный день — сегодня, и он выполнен
    expect(m.completion30).toBe(100);
  });

  it('timesPerWeek не входит в знаменатель выполнения', () => {
    const h = habit('h1', { type: 'timesPerWeek', times: 3 });
    const m = computeMetrics([h], [doneLog('h1', todayKey())], {}, []);
    expect(m.completion30).toBe(0);
    expect(m.daysWithActivity).toBe(1);
  });

  it('архивные привычки не считаются в выполнении', () => {
    const h = habit('h1', { type: 'daily' }, true);
    const m = computeMetrics([h], [doneLog('h1', todayKey())], {}, []);
    expect(m.completion30).toBe(0);
    expect(m.logCount).toBe(1);
  });

  it('лучшая серия — максимум по всем привычкам', () => {
    const m = computeMetrics([], [], { a: streak('a', 3), b: streak('b', 12) }, []);
    expect(m.bestStreak).toBe(12);
  });

  it('без данных выдаёт нули', () => {
    expect(computeMetrics([], [], {}, [])).toEqual({
      daysWithActivity: 0,
      completion30: 0,
      bestStreak: 0,
      workoutsTotal: 0,
      logCount: 0,
    });
  });
});

describe('metrics: байты', () => {
  it('formatBytes выбирает единицу', () => {
    expect(formatBytes(0)).toBe('0 КБ');
    expect(formatBytes(512)).toBe('512 Б');
    expect(formatBytes(1023)).toBe('1023 Б');
    expect(formatBytes(2048)).toBe('2 КБ');
    expect(formatBytes(1024 * 1024)).toBe('1.0 МБ');
    expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 МБ');
  });
});

describe('metrics: инициалы', () => {
  it('initialsOf берёт первые буквы имени и фамилии', () => {
    expect(initialsOf('Иван Петров')).toBe('ИП');
    expect(initialsOf('  иван   петров  ')).toBe('ИП');
  });

  it('одно слово — первые две буквы, пусто — «М»', () => {
    expect(initialsOf('Иван')).toBe('ИВ');
    expect(initialsOf('')).toBe('М');
    expect(initialsOf('   ')).toBe('М');
  });

  it('тройное имя игнорирует третью часть', () => {
    expect(initialsOf('Иван Петрович Сидоров')).toBe('ИП');
  });
});
