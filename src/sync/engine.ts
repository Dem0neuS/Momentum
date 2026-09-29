import type { SupabaseClient } from '@supabase/supabase-js';
import type { Table } from 'dexie';
import { db, replaceAllData, SYNC_TABLES } from '@/db/db';
import { isSyncTable, withSilent } from '@/db/syncHooks';
import { reloadAll } from '@/lib/boot';
import { getSupabase } from '@/lib/supabase';
import type { AllData } from '@/lib/types';
import { useSyncStore } from '@/store/syncStore';
import {
  addTombstone,
  clearTombstones,
  countTombstones,
  dropTombstone,
  getAppliedAt,
  getCursor,
  getOwner,
  getPushedStamp,
  listTombstones,
  normalizeStamp,
  onLocalChange,
  setAppliedAt,
  setCursor,
  setOwner,
  setPushedStamp,
  toIso,
  type Tombstone,
} from './meta';
import type { OutgoingRow, PulledRow } from './types';

/**
 * Движок синхронизации.
 *
 * Устройство держит полную копию данных в IndexedDB, облако — реплику той же
 * базы построчно. Обмен двумя проходами: сначала отправка всего, что изменилось
 * локально, затем приём всего, что изменилось на других устройствах. Порядок
 * именно такой: приём до отправки приводит к потере правок, сначала пришла бы
 * чужая версия, и отправлять было бы уже нечего.
 *
 * Слияние построчное, «у кого правка свежее — тот и победил». Для одного
 * человека с парой устройств этого достаточно, и не нужны ни CRDT, ни сервер,
 * который понимает содержимое записей.
 */

/** Сколько записей отправлять одним вызовом momentum_push. */
const PUSH_BATCH = 500;
/** Сколько записей забирать одним вызовом momentum_pull. */
const PULL_BATCH = 1000;
/** Сколько раз подряд забирать, прежде чем признать базу слишком большой. */
const MAX_PULL_ROUNDS = 200;
/** Пауза после локальной правки, чтобы не слать по записи на нажатие. */
const LOCAL_DEBOUNCE_MS = 1500;
/** Фоновая проверка для устройства, долго лежавшего без событий. */
const PERIODIC_MS = 5 * 60 * 1000;

type Row = Record<string, unknown>;

/**
 * Первичный ключ не у всех таблиц называется `id`: у серий это habitId,
 * у настроек — key. Именно он уходит в облако как row_id, поэтому ошибка
 * здесь тихо склеила бы записи из разных таблиц.
 */
function primaryKeyOf(table: string, row: Row): string | null {
  const raw = table === 'streaks' ? row.habitId : table === 'settings' ? row.key : row.id;
  return typeof raw === 'string' && raw !== '' ? raw : null;
}

function allTables(): Table[] {
  return SYNC_TABLES.map((name) => db.table(name));
}

