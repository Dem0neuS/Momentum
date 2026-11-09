import { describe, expect, it } from 'vitest';
import { validateBackup } from '@/lib/backup';

const ARRAY_KEYS = [
  'categories',
  'subcategories',
  'habits',
  'habitLogs',
  'streaks',
  'workouts',
  'exercises',
  'workoutTemplates',
  'sheets',
  'cells',
  'dayPlans',
  'dayPlanItems',
] as const;

function fullBackup(patch: Record<string, unknown> = {}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    version: 1,
    exportedAt: '2026-10-21T10:00:00.000Z',
    settings: { theme: 'system' },
  };
  for (const key of ARRAY_KEYS) data[key] = [];
  return { ...data, ...patch };
}

describe('validateBackup', () => {
  it('принимает полный бэкап', () => {
    const result = validateBackup(fullBackup());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.version).toBe(1);
  });

  it('принимает полный бэкап без версии (старый экспорт)', () => {
    const data = fullBackup();
    delete data.version;
    expect(validateBackup(data).ok).toBe(true);
  });

  it('не трогает данные, если пришёл только раздел habits', () => {
    const result = validateBackup({ habits: [] });
    expect(result.ok).toBe(false);
  });

  it('требует каждый обязательный раздел', () => {
    for (const key of ARRAY_KEYS) {
      const data = fullBackup();
      delete data[key];
      expect(validateBackup(data).ok, `без ${key}`).toBe(false);
    }
  });

  it('отклоняет раздел неверного типа', () => {
    expect(validateBackup(fullBackup({ workouts: 'nope' })).ok).toBe(false);
    expect(validateBackup(fullBackup({ cells: {} })).ok).toBe(false);
  });

  it('отклоняет отсутствующие настройки', () => {
    const data = fullBackup();
    delete data.settings;
    expect(validateBackup(data).ok).toBe(false);
    expect(validateBackup(fullBackup({ settings: 'nope' })).ok).toBe(false);
  });

  it('отклоняет чужую версию бэкапа', () => {
    expect(validateBackup(fullBackup({ version: 2 })).ok).toBe(false);
  });

  it('отклоняет не-объект и массив', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup('backup').ok).toBe(false);
    expect(validateBackup([]).ok).toBe(false);
  });

  it('не мешает лишним ключам', () => {
    expect(validateBackup(fullBackup({ futureField: 42 })).ok).toBe(true);
  });

  it('принимает старый бэкап без заметок календаря и подставляет пустой список', () => {
    const result = validateBackup(fullBackup());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.calendarNotes).toEqual([]);
  });

  it('сохраняет заметки календаря из нового бэкапа', () => {
    const note = {
      id: 'note-1',
      date: '2026-11-09',
      text: 'Позвонить в сервис',
      createdAt: '2026-11-09T10:00:00.000Z',
    };
    const result = validateBackup(fullBackup({ calendarNotes: [note] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.calendarNotes).toEqual([note]);
  });

  it('отклоняет заметки календаря неверного типа', () => {
    expect(validateBackup(fullBackup({ calendarNotes: 'nope' })).ok).toBe(false);
  });
});
