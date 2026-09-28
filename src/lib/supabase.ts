import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Подключение к Supabase для личного кабинета и синхронизации.
 *
 * Значения берутся из .env.local (в git не попадает). Если файла нет или он
 * не заполнен — подключение возвращает null, и приложение продолжает
 * работать как обычная локальная: настройки, привычки и тренировки лежат
 * в IndexedDB, кабинет просто не показывается. Это осознанно: авторизация
 * не должна быть условием работы программы.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_REDIRECT_URL =
  (import.meta.env.VITE_SUPABASE_REDIRECT_URL as string | undefined) ?? `${location.origin}/`;

/** Настроен ли кабинет. Проверяется перед тем, как что-либо рисовать в интерфейсе. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Клиент Supabase либо null, если кабинет не настроен. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (client) return client;
  client = createClient(url as string, anonKey as string, {
    auth: {
      // Токен живёт в localStorage и сам обновляется, пока вкладка открыта.
      persistSession: true,
      autoRefreshToken: true,
      // Нужно для ссылки из письма: разбирает токены recovery в адресе
      // и сразу отдаёт сессию, иначе восстановление пароля не открывается.
      detectSessionInUrl: true,
    },
  });
  return client;
}

/**
 * Понятная причина, если кабинет не работает.
 * Показывается в настройках вместо молчаливого отсутствия кнопок.
 */
export function supabaseMissingHint(): string {
  if (!isSupabaseConfigured) {
    return 'Кабинет не настроен: скопируйте .env.local.example в .env.local и укажите URL и ключ проекта Supabase.';
  }
  return '';
}