/** Вызов RPC с превращением сетевого сбоя в такой же результат, как ошибка. */
async function callRpc<T>(
  run: () => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: unknown }> {
  try {
    const { data, error } = await run();
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

// ---------- Отправка ----------

async function collectDirty(sinceMs: number): Promise<{ rows: OutgoingRow[]; tombstones: Tombstone[] }> {
  const since = toIso(sinceMs);
  const rows: OutgoingRow[] = [];

  for (const name of SYNC_TABLES) {
    const changed = (await db.table(name).where('updatedAt').above(since).toArray()) as unknown as Row[];
    for (const row of changed) {
      const id = primaryKeyOf(name, row);
      const stamp = normalizeStamp(row.updatedAt);
      if (!id || !stamp) continue;
      rows.push({ table_name: name, row_id: id, payload: row, updated_at: stamp, deleted_at: null });
    }
  }

  return { rows, tombstones: listTombstones() };
}

interface Outcome {
  ok: boolean;
  count: number;
  error?: string;
}

async function push(supabase: SupabaseClient, userId: string): Promise<Outcome> {
  const since = getPushedStamp(userId);
  const { rows, tombstones } = await collectDirty(since);

  // Запись могла попасть в выборку живой и одновременно иметь tombstone:
  // успели прочитать строку, успели удалить. Обе отправки в одной пачке
  // разрешились бы как «побеждает более свежая метка», а это значило бы, что
  // удалённая запись вернётся на других устройствах. Живые строки с
  // tombstone в этой пачке просто не отправляем — удаление их и описывает.
  const deleted = new Set(tombstones.map((t) => `${t.table}\u0000${t.id}`));
  const out: OutgoingRow[] = rows.filter(
    (r) => !deleted.has(`${r.table_name}\u0000${r.row_id}`),
  );

  for (const t of tombstones) {
    const stamp = toIso(t.at);
    out.push({ table_name: t.table, row_id: t.id, payload: {}, updated_at: stamp, deleted_at: stamp });
  }

  if (out.length === 0) return { ok: true, count: 0 };

  let maxStamp = since;
  for (let i = 0; i < out.length; i += PUSH_BATCH) {
    const batch = out.slice(i, i + PUSH_BATCH);
    const { error } = await callRpc(() => supabase.rpc('momentum_push', { rows: batch }));
    if (error) {
      // Курсор отправки на месте: следующая попытка уйдёт с тем же содержимым.
      return { ok: false, count: 0, error: readable(error) };
    }
    for (const row of batch) {
      const at = Date.parse(row.updated_at);
      if (Number.isFinite(at) && at > maxStamp) maxStamp = at;
    }
  }

  // Отправлено — журнал удалений можно чистить. Курсор двигаем только сейчас:
  // сбой посередине оставит его на месте и всё уйдёт повторно, что безопасно,
  // в отличие от отправки, которую мы посчитали сделанной.
  for (const t of tombstones) dropTombstone(t.table, t.id);
  setPushedStamp(userId, maxStamp);

  return { ok: true, count: out.length };
}

// ---------- Приём ----------

interface PullResult extends Outcome {
  applied: number;
}

async function pull(supabase: SupabaseClient, userId: string): Promise<PullResult> {
  let cursor = getCursor(userId);
  let applied = 0;

  for (let round = 0; round < MAX_PULL_ROUNDS; round++) {
    const { data, error } = await callRpc(() =>
      supabase.rpc('momentum_pull', { since_seq: cursor, limit_rows: PULL_BATCH }),
    );
    if (error) return { ok: false, count: applied, applied, error: readable(error) };

    const batch = (data ?? []) as PulledRow[];
    if (batch.length === 0) break;

    applied += await applyBatch(batch);

    const lastSeq = batch[batch.length - 1]?.seq;
    if (typeof lastSeq === 'number' && Number.isFinite(lastSeq) && lastSeq > cursor) {
      cursor = lastSeq;
      setCursor(userId, cursor);
    }
    if (batch.length < PULL_BATCH) break;
  }

  if (applied > 0) await reloadAll();
  return { ok: true, count: applied, applied };
}

/**
 * Внести полученные строки в локальную базу.
 *
 * Чужая запись затирает локальную, только если свежее. Порядок сравнения тот
 * же, что на сервере, поэтому оба конца решают конфликт одинаково.
 */
async function applyBatch(batch: PulledRow[]): Promise<number> {
  const wanted = new Map<string, PulledRow[]>();
  const removed = new Map<string, string[]>();
  let newest = getAppliedAt();
  let touched = 0;

  for (const row of batch) {
    if (!isSyncTable(row.table_name)) continue;
    const stamp = normalizeStamp(row.updated_at);
    if (!stamp) continue;
    const at = Date.parse(stamp);
    if (at > newest) newest = at;

    if (row.deleted_at) {
      // Удаление серверу уже известно. Локальный tombstone снимаем, иначе
      // устройство отправило бы в облако то, что оттуда как раз пришло.
      dropTombstone(row.table_name, row.row_id);
      const list = removed.get(row.table_name) ?? [];
      list.push(row.row_id);
      removed.set(row.table_name, list);
      continue;
    }

    const list = wanted.get(row.table_name) ?? [];
    list.push(row);
    wanted.set(row.table_name, list);
  }

  // Сравнение с локальной версией нужно до записи: после записи все версии
  // стали бы одинаковыми и отличить «свежее» от «своего же» было бы нечем.
  const fresh = new Map<string, Row[]>();
  for (const [name, rows] of wanted) {
    const ids = rows.map((r) => r.row_id);
    const local = (await db.table(name).bulkGet(ids)) as unknown as (Row | undefined)[];
    const out: Row[] = [];
    for (let i = 0; i < rows.length; i++) {
      const stamp = normalizeStamp(rows[i].updated_at) as string;
      const mine = local[i];
      const mineStamp = mine ? normalizeStamp(mine.updatedAt) : null;
      if (mineStamp && Date.parse(mineStamp) >= Date.parse(stamp)) continue;
      out.push({ ...(rows[i].payload ?? {}), updatedAt: stamp });
    }
    if (out.length > 0) fresh.set(name, out);
  }

  await withSilent(() =>
    db.transaction('rw', allTables(), async () => {
      for (const [name, ids] of removed) {
        if (ids.length > 0) await db.table(name).bulkDelete(ids);
      }
      for (const [name, list] of fresh) {
        await db.table(name).bulkPut(list);
      }
    }),
  );

  for (const list of removed.values()) touched += list.length;
  for (const list of fresh.values()) touched += list.length;
  setAppliedAt(newest);
  return touched;
}

// ---------- Ошибки ----------

function readable(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed')) {
    return 'Нет связи с сервером. Изменения сохранены на устройстве.';
  }
  if (lower.includes('jwt') || lower.includes('token') || lower.includes('not authenticated')) {
    return 'Сессия истекла. Выйдите и войдите заново.';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Сервер не пропустил запись. Выйдите и войдите заново.';
  }
  if (lower.includes('momentum_pull') || lower.includes('momentum_push')) {
    return 'Сервер не знает функций синхронизации. Нужно применить supabase/002-sync-cursor.sql.';
  }
  return message || 'Синхронизация не удалась.';
}

// ---------- Подготовка устройства ----------

async function isLocalEmpty(): Promise<boolean> {
  const counts = await Promise.all(SYNC_TABLES.map((name) => db.table(name).count()));
  return counts.every((c) => c === 0);
}

async function isCloudEmpty(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await callRpc(() =>
    supabase.rpc('momentum_pull', { since_seq: 0, limit_rows: 1 }),
  );
  if (error) throw new Error(readable(error));
  return ((data ?? []) as PulledRow[]).length === 0;
}

/** Очистить устройство целиком: и данные, и журнал удалений. */
export async function wipeLocalData(): Promise<void> {
  await withSilent(() =>
    db.transaction('rw', allTables(), async () => {
      for (const name of SYNC_TABLES) await db.table(name).clear();
    }),
  );
  clearTombstones();
}

/** Первичные ключи всех строк: нужны, чтобы после замены базы найти пропавшие. */
async function collectKeys(): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const name of SYNC_TABLES) {
    const keys = await db.table(name).toCollection().primaryKeys();
    out.set(
      name,
      keys.map((k) => String(k)),
    );
  }
  return out;
}

