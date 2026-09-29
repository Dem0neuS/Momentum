/** Строка реплики в том виде, в котором она лежит в momentum_rows. */
export interface OutgoingRow {
  table_name: string;
  row_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
}

/** Строка, полученная от momentum_pull. */
export interface PulledRow {
  seq: number;
  table_name: string;
  row_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Что сейчас происходит с синхронизацией.
 *
 * `off`      — кабинет не настроен, синхронизации нет и не планируется.
 * `anon`     — пользователь не вошёл, данные живут только на устройстве.
 * `idle`     — всё синхронизировано, ждём изменений.
 * `syncing`  — идёт обмен.
 * `offline`  — нет сети, изменения копятся локально.
 * `error`    — обмен не удался, будет повтор.
 * `choice`   — нужно решение человека: что делать с данными на устройстве.
 */
export type SyncPhase = 'off' | 'anon' | 'idle' | 'syncing' | 'offline' | 'error' | 'choice';

/**
 * В чём именно состоит «нужно решение».
 *
 * `merge`    — на устройстве данные и в облаке есть, аккаунт прежний
 *              (или первый вход). Спросили: отправить своё или взять облачное.
 * `account`  — на устройстве данные другого аккаунта. Отправлять их в новый
 *              нельзя, поэтому вариант только один: заменить облачными.
 */
export type SyncChoice = 'merge' | 'account';
