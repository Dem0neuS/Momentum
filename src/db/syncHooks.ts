import type { Table } from 'dexie';
import { db, SYNC_TABLES, type SyncTable } from './db';
import { addTombstone, nextStampMs, noteLocalChange, toIso } from '@/sync/meta';

/**
 * Перехват всех изменений локальной базы.
 *
 * Запись идёт напрямую из сторов в Dexie более чем в сотне мест, и менять
 * каждое из них ради синхронизации — затея с большим шансом пропустить одно.
 * Хуки Dexie решают это в одной точке: создание и обновление любой строки
 * получают метку `updatedAt`, а удаление попадает в журнал tombstones.
 *
 * Хуки не меняют поведение приложения: без них движок синхронизации просто
 * не видит изменений, всё остальное работает как раньше.
 */

export { SYNC_TABLES };
export type { SyncTable };

const TABLE_SET = new Set<string>(SYNC_TABLES);

/** Таблица синхронизируется? Неизвестное имя игнорируем, а не падаем. */
export function isSyncTable(name: string): name is SyncTable {
  return TABLE_SET.has(name);
}

/**
 * Глубина тихого режима. В нём хуки молчат: метка не ставится, tombstone не
 * пишется, сигнал синхронизации не рассылается. Нужен, когда мы сами
 * применяем данные с сервера — иначе применённое сейчас же отправится обратно
 * и устройства будут бесконечно догонять друг друга.
 *
 * Счётчик, а не флаг: вложенные вызовы (импорт внутри сброса) не должны
 * преждевременно его снять. Опасного пересечения с правкой пользователя нет:
 * IndexedDB не даёт второй транзакции на пересекающихся таблицах начаться
 * раньше конца первой, а флаг снимается в `finally` после её завершения.
 */
let silent = 0;

export function isSilent(): boolean {
  return silent > 0;
}

/** Выполнить fn, не помечая изменения как локальные. */
export async function withSilent<T>(fn: () => Promise<T>): Promise<T> {
  silent += 1;
  try {
    return await fn();
  } finally {
    silent -= 1;
  }
}

let installed = false;

/**
 * Поставить хуки. Вызывается один раз при старте, до первого сидинга.
 */
export function installSyncHooks(): void {
  if (installed) return;
  installed = true;

  for (const name of SYNC_TABLES) {
    // Хук одинаков для всех таблиц и оперирует первичным ключом, а не
    // конкретной сущностью, поэтому здесь типы не нужны.
    const table = db.table(name) as unknown as Table<Record<string, unknown>, string>;

    table.hook('creating', function (_key, obj) {
      if (silent) return;
      obj.updatedAt = toIso(nextStampMs());
      noteLocalChange();
    });

    // Возвращаемое значение Dexie подмешивает в набор изменений, поэтому
    // `put` не перепишет метку, даже если вызывающий принёс старую.
    table.hook('updating', function () {
      if (silent) return undefined;
      noteLocalChange();
      return { updatedAt: toIso(nextStampMs()) };
    });

    table.hook('deleting', function (key) {
      if (silent) return;
      addTombstone(name, String(key), nextStampMs());
      noteLocalChange();
    });
  }
}