/**
 * Пересоздать метки у всех строк: «отправить в облако всё, что есть на
 * устройстве». Используется при первом входе и после импорта.
 */
async function restampEverything(): Promise<number> {
  // Одна метка на всю таблицу, а не тысяча подряд: иначе часы уедут вперёд на
  // секунды и следующая правка на этом устройстве будет выглядеть старее.
  let base = Math.max(Date.now(), getPushedStamp(getOwner() ?? '') + 1, getAppliedAt() + 1);

  let count = 0;
  await withSilent(() =>
    db.transaction('rw', allTables(), async () => {
      for (const name of SYNC_TABLES) {
        const table = db.table(name);
        const rows = (await table.toArray()) as unknown as Row[];
        if (rows.length === 0) continue;
        base += 1;
        const stamp = toIso(base);
        await table.bulkPut(rows.map((row) => ({ ...row, updatedAt: stamp })));
        count += rows.length;
      }
    }),
  );
  return count;
}

/**
 * Сброс истории приёма: с этого момента облако присылает всё с нуля.
 *
 * Журнал удалений здесь намеренно не трогается. Локально удалённая запись
 * должна уехать в облако, иначе там она останется и вернётся обратно. Чистит
 * его только явная очистка устройства (wipeLocalData).
 */
function resetFor(userId: string): void {
  setCursor(userId, 0);
  setPushedStamp(userId, 0);
}

// ---------- Импорт и сброс ----------
//
// Обе операции заменяют базу целиком, и обычные хуки для этого не годятся:
// очистка десяти тысяч строк породила бы десять тысяч tombstones, а каждая
// импортированная запись осталась бы без метки и не уехала бы в облако. Поэтому
// замена идёт в тихом режиме, а следом движок достраивает журнал и метки сам.

/** Импорт бэкапа: пропавшие при замене строки удаляются, новые отправляются. */
export async function replaceLocalData(data: AllData): Promise<void> {
  const before = await collectKeys();
  await withSilent(() => replaceAllData(data));
  const after = await collectKeys();
  for (const [name, ids] of before) {
    const kept = new Set(after.get(name) ?? []);
    for (const id of ids) {
      if (!kept.has(id)) addTombstone(name, id, Date.now());
    }
  }
  await restampEverything();
}

/** Полный сброс данных. Стартовые привычки создаст вызывающий через initApp. */
export async function resetLocalData(): Promise<void> {
  const before = await collectKeys();
  await wipeLocalData();
  for (const [name, ids] of before) {
    for (const id of ids) addTombstone(name, id, Date.now());
  }
}

