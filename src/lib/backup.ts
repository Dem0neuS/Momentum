import type { AllData } from '@/lib/types';

/**
 * Импорт заменяет базу целиком, поэтому файл должен быть полным бэкапом.
 * Раньше хватало одного ключа `habits` или `sheets` — и `{"habits": []}`
 * молча стирал тренировки, таблицы, план и настройки. Здесь проверяется
 * каждое обязательное поле, иначе данные не трогаем.
 */
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

export type BackupCheck =
  | { ok: true; data: AllData }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateBackup(value: unknown): BackupCheck {
  if (!isRecord(value)) {
    return { ok: false, error: 'Файл не похож на бэкап Momentum' };
  }

  if ('version' in value && value.version !== 1) {
    return { ok: false, error: 'Неподдерживаемая версия бэкапа' };
  }

  const missing: string[] = [];
  const wrongType: string[] = [];
  for (const key of ARRAY_KEYS) {
    if (!(key in value)) missing.push(key);
    else if (!Array.isArray(value[key])) wrongType.push(key);
  }

  if (missing.length) {
    return { ok: false, error: 'Это не полный бэкап: не хватает разделов данных' };
  }
  if (wrongType.length) {
    return { ok: false, error: 'Повреждённый бэкап: раздел данных имеет неверный формат' };
  }
  if (!isRecord(value.settings)) {
    return { ok: false, error: 'Повреждённый бэкап: нет настроек' };
  }

  return { ok: true, data: value as unknown as AllData };
}
