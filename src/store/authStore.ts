import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured, supabaseMissingHint } from '@/lib/supabase';

/**
 * Личный кабинет: вход, выход, смена пароля и восстановление по письму.
 *
 * Сессию держит Supabase (localStorage + автообновление токена), здесь только
 * её отражение в интерфейсе. Если кабинет не настроен, состояние остаётся
 * анонимным и приложение работает ровно как раньше.
 */

/** Понятная причина ошибки вместо кодов Supabase вида «AuthApiError». */
function readable(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Неверная почта или пароль.';
  if (lower.includes('email not confirmed')) return 'Почта не подтверждена. Проверь письмо.';
  if (lower.includes('user already registered')) return 'Такая почта уже зарегистрирована.';
  if (lower.includes('password should be at least')) return 'Пароль короче 6 символов.';
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Слишком много попыток. Подожди минуту и повтори.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Нет связи с сервером. Проверь подключение.';
  }
  return message || 'Что-то пошло не так.';
}

export type AuthStatus = 'unknown' | 'anon' | 'authed';

interface AuthState {
  /** Загружается ли Supabase и восстанавливается ли прошлая сессия. */
  ready: boolean;
  /** Кабинет вообще настроен (есть URL и ключ). */
  configured: boolean;
  user: User | null;
  status: AuthStatus;
  /** Открыли ссылку из письма «восстановить пароль» — ждём нового пароля. */
  recoveryMode: boolean;
  busy: string | null;
  error: string | null;

  signIn(email: string, password: string): Promise<boolean>;
  signUp(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
  /** Отправить письмо со ссылкой восстановления. */
  requestReset(email: string): Promise<boolean>;
  /** Поставить новый пароль после ссылки из письма. */
  setNewPassword(password: string): Promise<boolean>;
  /**
   * Смена пароля на живом аккаунте.
   * Текущий пароль проверяется повторным входом: иначе любой, у кого
   * открыта сессия, мог бы сменить пароль без знания прежнего.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<boolean>;
  clearError(): void;
  clearRecovery(): void;
  refresh(): Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  /** Подписка на события сессии ставится один раз. */
  let subscribed = false;

  const ensureSubscription = () => {
    if (subscribed) return;
    const supabase = getSupabase();
    if (!supabase) return;
    subscribed = true;
    supabase.auth.onAuthStateChange((event, session) => {
      // Внутри обработчика нельзя делать await-вызовы к Supabase:
      // они выполняются синхронно и блокируют обновление токена.
      const user = session?.user ?? null;
      if (event === 'PASSWORD_RECOVERY') {
        set({ recoveryMode: true, user, status: 'authed', ready: true });
        return;
      }
      if (event === 'SIGNED_OUT') {
        set({ user: null, status: 'anon', ready: true, recoveryMode: false });
        return;
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        set({ user, status: user ? 'authed' : 'anon', ready: true });
      }
    });
  };

  return {
    ready: false,
    configured: isSupabaseConfigured,
    user: null,
    status: 'unknown',
    recoveryMode: false,
    busy: null,
    error: null,

    async refresh() {
      const supabase = getSupabase();
      if (!supabase) {
        set({ ready: true, status: 'anon', configured: false });
        return;
      }
      ensureSubscription();
      const { data } = await supabase.auth.getSession();
      set({ user: data.session?.user ?? null, status: data.session ? 'authed' : 'anon', ready: true });
    },

    async signIn(email, password) {
      const supabase = getSupabase();
      if (!supabase) {
        set({ error: supabaseMissingHint() });
        return false;
      }
      set({ busy: 'signin', error: null });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ busy: null, error: readable(error) });
        return false;
      }
      set({ busy: null, user: data.user, status: 'authed' });
      return true;
    },

    async signUp(email, password) {
      const supabase = getSupabase();
      if (!supabase) {
        set({ error: supabaseMissingHint() });
        return false;
      }
      set({ busy: 'signup', error: null });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Если в проекте выключено подтверждение почты, сессия придёт сразу.
        options: { emailRedirectTo: `${location.origin}/` },
      });
      if (error) {
        set({ busy: null, error: readable(error) });
        return false;
      }
      set({
        busy: null,
        user: data.user ?? null,
        status: data.session ? 'authed' : 'anon',
        error: data.session
          ? null
          : 'Проверь почту: нужно подтвердить адрес по ссылке из письма.',
      });
      return Boolean(data.user);
    },

    async signOut() {
      const supabase = getSupabase();
      if (!supabase) return;
      set({ busy: 'signout', error: null });
      const { error } = await supabase.auth.signOut();
      if (error) {
        set({ busy: null, error: readable(error) });
        return;
      }
      set({ busy: null, user: null, status: 'anon', recoveryMode: false });
    },

    async requestReset(email) {
      const supabase = getSupabase();
      if (!supabase) {
        set({ error: supabaseMissingHint() });
        return false;
      }
      set({ busy: 'reset', error: null });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Supabase по умолчанию добавляет свой код восстановления в адрес;
        // redirectTo указывает, куда вернуть человека после клика.
        redirectTo: `${location.origin}/`,
      });
      if (error) {
        set({ busy: null, error: readable(error) });
        return false;
      }
      set({ busy: null });
      return true;
    },

    async setNewPassword(password) {
      const supabase = getSupabase();
      if (!supabase) {
        set({ error: supabaseMissingHint() });
        return false;
      }
      set({ busy: 'newpassword', error: null });
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        set({ busy: null, error: readable(error) });
        return false;
      }
      set({ busy: null, recoveryMode: false });
      return true;
    },

    async changePassword(currentPassword, newPassword) {
      const supabase = getSupabase();
      if (!supabase) {
        set({ error: supabaseMissingHint() });
        return false;
      }
      const email = get().user?.email;
      if (!email) {
        set({ error: 'Нет адреса почты у текущего пользователя.' });
        return false;
      }
      set({ busy: 'changepassword', error: null });
      // Сначала подтверждаем, что текущий пароль известен именно владельцу.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        set({ busy: null, error: 'Текущий пароль указан неверно.' });
        return false;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        set({ busy: null, error: readable(error) });
        return false;
      }
      set({ busy: null });
      return true;
    },

    clearError() {
      set({ error: null });
    },

    clearRecovery() {
      set({ recoveryMode: false });
    },
  };
});

/** Текущая сессия — для движка синхронизации. */
export async function currentSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
