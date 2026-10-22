import { HardDrive, RotateCw } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Экран вместо пустого приложения, если IndexedDB не открылась
 * (приватный режим, запрет хранилища, нехватка места).
 */
export function BootError({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div
        role="alert"
        className="w-full max-w-md rounded-lg border border-border/70 bg-card p-6 text-center shadow-card"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
          <HardDrive className="h-6 w-6 text-danger-ink" aria-hidden />
        </span>
        <h1 className="mt-3 text-lg font-semibold">Не удалось открыть хранилище</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Приложение хранит данные в браузере. Проверьте, что не включён приватный режим и
          есть свободное место, затем попробуйте снова.
        </p>
        <pre className="mt-3 max-h-24 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-left text-xs text-muted-foreground">
          {message}
        </pre>
        <Button className="mt-4" variant="gradient" onClick={() => window.location.reload()}>
          <RotateCw className="h-4 w-4" /> Попробовать снова
        </Button>
      </div>
    </div>
  );
}
