import { useState } from 'react';
import { Check, Download, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/lib/usePwaInstall';

/**
 * Блок установки приложения: кладёт иконку на рабочий стол
 * (Windows/macOS) или на главный экран (Android/iOS).
 * Если браузер не показывает системный промпт — даём точные шаги.
 */
export function InstallAppCard({ compact = false }: { compact?: boolean }) {
  const { canInstall, installed, desktop, install, hint, state } = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (desktop) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
        <Monitor className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium">Приложение для компьютера</p>
          <p className="text-xs text-muted-foreground">
            Запущено в отдельном окне. Данные хранятся локально на этом компьютере.
          </p>
        </div>
      </div>
    );
  }

  if (installed) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
        <Check className="h-5 w-5 shrink-0 text-done-ink" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium">Momentum установлен</p>
          <p className="text-xs text-muted-foreground">
            Иконка приложения уже есть на вашем устройстве.
          </p>
        </div>
      </div>
    );
  }

  const showSteps = open || (!canInstall && hint);

  return (
    <div className="space-y-3 rounded-xl border border-border/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Установить приложение</p>
          <p className="text-xs text-muted-foreground">
            {compact
              ? 'Иконка на рабочем столе, отдельное окно и работа без интернета'
              : 'Отдельная иконка, запуск без адресной строки и работа без интернета'}
          </p>
        </div>
        {canInstall ? (
          <Button
            size="sm"
            onClick={async () => {
              const outcome = await install();
              if (outcome === 'accepted') toast.success('Momentum установлен');
              else if (outcome === 'dismissed') toast('Установку можно начать снова в любой момент');
            }}
            disabled={state === 'installing'}
          >
            <Download className="h-4 w-4" />
            {state === 'installing' ? 'Устанавливаем…' : 'Установить'}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <Smartphone className="h-4 w-4" />
            Как установить
          </Button>
        )}
      </div>

      {showSteps && hint && (
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          {hint.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
