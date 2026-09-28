import { useCallback, useEffect, useState } from 'react';

interface DesktopBridge {
  isElectron: true;
  platform: string;
  version: string;
  electron: string;
  checkUpdate(): Promise<UpdateCheckResult>;
  downloadUpdate(): Promise<{ ok: boolean; message?: string }>;
  installUpdate(): Promise<{ ok: boolean }>;
  onUpdateEvent(callback: (payload: UpdateEvent) => void): () => void;
  onUpdateCheckRequested(callback: () => void): () => void;
}

interface UpdateCheckResult {
  available: boolean;
  supported: boolean;
  version?: string | null;
  currentVersion?: string;
  message?: string;
}

type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error';

interface UpdateEvent {
  phase: UpdatePhase;
  version?: string | null;
  percent?: number;
  message?: string;
}

function bridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { momentumDesktop?: DesktopBridge }).momentumDesktop ?? null;
}

export interface UpdateState {
  /** Десктопная обёртка — обновление возможно. */
  supported: boolean;
  phase: UpdatePhase;
  /** Текущая установленная версия. */
  current: string;
  /** Версия, которую предлагает обновиться. */
  latest: string | null;
  /** 0…100 во время скачивания. */
  percent: number;
  message: string | null;
  check(): Promise<void>;
  download(): Promise<void>;
  install(): void;
}

/**
 * Автообновление десктопной версии.
 *
 * Ничего не скачивается без явного действия пользователя: main-процесс
 * только сообщает, что появилась новая версия, а решение принимает человек.
 * В веб-версии и PWA моста нет — хук молча отдаёт supported: false.
 */
export function useAppUpdate(): UpdateState {
  const desktop = bridge();
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [latest, setLatest] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const check = useCallback(async () => {
    const api = bridge();
    if (!api) return;
    setPhase('checking');
    setMessage(null);
    const result = await api.checkUpdate();
    if (!result.supported) {
      setPhase('idle');
      setMessage(result.message ?? 'Обновление доступно только в установленной версии');
      return;
    }
    if (result.available && result.version) {
      setLatest(result.version);
      setPhase('available');
    } else {
      setPhase('up-to-date');
    }
  }, []);

  const download = useCallback(async () => {
    const api = bridge();
    if (!api) return;
    setPhase('downloading');
    setPercent(0);
    const result = await api.downloadUpdate();
    if (!result.ok) {
      setPhase('error');
      setMessage(result.message ?? 'Не удалось скачать обновление');
    }
  }, []);

  const install = useCallback(() => {
    void bridge()?.installUpdate();
  }, []);

  // События от main-процесса: найдена версия, прогресс, ошибка.
  useEffect(() => {
    const api = bridge();
    if (!api) return;
    return api.onUpdateEvent((event) => {
      switch (event.phase) {
        case 'available':
          setLatest(event.version ?? null);
          setPhase('available');
          break;
        case 'downloading':
          setPhase('downloading');
          setPercent(Number(event.percent ?? 0));
          break;
        case 'downloaded':
          setLatest(event.version ?? null);
          setPhase('downloaded');
          setPercent(100);
          break;
        case 'up-to-date':
          setPhase('up-to-date');
          break;
        case 'error':
          setPhase('error');
          setMessage(event.message ?? 'Ошибка обновления');
          break;
        default:
          break;
      }
    });
  }, []);

  // Пункт меню «Проверить обновления».
  useEffect(() => {
    const api = bridge();
    if (!api) return;
    return api.onUpdateCheckRequested(() => void check());
  }, [check]);

  return {
    supported: Boolean(desktop),
    phase,
    current: desktop?.version ?? '',
    latest,
    percent,
    message,
    check,
    download,
    install,
  };
}
