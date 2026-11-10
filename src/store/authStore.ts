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
  if (lower.includes('user not found')) return 'Аккаунт с такой почтой не найден.';
  if (lower.includes('password should be at least')) return 'Пароль короче 6 символов.';
  if (lower.includes('signup is disabled') || lower.includes('signups not allowed')) {
    return 'Регистрация временно закрыта в настройках кабинета.';
  }
  if (
    lower.includes('error sending') ||
    lower.includes('sending confirmation email') ||
    lower.includes('smtp')
  ) {
    return 'Аккаунт создан, но письмо не ушло: почта в Supabase не настроена или временно недоступна. Попробуй отправить ещё раз позже.';
  }
  if (lower.includes('email rate limit') || lower.includes('over_email_send_rate_limit')) {
    return 'Слишком много писем. Подожди несколько минут и попробуй снова.';
  }
  if (lower.includes('invalid email') || (lower.includes('email') && lower.includes('invalid'))) {
    return 'Проверь адрес почты.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Слишком много попыток. Подожди минуту и повтори.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('load failed')
  ) {
    return 'Сервер кабинета недоступен. Локальные данные работают; попробуй позже.';
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
  /** Нейтральное сообщение (например, «письмо отправлено»), не ошибка. */
  notice: string | null;
  /** Почта, на которую уже отправляли письмо подтверждения. */
  pendingEmail: string | null;

  signIn(email: string, password: string): Promise<boolean>;
  signUp(email: string, password: string): Promise<boolean>;
  /** Отправить письмо подтверждения ещё раз (например, после лимита SMTP). */
  resendConfirmation(): Promise<boolean>;
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
    notice: null,
    pendingEmail: null,

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
      set({ busy: 'signin', error: null, notice: null });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ busy: null, error: readable(error) });
        return false;
      }
      set({ busy: null, user: data.user, status: 'authed', pendingEmail: null });
      return true;
    },

    async signUp(email, password) {
      const supabase = getSupabase();
      if (!supabase) {
        set({ error: supabaseMissingHint() });
        return false;
      }
      set({ busy: 'signup', error: null, notice: null });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Если в проекте выключено подтверждение почты, сессия придёт сразу.
        options: { emailRedirectTo: `${location.origin}/` },
      });
      if (error) {
        // Даже при ошибке отправки письма Supabase иногда успевает создать
        // пользователя — оставляем почту, чтобы можно было попросить письмо
        // повторно, когда почтовый сервис оживёт.
        const sendFailed = /sending|smtp|confirmation email/i.test(error.message);
        set({
          busy: null,
          error: readable(error),
          pendingEmail: sendFailed ? email : get().pendingEmail,
        });
        return false;
      }
      if (data.session) {
        set({
          busy: null,
          user: data.user ?? null,
          status: 'authed',
          notice: null,
          pendingEmail: null,
        });
        return Boolean(data.user);
      }
      set({
        busy: null,
        user: data.user ?? null,
        status: 'anon',
        notice: 'Аккаунт создан. Проверь почту и подтверди адрес по ссылке из письма.',
        pendingEmail: email,
      });
      return Boolean(data.user);
    },

    async resendConfirmation() {
      const supabase = getSupabase();
      if (!supabase) {
        set({ error: supabaseMissingHint() });
        return false;
      }
      const email = get().pendingEmail;
      if (!email) {
        set({ error: 'Сначала укажи почту и создай аккаунт.' });
        return false;
      }
      set({ busy: 'resend', error: null, notice: null });
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${location.origin}/` },
      });
      if (error) {
        set({ busy: null, error: readable(error) });
        return false;
      }
      set({
        busy: null,
        notice: 'Письмо отправлено ещё раз. Проверь почту и папку «Спам».',
      });
      return true;
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
      set({
        busy: null,
        user: null,
        status: 'anon',
        recoveryMode: false,
        notice: null,
        pendingEmail: null,
      });
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
      set({ error: null, notice: null });
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
