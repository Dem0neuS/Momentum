import { useCallback, useEffect, useState } from 'react';

interface DesktopBridge {
  isElectron: true;
  platform: string;
  version: string;
  electron: string;
  checkUpdate(): Promise<UpdateCheckResult>;
  getUpdateState(): Promise<UpdateStateResult>;
  downloadUpdate(): Promise<{ ok: boolean; message?: string }>;
  installUpdate(): Promise<{ ok: boolean }>;
  onUpdateEvent(callback: (payload: UpdateEvent) => void): () => void;
  onUpdateCheckRequested(callback: () => void): () => void;
}

interface UpdateStateResult {
  supported: boolean;
  phase?: UpdatePhase;
  version?: string | null;
  percent?: number;
  transferred?: number;
  total?: number;
  currentVersion?: string;
  message?: string;
}

interface UpdateCheckResult extends UpdateStateResult {
  available: boolean;
  version?: string | null;
  currentVersion?: string;
}

type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'up-to-date'
  | 'error';

interface UpdateEvent {
  phase: UpdatePhase;
  version?: string | null;
  percent?: number;
  transferred?: number;
  total?: number;
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
  transferred: number;
  total: number;
  message: string | null;
  /** Проверить Releases прямо сейчас (сеть). */
  check(): Promise<void>;
  /** Скачать обновление после согласия пользователя. */
  download(): Promise<void>;
  /** Перезапустить и установить скачанное обновление. */
  install(): void;
}

/**
 * Автообновление десктопной версии.
 *
 * main-процесс сам проверяет GitHub Releases, сам скачивает новую версию и
 * ставит её при закрытии программы. Здесь мы только отражаем это состояние и
 * даём кнопку «Обновить», если пользователь не хочет ждать выхода.
 * В веб-версии и PWA моста нет — хук молча отдаёт supported: false.
 */
export function useAppUpdate(): UpdateState {
  const desktop = bridge();
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [latest, setLatest] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [transferred, setTransferred] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  /**
   * Разложить накопленное состояние в хук. Один разбор и для событий от
   * main, и для ответа IPC — иначе окно после перезагрузки (Ctrl+R) покажет
   * «установлена версия», хотя обновление уже скачано.
   */
  const apply = useCallback((state: UpdateStateResult) => {
    if (!state.supported) {
      setPhase('idle');
      setMessage(state.message ?? 'Обновление доступно только в установленной версии');
      return;
    }
    if (state.version) setLatest(state.version);
    if (state.message) setMessage(state.message);
    if (state.phase && state.phase !== 'idle') {
      setPhase(state.phase);
      setPercent(Number(state.percent ?? (state.phase === 'downloaded' ? 100 : 0)));
      setTransferred(Number(state.transferred ?? 0));
      setTotal(Number(state.total ?? 0));
    }
  }, []);

  /** Проверка по кнопке или из меню — с обращением к сети. */
  const check = useCallback(async () => {
    const api = bridge();
    if (!api) return;
    setPhase('checking');
    setMessage(null);
    const result = await api.checkUpdate();
    if (result.available && result.version && !result.phase) {
      // main ещё не отдал состояние — сообщаем о наличии обновления.
      setLatest(result.version);
      setPhase('available');
    }
    apply(result);
  }, [apply]);

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
    setPhase('installing');
    void bridge()?.installUpdate();
  }, []);

  // События от main-процесса: проверка, прогресс, готовность, ошибка.
  useEffect(() => {
    const api = bridge();
    if (!api) return;
    return api.onUpdateEvent((event) => {
      apply({ ...event, supported: true });
      // 'checking' в ответе IPC — это про нашу же проверку, её уже показали.
      if (event.phase === 'checking') setPhase('checking');
    });
  }, [apply]);

  /**
   * Синхронизация при открытии окна: берём накопленное состояние без сети.
   * Реальную проверку делает main по расписанию (старт + каждые 6 часов) —
   * иначе каждая перезагрузка окна била бы по API GitHub.
   */
  useEffect(() => {
    const api = bridge();
    if (!api) return;
    let alive = true;
    const timer = setTimeout(() => {
      void api.getUpdateState().then((state) => {
        if (alive) apply(state);
      });
    }, 1200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [apply]);

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
    transferred,
    total,
    message,
    check,
    download,
    install,
  };
}
