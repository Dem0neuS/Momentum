import type { AppSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { validateBackup, type BackupCheck } from './backup';

/**
 * Восстановление данных из прошлых запусков десктопной версии.
 *
 * До 1.0.7 встроенный сервер слушал случайный порт, а порт — часть origin.
 * Каждая сессия открывала новую пустую базу, а данные прошлой оставались в
 * `http://127.0.0.1:<старый порт>`. Веб-версия к профилю Chromium доступа не
 * имеет, поэтому весь мост есть только в Electron.
 */

export interface OldDataOrigin {
  port: number;
  at: number;
  version?: number;
  counts?: Record<string, number>;
  total?: number;
  settings?: unknown;
  error?: string;
}

export interface OldDataScan {
  currentPort: number;
  origins: OldDataOrigin[];
}

export interface OldDataPayload extends OldDataOrigin {
  tables: Record<string, unknown[]>;
}

interface OldDataBridge {
  isElectron: true;
  scanOldData(): Promise<OldDataScan>;
  readOldData(port: number): Promise<OldDataPayload>;
}

/** Мост к Electron либо null в браузере. */
export function oldDataBridge(): OldDataBridge | null {
  if (typeof window === 'undefined') return null;
  const api = (window as unknown as { momentumDesktop?: Partial<OldDataBridge> }).momentumDesktop;
  if (!api?.isElectron || typeof api.scanOldData !== 'function' || typeof api.readOldData !== 'function') {
    return null;
  }
  return api as OldDataBridge;
}

/**
 * Привести прочитанную базу к виду полного бэкапа.
 *
 * Заметок календаря в старых версиях не было — это не потеря данных, поэтому
 * подставляем пустой список. Настройки берём из старой копии, а если их там
 * нет — текущие, иначе импорт остался бы без темы, имени и выбранных блоков.
 */
export function recoveredBackup(
  payload: OldDataPayload,
  fallbackSettings: AppSettings,
): BackupCheck {
  const tables = payload.tables ?? {};
  const data = {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    ...tables,
    calendarNotes: Array.isArray(tables.calendarNotes) ? tables.calendarNotes : [],
    settings: settingsFrom(payload.settings, fallbackSettings),
  };
  return validateBackup(data);
}

/**
 * В старых версиях у настроек не было части полей (например, имени профиля).
 * Наивный `...old` оставил бы их undefined, и после замены приложение
 * показывало бы пустоту вместо темы или правила пропусков. Недостающее берём
 * из текущих настроек, а не только из DEFAULT_SETTINGS: так при замене не
 * теряются параметры, которых в старой версии ещё не существовало.
 */
function settingsFrom(value: unknown, fallback: AppSettings): AppSettings {
  const old = isRecord(value) ? value : {};
  const base = { ...DEFAULT_SETTINGS, ...fallback };
  return {
    ...base,
    ...old,
    theme:
      old.theme === 'light' || old.theme === 'dark' || old.theme === 'system'
        ? old.theme
        : base.theme,
    skipPolicy: {
      ...base.skipPolicy,
      ...(isRecord(old.skipPolicy) ? old.skipPolicy : {}),
    },
    blockSettings: {
      ...base.blockSettings,
      ...(isRecord(old.blockSettings) ? old.blockSettings : {}),
    },
    collapsedCategories: isRecord(old.collapsedCategories)
      ? (old.collapsedCategories as Record<string, boolean>)
      : base.collapsedCategories,
  } as AppSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
