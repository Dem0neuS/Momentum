import { useCallback, useState } from 'react';
import { applyPwaUpdate, isPwaUpdateSupported } from '@/lib/pwaUpdate';

export interface PwaUpdateState {
  /** Веб-версия со Service Worker — обновление можно применять вручную. */
  supported: boolean;
  busy: boolean;
  /** Проверить новую версию и, если есть, сразу её применить. */
  update(): void;
}

/**
 * Обновление веб-версии.
 *
 * Service Worker зарегистрирован с registerType: 'autoUpdate', то есть новая
 * версия подхватывается сама при следующей загрузке. Эта кнопка нужна, чтобы
 * не ждать следующего открытия: applyPwaUpdate() активирует свежего воркера и
 * перезагружает страницу. Если обновления нет, страница просто останется.
 */
export function usePwaUpdate(): PwaUpdateState {
  const supported = isPwaUpdateSupported();
  const [busy, setBusy] = useState(false);

  const update = useCallback(() => {
    setBusy(true);
    void applyPwaUpdate()
      .catch(() => {})
      .finally(() => setBusy(false));
  }, []);

  return { supported, busy, update };
}
