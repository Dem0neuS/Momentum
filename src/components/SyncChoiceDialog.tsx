import { useState } from 'react';
import { CloudDownload, CloudUpload, HardDriveDownload } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { useSyncStore } from '@/store/syncStore';
import { chooseCloud, chooseUpload } from '@/sync/engine';

/**
 * Что делать с данными, которые уже есть на устройстве.
 *
 * Ситуация возникает ровно одна, но важная: человек вошёл в аккаунт, у которого
 * в облаке уже есть данные, а на устройстве тоже что-то есть — потому что
 * приложение при первом запуске создаёт стартовые привычки. Что победит, без
 * вопроса решить нельзя: отправить устройство в облако значит переписать чужой
 * аккаунт, а взять облачное — потерять то, что набрано здесь.
 *
 * Диалог намеренно блокирующий и без возможности закрыть его крестиком: пока
 * решение не принято, обмен стоит, а данные целы в обоих местах.
 */
export function SyncChoiceDialog() {
  const choice = useSyncStore((s) => s.choice);
  const canUpload = useSyncStore((s) => s.choiceCanUpload);
  const cancel = useSyncStore((s) => s.cancelChoice);
  const [busy, setBusy] = useState<'upload' | 'cloud' | null>(null);

  if (!choice) return null;

  const run = async (kind: 'upload' | 'cloud') => {
    setBusy(kind);
    try {
      if (kind === 'upload') await chooseUpload();
      else await chooseCloud();
    } finally {
      setBusy(null);
    }
  };

  const otherAccount = choice === 'account';

  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) cancel();
      }}
      hideClose
      closeOnOverlay={false}
      size="sm"
      title={otherAccount ? 'Данные другого аккаунта' : 'Данные на этом устройстве'}
      description={
        otherAccount
          ? 'На устройстве остались данные, записанные под другим аккаунтом. В новый аккаунт их отправлять нельзя, а в этом виде они будут перемешаны с облачными.'
          : 'На устройстве уже есть данные, и в облаке тоже. Нужно выбрать, что с этим делать.'
      }
    >
      <div className="space-y-3">
        {otherAccount ? (
          <Button
            variant="gradient"
            className="w-full justify-start"
            disabled={busy !== null}
            onClick={() => void run('cloud')}
          >
            <CloudDownload className="h-4 w-4" />
            {busy === 'cloud' ? 'Загружаем из облака…' : 'Взять данные из облака'}
          </Button>
        ) : (
          <>
            <Button
              variant="gradient"
              className="w-full justify-start"
              disabled={busy !== null}
              onClick={() => void run('upload')}
            >
              <CloudUpload className="h-4 w-4" />
              {busy === 'upload' ? 'Отправляем…' : 'Отправить данные устройства в облако'}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={busy !== null}
              onClick={() => void run('cloud')}
            >
              <CloudDownload className="h-4 w-4" />
              {busy === 'cloud' ? 'Загружаем…' : 'Взять данные из облака'}
            </Button>
          </>
        )}

        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {otherAccount ? (
            <>
              <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <HardDriveDownload className="h-3.5 w-3.5" aria-hidden /> Что произойдёт
              </p>
              Данные устройства будут удалены, а вместо них загружены данные этого
              аккаунта из облака. Прежние данные не пропадут: они остаются в облаке
              прежнего аккаунта — войдите в него, и они вернутся.
            </>
          ) : (
            <>
              <p className="mb-1 font-medium text-foreground">Отправить устройство</p>
              То, что есть здесь, станет общим для всех устройств. Записи, которых
              на устройстве нет, добавятся из облака — удалённые здесь тоже исчезнут
              и там.
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
