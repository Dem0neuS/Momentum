import { useEffect, useRef } from 'react';
import { AlertTriangle, Check, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAppUpdate } from '@/lib/useAppUpdate';

/**
 * Обновление десктопной версии.
 *
 * Ничего не скачивается само: сначала проверка по кнопке (или тихо при
 * старте), потом явное «Скачать», потом «Перезапустить и установить».
 */
export function UpdateAppCard() {
  const { supported, phase, current, latest, percent, message, check, download, install } = useAppUpdate();

  if (!supported) return null;

  const checking = phase === 'checking';
  const downloading = phase === 'downloading';
  const downloaded = phase === 'downloaded';
  const available = phase === 'available';

  return (
    <div className="space-y-3 rounded-xl border border-border/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Обновление</p>
          <p className="text-xs text-muted-foreground">
            {downloaded
              ? `Версия ${latest ?? ''} скачана`
              : available
                ? `Доступна версия ${latest ?? ''}`
                : downloading
                  ? 'Скачиваем обновление…'
                  : `Установлена версия ${current || '—'}`}
          </p>
        </div>

        {downloaded ? (
          <Button size="sm" onClick={install}>
            <RefreshCw className="h-4 w-4" />
            Перезапустить и установить
          </Button>
        ) : available ? (
          <Button size="sm" onClick={() => void download()}>
            <Download className="h-4 w-4" />
            Скачать обновление
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void check()} disabled={checking || downloading}>
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Проверяем…' : 'Проверить обновления'}
          </Button>
        )}
      </div>

      {downloading && (
        <div className="space-y-1.5">
          <Progress value={percent} aria-label="Прогресс скачивания обновления" />
          <p className="text-xs text-muted-foreground">{Math.round(percent)}%</p>
        </div>
      )}

      {phase === 'up-to-date' && (
        <p className="flex items-center gap-1.5 text-xs text-done-ink">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Установлена последняя версия
        </p>
      )}

      {phase === 'error' && (
        <p className="flex items-center gap-1.5 text-xs text-destructive-ink">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {message ?? 'Не удалось обновиться'}
        </p>
      )}

      {message && phase !== 'error' && <p className="text-xs text-muted-foreground">{message}</p>}

      <p className="text-xs text-muted-foreground">
        Данные хранятся на этом компьютере и переживают обновление.
      </p>
    </div>
  );
}

/** Всплывающее уведомление, когда новая версия найдена сама, при старте. */
export function useUpdateToast() {
  const { phase, latest, check } = useAppUpdate();
  const shownFor = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== 'available' || !latest || shownFor.current === latest) return;
    shownFor.current = latest;
    toast('Доступно обновление', {
      description: `Версия ${latest}. Скачать можно в «Настройки → Приложение».`,
      action: { label: 'Проверить', onClick: () => void check() },
      duration: 8000,
    });
  }, [phase, latest, check]);
}
