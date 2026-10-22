import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAppUpdate, type UpdateCheckResult } from '@/lib/useAppUpdate';
import { usePwaUpdate } from '@/lib/usePwaUpdate';

/** Мегабайты из байтов, которые electron-updater отдаёт в прогрессе. */
function megabytes(bytes: number): string {
  if (!bytes) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/**
 * Обновление приложения.
 *
 * Десктопная версия обновляется сама: main-процесс проверяет GitHub Releases,
 * скачивает новую версию в фоне и ставит её при закрытии программы. Здесь
 * видно, что происходит, и есть кнопка «Обновить», чтобы не ждать выхода.
 */
export function UpdateAppCard() {
  const desktop = useAppUpdate();
  const pwa = usePwaUpdate();
  const { supported, phase, current, latest, percent, transferred, total, message, check, install } =
    desktop;

  if (!supported) {
    if (!pwa.supported) return null;
    return (
      <div className="space-y-3 rounded-xl border border-border/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Обновление</p>
            <p className="text-xs text-muted-foreground">
              Новая версия подхватывается сама при следующем открытии
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={pwa.update} disabled={pwa.busy}>
            <RefreshCw className={`h-4 w-4 ${pwa.busy ? 'animate-spin' : ''}`} />
            {pwa.busy ? 'Обновляем…' : 'Обновить сейчас'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Данные хранятся на этом устройстве и переживают обновление.
        </p>
      </div>
    );
  }

  const busy = phase === 'checking' || phase === 'installing';
  const downloading = phase === 'downloading' || phase === 'available';
  const ready = phase === 'downloaded';

  const status = ready
    ? `Версия ${latest ?? ''} готова к установке`
    : phase === 'installing'
      ? 'Перезапускаем и устанавливаем…'
      : downloading
        ? latest
          ? `Скачиваем версию ${latest}…`
          : 'Скачиваем обновление…'
        : `Установлена версия ${current || '—'}`;

  const size = total > 0 ? ` · ${megabytes(transferred)} из ${megabytes(total)}` : '';

  return (
    <div className="space-y-3 rounded-xl border border-border/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Обновление</p>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>

        {ready ? (
          <Button size="sm" onClick={install}>
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>
        ) : (
          <Button
            size="sm"
            variant={downloading ? 'default' : 'outline'}
            onClick={() => void check()}
            disabled={busy || downloading}
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Проверяем…' : 'Проверить обновления'}
          </Button>
        )}
      </div>

      {downloading && (
        <div className="space-y-1.5">
          <Progress value={percent} label="Скачивание обновления" />
          <p className="text-xs text-muted-foreground">
            {Math.round(percent)}%{size} · обновление установится при следующем закрытии программы
          </p>
        </div>
      )}

      {ready && (
        <p className="text-xs text-muted-foreground">
          Можно нажать «Обновить» сейчас или закрыть программу — обновление встанет само.
        </p>
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

/**
 * Всплывающие уведомления об обновлении.
 *
 * Раньше хук нигде не вызывался — тоста просто не было. Теперь он сообщает
 * о двух вещах: нашли новую версию и файл готов к установке. Раньше обновление
 * проходило совсем тихо: приложение само скачивало новую версию и само её
 * ставило при закрытии, а человек об этом не узнавал.
 */
export function useUpdateToast() {
  const notified = useRef<Record<string, boolean>>({});

  /** Отклик на проверку по запросу человека: меню или кнопка. */
  const handleChecked = useCallback((result: UpdateCheckResult) => {
    if (!result.supported) return;
    if (result.available) return; // об этом сообщит эффект по фазе «available».
    if (result.phase === 'up-to-date') {
      toast('Установлена последняя версия', {
        description: result.currentVersion ? `Версия ${result.currentVersion}` : undefined,
      });
      return;
    }
    if (result.message) {
      toast('Не удалось проверить обновления', { description: result.message });
    }
  }, []);

  const { phase, latest, install } = useAppUpdate({ onChecked: handleChecked });

  // Нашли новую версию — сказать сразу, не дожидаясь скачивания.
  useEffect(() => {
    if (phase !== 'available' || !latest) return;
    const key = `found:${latest}`;
    if (notified.current[key]) return;
    notified.current[key] = true;
    toast(`Доступна версия ${latest}`, {
      description: 'Скачивание идёт в фоне. Кнопка «Обновить» появится, когда файл будет готов.',
    });
  }, [phase, latest]);

  // Файл скачан — можно ставить.
  useEffect(() => {
    if (phase !== 'downloaded' || !latest) return;
    const key = `ready:${latest}`;
    if (notified.current[key]) return;
    notified.current[key] = true;
    toast('Обновление готово', {
      description: `Версия ${latest} скачана. Можно обновиться сейчас или при следующем запуске.`,
      action: { label: 'Обновить', onClick: install },
      duration: 10000,
    });
  }, [phase, latest, install]);
}
