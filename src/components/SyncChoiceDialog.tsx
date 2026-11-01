import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CloudDownload, CloudUpload, HardDriveDownload } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { chooseCloud, chooseUpload } from '@/sync/engine';

/**
 * Что делать с данными, которые уже есть на устройстве.
 *
 * Два случая, в которых без вопроса не обойтись:
 *
 * - `merge` — на устройстве есть данные и в облаке есть данные. «Отправить»
 *   дополняет облако записанным здесь, «взять» заменяет устройство облачным.
 * - `account` — устройство осталось от другого аккаунта. По умолчанию берём
 *   облачное, но отправку своего оставляем явным выбором с предупреждением:
 *   иначе данные нельзя было бы сохранить в аккаунт, в который только что вошли.
 *
 * В обоих случаях в тексте назван аккаунт: человек должен видеть, куда именно
 * уедут данные. Диалог намеренно блокирующий и без крестика: пока решение не
 * принято, обмен стоит, а данные целы в обоих местах.
 */
export function SyncChoiceDialog() {
  const choice = useSyncStore((s) => s.choice);
  const cancel = useSyncStore((s) => s.cancelChoice);
  const email = useAuthStore((s) => s.user?.email ?? null);
  const [busy, setBusy] = useState<'upload' | 'cloud' | null>(null);

  if (!choice) return null;

  const otherAccount = choice === 'account';
  const intoAccount = email ? `в аккаунт ${email}` : 'в этот аккаунт';
  const ofAccount = email ? `аккаунта ${email}` : 'этого аккаунта';

  const run = async (kind: 'upload' | 'cloud') => {
    setBusy(kind);
    try {
      if (kind === 'upload') await chooseUpload();
      else await chooseCloud();

      // chooseUpload/chooseCloud не бросают исключений: сетевой сбой движок
      // записывает в стор. Хвалить «сохранено» в этом случае нельзя.
      const state = useSyncStore.getState();
      if (state.phase === 'error') {
        toast.error(kind === 'upload' ? 'Не удалось сохранить в аккаунт' : 'Не удалось взять из облака', {
          description: state.error ?? undefined,
        });
        return;
      }
      if (kind === 'upload') {
        toast.success(`Данные сохранены ${intoAccount}`);
      } else {
        toast.success('Данные загружены из облака', { description: email ?? undefined });
      }
    } catch (error) {
      toast.error('Не удалось обменяться данными', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

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
          ? `На устройстве остались данные, записанные под другим аккаунтом. Сейчас вы вошли ${intoAccount}.`
          : `На устройстве уже есть данные, и ${intoAccount} тоже. Ничего не изменится, пока вы не выберете.`
      }
    >
      <div className="space-y-3">
        {otherAccount ? (
          <>
            <Button
              variant="gradient"
              className="w-full justify-start"
              disabled={busy !== null}
              onClick={() => void run('cloud')}
            >
              <CloudDownload className="h-4 w-4" />
              {busy === 'cloud' ? 'Загружаем…' : 'Взять данные из облака'}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={busy !== null}
              onClick={() => void run('upload')}
            >
              <CloudUpload className="h-4 w-4" />
              {busy === 'upload' ? 'Сохраняем…' : 'Сохранить данные устройства'}
            </Button>
          </>
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

        <div className="space-y-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {otherAccount ? (
            <>
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <HardDriveDownload className="h-3.5 w-3.5" aria-hidden /> Что произойдёт
              </p>
              <p>
                «Взять данные из облака» удалит записанное на устройстве и загрузит данные{' '}
                {ofAccount}. Прежние не пропадут: они остаются в облаке прежнего аккаунта —
                войдите в него, и они вернутся.
              </p>
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                «Сохранить данные устройства» добавит записи прежнего аккаунта {intoAccount}. Так
                два аккаунта смешаются — выбирайте, только если это ваши данные.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">Отправить данные устройства</p>
              <p>
                То, что есть здесь, сохранится {intoAccount} и станет общим для всех устройств.
                Записи, которых на устройстве нет, добавятся из облака; удалённые здесь исчезнут
                и в облаке.
              </p>
              <p className="font-medium text-foreground">Взять данные из облака</p>
              <p>
                Данные на этом устройстве заменятся облачными. Записи, которых нет в облаке,
                пропадут — облако при этом не изменится.
              </p>
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                Новое устройство? Выбирайте «Взять данные из облака», иначе стартовые привычки из
                первого запуска добавятся к вашим и продублируются.
              </p>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
