import * as React from 'react';
import { LogIn, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { Popover } from './ui/popover';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { initialsOf } from '@/lib/metrics';
import { useAuthStore } from '@/store/authStore';

/**
 * Монограмма в правом верхнем углу.
 *
 * Это кнопка, а не ссылка: aria-current ей не нужен, а aria-haspopup и
 * aria-expanded проставляет сам Popover. Аватар — один div с градиентом:
 * ни SVG, ни загрузки файла, потому что монограмма всегда состоит из букв.
 */
export function ProfileAvatar({ name, onOpenProfile }: { name: string; onOpenProfile: () => void }) {
  const status = useAuthStore((s) => s.status);
  const signOut = useAuthStore((s) => s.signOut);
  const busy = useAuthStore((s) => s.busy);
  const authed = status === 'authed';
  const initials = initialsOf(name);

  return (
    <Popover
      align="end"
      label="Профиль"
      trigger={
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-[30%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-8 sm:w-8"
          title={authed ? 'Профиль' : 'Профиль и вход'}
        >
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center rounded-[30%] text-[13px] font-semibold text-on-brand"
            style={{ background: 'linear-gradient(135deg, #7C5CFF, #4A8CFF)' }}
          >
            {initials}
          </span>
          <span className="sr-only">Профиль</span>
        </button>
      }
      panelClassName="w-64 p-3"
    >
      {(close) => (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[30%] text-xs font-semibold text-on-brand"
              style={{ background: 'linear-gradient(135deg, #7C5CFF, #4A8CFF)' }}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name || 'Профиль'}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {authed ? <ShieldCheck className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                {authed ? 'Вход выполнен' : 'Данные только на устройстве'}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              close();
              onOpenProfile();
            }}
          >
            <UserRound className="h-4 w-4" /> Открыть профиль
          </Button>

          {authed ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              disabled={busy === 'signout'}
              onClick={() => {
                close();
                void signOut();
              }}
            >
              <LogOut className="h-4 w-4" /> Выйти
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                close();
                onOpenProfile();
              }}
            >
              <LogIn className="h-4 w-4" /> Войти в аккаунт
            </Button>
          )}
        </div>
      )}
    </Popover>
  );
}

/** Заглушка, когда имя ещё не задано: та же геометрия, что у монограммы. */
export function AvatarFallback({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex h-8 w-8 items-center justify-center rounded-[30%] text-[13px] font-semibold text-on-brand', className)}
      style={{ background: 'linear-gradient(135deg, #7C5CFF, #4A8CFF)' }}
    >
      М
    </span>
  );
}
