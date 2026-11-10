import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import { recoveredBackup, type OldDataPayload } from '@/lib/oldData';

const TABLES = {
  categories: [],
  subcategories: [],
  habits: [],
  habitLogs: [],
  streaks: [],
  workouts: [],
  exercises: [],
  workoutTemplates: [],
  sheets: [],
  cells: [],
  dayPlans: [],
  dayPlanItems: [],
};

function payload(overrides: Partial<OldDataPayload> = {}): OldDataPayload {
  return {
    port: 53154,
    at: 1_700_000_000_000,
    tables: { ...TABLES },
    settings: DEFAULT_SETTINGS,
    ...overrides,
  };
}

describe('oldData: приведение старой базы к бэкапу', () => {
  it('подставляет пустые заметки календаря, которых не было в старых версиях', () => {
    const result = recoveredBackup(payload(), DEFAULT_SETTINGS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.calendarNotes).toEqual([]);
      expect(result.data.habits).toEqual([]);
    }
  });

  it('берёт настройки из старой копии', () => {
    const result = recoveredBackup(
      payload({ settings: { ...DEFAULT_SETTINGS, profileName: 'Старое имя' } }),
      DEFAULT_SETTINGS,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.settings.profileName).toBe('Старое имя');
  });

  it('без настроек оставляет текущие, чтобы импорт не остался без темы', () => {
    const result = recoveredBackup(
      payload({ settings: null }),
      { ...DEFAULT_SETTINGS, profileName: 'Текущее имя' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.settings.profileName).toBe('Текущее имя');
  });

  it('дополняет старые настройки недостающими полями', () => {
    // В версиях до 1.0.6 имени профиля в настройках не было.
    const oldSettings = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    delete oldSettings.profileName;
    delete oldSettings.eveningReminder;
    const result = recoveredBackup(
      payload({ settings: oldSettings }),
      { ...DEFAULT_SETTINGS, profileName: 'Текущее имя', eveningReminder: true },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.settings.profileName).toBe('Текущее имя');
      expect(result.data.settings.eveningReminder).toBe(true);
      expect(result.data.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    }
  });

  it('не принимает копию без обязательного раздела', () => {
    const tables = { ...TABLES } as Record<string, unknown[]>;
    delete tables.habits;
    const result = recoveredBackup(payload({ tables }), DEFAULT_SETTINGS);
    expect(result.ok).toBe(false);
  });
});
