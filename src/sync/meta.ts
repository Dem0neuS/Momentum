/**
 * Служебное состояние синхронизации: метки времени, курсор приёма, владелец
 * локальных данных и журнал удалений.
 *
 * Всё это лежит в localStorage, а не в IndexedDB, и это осознанный выбор.
 * Журнал удалений пишется из хука Dexie, а хук `deleting` выполняется внутри
 * уже открытой транзакции IndexedDB — писать в постороннее хранилище оттуда
 * нельзя (транзакция не открыта на этой таблице, запись упала бы). localStorage
 * синхронен, поэтому пометка об удалении попадает на диск тем же тиком, что и
 * сам `delete`, и переживает падение вкладки. Объём журнала — десятки байт на
 * удаление, и он полностью опустошается после отправки.
 *
 * localStorage может быть недоступен (приватный режим, переполнение) — тогда
 * синхронизация молча отключается, а приложение продолжает работать локально.
 */

const NS = 'momentum.sync';
const OWNER = `${NS}.owner`;
const CURSOR = `${NS}.cursor.`;
const PUSHED = `${NS}.pushed.`;
const APPLIED = `${NS}.applied`;
const TOMB = `${NS}.tomb.`;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readRaw(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    /* нет места или доступ закрыт — синхронизация просто не работает */
  }
}

function removeRaw(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    /* no-op */
  }
}

function readNumber(key: string, fallback = 0): number {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const toIso = (ms: number): string => new Date(ms).toISOString();

/**
 * Postgres отдаёт метку времени как `2026-09-29T12:00:00.123456+00:00`, а
 * `toISOString()` — как `2026-09-29T12:00:00.123Z`. Это разные строки, и
 * лексикографически они сравниваются неправильно (`.1234…` < `.123Z`).
 * Приводим всё к канону — тогда сравнение строк сравнивает время.
 */
export function normalizeStamp(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : toIso(ms);
}

// ---------- Владелец локальных данных ----------

/** id пользователя, чьи данные сейчас лежат на устройстве. */
export function getOwner(): string | null {
  return readRaw(OWNER);
}

export function setOwner(userId: string): void {
  writeRaw(OWNER, userId);
}

// ---------- Курсор приёма ----------

/** Номер последней полученной строки. 0 — «не получал ничего». */
export function getCursor(userId: string): number {
  return readNumber(CURSOR + userId, 0);
}

export function setCursor(userId: string, seq: number): void {
  writeRaw(CURSOR + userId, String(seq));
}

// ---------- Курсор отправки ----------

/**
 * Метка, после которой локальные записи считаются отправленными.
 * Отбор идёт по `updatedAt` записи, поэтому важно, чтобы новая метка всегда
 * была больше уже отправленной — иначе правка «потерялась бы» в очереди.
 * Гарантирует это `nextStampMs()`.
 */
export function getPushedStamp(userId: string): number {
  return readNumber(PUSHED + userId, 0);
}

export function setPushedStamp(userId: string, ms: number): void {
  writeRaw(PUSHED + userId, String(ms));
}

// ---------- Свежесть серверных данных ----------

/** Самая свежая метка, которую мы получили с сервера. */
export function getAppliedAt(): number {
  return readNumber(APPLIED, 0);
}

export function setAppliedAt(ms: number): void {
  if (ms > getAppliedAt()) writeRaw(APPLIED, String(ms));
}

/** Сброс всей истории приёма — например, при смене аккаунта. */
export function resetReceiptState(): void {
  removeRaw(APPLIED);
}

// ---------- Журнал удалений ----------

export interface Tombstone {
  table: string;
  id: string;
  at: number;
}

function tombKey(table: string, id: string): string {
  // Разделитель \u0000 в ключе не встречается в именах таблиц и в id.
  return `${TOMB}${table}\u0000${id}`;
}

export function addTombstone(table: string, id: string, at: number): void {
  if (!table || !id) return;
  writeRaw(tombKey(table, id), String(at));
}

export function listTombstones(): Tombstone[] {
  const store = storage();
  if (!store) return [];
  const out: Tombstone[] = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(TOMB)) continue;
      const at = Number(store.getItem(key));
      if (!Number.isFinite(at)) continue;
      const parsed = parseTombKey(key);
      if (parsed) out.push({ table: parsed.table, id: parsed.id, at });
    }
  } catch {
    return out;
  }
  return out;
}

function parseTombKey(key: string): { table: string; id: string } | null {
  const body = key.slice(TOMB.length);
  const cut = body.indexOf('\u0000');
  if (cut < 0) return null;
  return { table: body.slice(0, cut), id: body.slice(cut + 1) };
}

export function dropTombstone(table: string, id: string): void {
  removeRaw(tombKey(table, id));
}

export function countTombstones(): number {
  return listTombstones().length;
}

export function clearTombstones(): void {
  for (const t of listTombstones()) dropTombstone(t.table, t.id);
}

// ---------- Метки времени ----------

let lastStamp = 0;

/**
 * Следующая метка изменения. Три ограничения, каждое от настоящей беды:
 *
 * 1. Не меньше предыдущей метки + 1 мс — две правки за одну миллисекунду
 *    иначе получили бы одинаковый `updatedAt`, и отбор «больше курсора»
 *    одну из них потерял бы.
 * 2. Не меньше последней полученной с сервера + 1 мс — часы устройства могут
 *    отставать (особенно в старом браузере без NTP). Без этого пол новая
 *    правка получила бы метку старше курсора и не уехала бы в облако никогда.
 * 3. Не меньше отправленной метки + 1 мс — то же самое относительно очереди
 *    отправки: иначе правка попадёт «под» уже отправленный курсор.
 */
export function nextStampMs(): number {
  const floor = Math.max(lastStamp, getPushedStamp(getOwner() ?? ''), getAppliedAt());
  lastStamp = Math.max(Date.now(), floor + 1);
  return lastStamp;
}

// ---------- Сигнал «локальные данные изменились» ----------

type Listener = () => void;
let listener: Listener | null = null;

export function onLocalChange(cb: Listener): void {
  listener = cb;
}

export function noteLocalChange(): void {
  try {
    listener?.();
  } catch {
    /* слушатель не должен ломать запись */
  }
}

/** Полный сброс: новая учётная запись или явная очистка устройства. */
export function resetForNewOwner(userId: string): void {
  setOwner(userId);
  setCursor(userId, 0);
  setPushedStamp(userId, 0);
  resetReceiptState();
  clearTombstones();
  lastStamp = 0;
}
