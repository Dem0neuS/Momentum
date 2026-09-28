import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, KeyRound, LogIn, LogOut, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from './ui/button';
import { Field } from './ui/label';
import { Input } from './ui/input';
import { useAuthStore } from '@/store/authStore';
import { isSupabaseConfigured, supabaseMissingHint } from '@/lib/supabase';

/**
 * Вход, регистрация и выход.
 *
 * Пока кабинет не настроен (нет .env.local), блок объясняет это и не рисует
 * формы: приложение остаётся полностью рабочим локально.
 */
export function AccountCard() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);
  const clearError = useAuthStore((s) => s.clearError);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-border/60 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">{supabaseMissingHint()}</p>
      </div>
    );
  }

  if (status === 'authed') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-border/60 px-4 py-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-done-ink" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm">{user?.email}</p>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy === 'signout'}
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" /> Выйти
          </Button>
        </div>
        {error && <p className="text-xs text-destructive-ink">{error}</p>}
      </div>
    );
  }

  const submit = async () => {
    const ok = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    if (ok && mode === 'signup') {
      toast('Проверьте почту: нужно подтвердить адрес по ссылке из письма');
    }
    if (ok) setPassword('');
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Вход или регистрация">
        <Button
          size="sm"
          variant={mode === 'signin' ? 'outline' : 'ghost'}
          onClick={() => {
            setMode('signin');
            clearError();
          }}
        >
          <LogIn className="h-4 w-4" /> Войти
        </Button>
        <Button
          size="sm"
          variant={mode === 'signup' ? 'outline' : 'ghost'}
          onClick={() => {
            setMode('signup');
            clearError();
          }}
        >
          <UserPlus className="h-4 w-4" /> Регистрация
        </Button>
      </div>

      <Field label="Почта">
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Пароль" hint="Не короче 6 символов.">
        <Input
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>

      {error && <p className="text-xs text-destructive-ink">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy !== null || !email || !password}
          onClick={() => void submit()}
        >
          {busy ? 'Отправляем…' : mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
        </Button>
        <ForgotPasswordLink />
      </div>
    </div>
  );
}

/** Ссылка «забыли пароль» вынесена отдельно: у неё свой поток и своё поле. */
function ForgotPasswordLink() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const requestReset = useAuthStore((s) => s.requestReset);
  const busy = useAuthStore((s) => s.busy);
  const clearError = useAuthStore((s) => s.clearError);

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        onClick={() => {
          setOpen(true);
          clearError();
        }}
      >
        Забыли пароль?
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <Field label="Почта для восстановления" hint="На неё придёт ссылка для смены пароля.">
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={busy !== null || !email}
          onClick={async () => {
            const ok = await requestReset(email);
            if (ok) {
              toast('Письмо отправлено: откройте ссылку в нём');
              setOpen(false);
            }
          }}
        >
          <Mail className="h-4 w-4" /> Отправить ссылку
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

/**
 * Постановка нового пароля.
 *
 * Показывается, когда человек открыл ссылку из письма: в адресе есть
 * токены восстановления, Supabase отдал сессию и выставил recoveryMode.
 */
export function RecoveryCard() {
  const recoveryMode = useAuthStore((s) => s.recoveryMode);
  const setNewPassword = useAuthStore((s) => s.setNewPassword);
  const clearRecovery = useAuthStore((s) => s.clearRecovery);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);
  const [value, setValue] = useState('');
  const [repeat, setRepeat] = useState('');

  if (!recoveryMode) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border/60 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <KeyRound className="h-4 w-4" aria-hidden /> Новый пароль
      </p>
      <Field label="Пароль" hint="Не короче 6 символов.">
        <Input
          type="password"
          autoComplete="new-password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <Field label="Ещё раз">
        <Input
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !value || value !== repeat) return;
            void setNewPassword(value).then((ok) => {
              if (ok) {
                toast('Пароль изменён');
                setValue('');
                setRepeat('');
                clearRecovery();
              }
            });
          }}
        />
      </Field>
      {value && repeat && value !== repeat && (
        <p className="text-xs text-destructive-ink">Пароли не совпадают.</p>
      )}
      {error && <p className="text-xs text-destructive-ink">{error}</p>}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={busy !== null || !value || value !== repeat}
          onClick={() =>
            void setNewPassword(value).then((ok) => {
              if (ok) {
                toast('Пароль изменён');
                setValue('');
                setRepeat('');
                clearRecovery();
              }
            })
          }
        >
          Сохранить пароль
        </Button>
        <Button size="sm" variant="ghost" onClick={clearRecovery}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

/**
 * Смена пароля на живом аккаунте.
 *
 * Текущий пароль спрашивается обязательно: сессия может остаться открытой на
 * чужом устройстве, и без повторного входа смена была бы доступна кому угодно.
 */
export function ChangePasswordCard() {
  const status = useAuthStore((s) => s.status);
  const changePassword = useAuthStore((s) => s.changePassword);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');

  if (!isSupabaseConfigured || status !== 'authed') return null;

  const submit = async () => {
    const ok = await changePassword(current, next);
    if (ok) {
      toast('Пароль изменён');
      setCurrent('');
      setNext('');
      setRepeat('');
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Текущий пароль">
        <Input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            if (error) clearError();
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Новый пароль" hint="Не короче 6 символов.">
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field label="Ещё раз">
          <Input
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </Field>
      </div>
      {next && repeat && next !== repeat && (
        <p className="text-xs text-destructive-ink">Пароли не совпадают.</p>
      )}
      {error && <p className="text-xs text-destructive-ink">{error}</p>}
      <Button
        size="sm"
        disabled={busy !== null || !current || !next || next !== repeat}
        onClick={() => void submit()}
      >
        <KeyRound className="h-4 w-4" /> Сменить пароль
      </Button>
    </div>
  );
}