// ---------- Решения человека ----------

/** Отправить в облако то, что уже есть на устройстве. */
export async function chooseUpload(): Promise<void> {
  const userId = useSyncStore.getState().userId;
  if (!userId) return;
  setOwner(userId);
  resetFor(userId);
  await restampEverything();
  useSyncStore.getState().setState({ phase: 'idle', choice: null });
  await reloadAll();
  await run();
}

/** Заменить данные устройства облачными. */
export async function chooseCloud(): Promise<void> {
  const userId = useSyncStore.getState().userId;
  if (!userId) return;
  await wipeLocalData();
  setOwner(userId);
  resetFor(userId);
  useSyncStore.getState().setState({ phase: 'idle', choice: null });
  await reloadAll();
  await run();
}

// ---------- Планировщик ----------

let attachedUser: string | null = null;
let running: Promise<void> | null = null;
let rerun = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let periodicTimer: ReturnType<typeof setInterval> | undefined;
let listenersBound = false;

/** Неотправленные удаления: показываем в профиле, чтобы не терялось из виду. */
export function pendingDeletes(): number {
  return countTombstones();
}

function schedule(delay: number): void {
  if (!attachedUser) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    void run();
  }, delay);
}

function bindListeners(): void {
  if (listenersBound) return;
  listenersBound = true;
  onLocalChange(() => schedule(LOCAL_DEBOUNCE_MS));
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => schedule(0));
  window.addEventListener('offline', () => {
    useSyncStore.getState().setState({ phase: 'offline' });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(0);
  });
}

/**
 * Привязать движок к сессии. Вызывается при смене пользователя; повторный
 * вызов с тем же id ничего не делает.
 */
export function attachSync(userId: string | null): void {
  if (attachedUser === userId) return;
  attachedUser = userId;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = undefined;
  }

  const store = useSyncStore.getState();
  if (!userId) {
    store.setState({
      phase: getSupabase() ? 'anon' : 'off',
      userId: null,
      choice: null,
      error: null,
    });
    return;
  }

  store.setState({ phase: 'idle', userId, choice: null, error: null });
  bindListeners();
  periodicTimer = setInterval(() => schedule(0), PERIODIC_MS);
  void run();
}

/** Синхронизироваться сейчас — кнопка в профиле. */
export function syncNow(): void {
  schedule(0);
}

async function run(): Promise<void> {
  if (running) {
    // Обмен уже идёт. Помечаем, что после него надо повторить: изменения могли
    // прийти во время отправки, и молча уйти с ними нельзя.
    rerun = true;
    return running;
  }
  running = cycle();
  try {
    await running;
  } finally {
    running = null;
  }
  if (rerun) {
    rerun = false;
    await run();
  }
}

async function cycle(): Promise<void> {
  const userId = attachedUser;
  if (!userId) return;
  const supabase = getSupabase();
  if (!supabase) {
    useSyncStore.getState().setState({ phase: 'off' });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSyncStore.getState().setState({ phase: 'offline' });
    return;
  }

  const store = useSyncStore.getState();
  store.markSyncing();

  // Кто владеет данными на устройстве. Пока владелец неизвестен или чужой,
  // обычный обмен не запускается: иначе устройство либо затерло бы чужие
  // данные, либо молча слило бы два аккаунта в один.
  const owner = getOwner();
  if (owner !== userId) {
    if (await isLocalEmpty()) {
      // Данных на устройстве нет: переключение безопасно и незаметно.
      setOwner(userId);
      resetFor(userId);
    } else if (owner) {
      store.askChoice('account', false);
      return;
    } else {
      let cloudEmpty: boolean;
      try {
        cloudEmpty = await isCloudEmpty(supabase);
      } catch (e) {
        store.markError(e instanceof Error ? e.message : String(e));
        return;
      }
      if (cloudEmpty) {
        // Первый вход, в облаке пусто: отправляем устройство без вопросов.
        setOwner(userId);
        resetFor(userId);
      } else {
        store.askChoice('merge', true);
        return;
      }
    }
  }

  const sent = await push(supabase, userId);
  if (!sent.ok) {
    store.markError(sent.error ?? 'Отправка не удалась');
    return;
  }
  const got = await pull(supabase, userId);
  if (!got.ok) {
    store.markError(got.error ?? 'Приём не удался');
    return;
  }
  useSyncStore.getState().markSynced(sent.count, got.applied, Date.now());
}
