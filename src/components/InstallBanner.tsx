import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/lib/usePwaInstall';

const DISMISS_KEY = 'momentum:install-dismissed-at';
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000;

function isDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (!at) return false;
    if (Date.now() - at > DISMISS_TTL) {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Ненавязчивый баннер установки на дашборде: появляется, когда браузер
 * готов показать промпт, и молчит неделю после «Позже».
 */
export function InstallBanner() {
  const { canInstall, install } = usePwaInstall();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(isDismissed());
  }, []);

  if (!canInstall || hidden) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-card">
      <div className="min-w-0">
        <p className="text-sm font-medium">Установите Momentum на устройство</p>
        <p className="text-xs text-muted-foreground">
          Иконка на рабочем столе, отдельное окно и работа без интернета
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={async () => {
            const outcome = await install();
            if (outcome === 'accepted') toast.success('Momentum установлен');
            else if (outcome === 'dismissed') toast('Установить можно в разделе «Настройки → Приложение»');
          }}
        >
          <Download className="h-4 w-4" /> Установить
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Скрыть предложение установки"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, String(Date.now()));
            } catch {
              /* приватный режим — просто скрываем до перезагрузки */
            }
            setHidden(true);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
