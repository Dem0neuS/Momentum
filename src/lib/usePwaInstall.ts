import { useCallback, useMemo, useSyncExternalStore } from 'react';

/** Событие установки PWA, которое браузер отдаёт через beforeinstallprompt. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallState =
  | 'unavailable' // промпт недоступен или уже использован (iOS Safari, Firefox, отказ)
  | 'ready' // можно показать кнопку установки
  | 'installing'
  | 'installed'; // приложение уже запущено как отдельное

export interface InstallHint {
  /** Что показать пользователю, если кнопка недоступна. */
  title: string;
  steps: string[];
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    // Electron и старые оболочки
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { momentumDesktop?: { isElectron: true } }).momentumDesktop?.isElectron,
  );
}

/** Подсказка для браузеров без beforeinstallprompt. */
function manualHint(): InstallHint | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) {
    return {
      title: 'Добавьте Momentum на главный экран',
      steps: [
        'Нажмите кнопку «Поделиться» в Safari.',
        'Выберите «На экран “Домой”».',
        'Подтвердите — иконка появится на рабочем столе.',
      ],
    };
  }
  return {
    title: 'Установите Momentum как приложение',
    steps: [
      'Откройте меню браузера (⋮ или ⋯).',
      'Выберите «Установить приложение» / «Приложения» / «На рабочий стол».',
      'Подтвердите установку — появится отдельная иконка.',
    ],
  };
}

/* --- Общее состояние ------------------------------------------------------
 * beforeinstallprompt браузер присылает один раз за сессию, поэтому состояние
 * должно быть общим для всех мест приложения (баннер и настройки), иначе
 * второе место так и не увидит промпт и покажет ручную подсказку.
 */

interface Snapshot {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  installing: boolean;
}

let snapshot: Snapshot = {
  deferred: null,
  installed: detectStandalone(),
  installing: false,
};

const listeners = new Set<() => void>();
let attached = false;

function update(patch: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

function attach(): void {
  if (attached || typeof window === 'undefined') return;
  attached = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    update({ deferred: event as BeforeInstallPromptEvent });
  });

  window.addEventListener('appinstalled', () => {
    update({ installed: true, deferred: null, installing: false });
  });

  // Отдельное окно могло открыться уже после монтирования.
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener('change', () => update({ installed: detectStandalone() }));
}

function subscribe(listener: () => void): () => void {
  attach();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = (): Snapshot => ({
  deferred: null,
  installed: false,
  installing: false,
});

async function runInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const deferred = snapshot.deferred;
  if (!deferred) return 'unavailable';
  update({ installing: true });
  try {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    // Событие одноразовое: после промпта браузер больше его не пришлёт,
    // поэтому и кнопку, и баннер дальше показывать нечего.
    update({ deferred: null, installing: false, installed: choice.outcome === 'accepted' });
    return choice.outcome;
  } catch {
    update({ installing: false });
    return 'unavailable';
  }
}

export interface UsePwaInstall {
  state: InstallState;
  /** Можно ли показать кнопку/баннер установки прямо сейчас. */
  canInstall: boolean;
  /** Уже установлено (отдельное окно приложения). */
  installed: boolean;
  /** Приложение запущено в десктопной обёртке — установка не нужна. */
  desktop: boolean;
  /** Показать системный промпт браузера. */
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Пошаговая подсказка для браузеров без промпта. */
  hint: InstallHint | null;
}

/**
 * Установка PWA: ловит beforeinstallprompt, даёт кнопку «Установить»,
 * которая кладёт иконку на рабочий стол (Windows/Chrome/Яндекс) или на
 * главный экран (Android/iOS).
 */
export function usePwaInstall(): UsePwaInstall {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const desktop = useMemo(isElectron, []);
  const install = useCallback(runInstall, []);

  const state: InstallState = current.installed
    ? 'installed'
    : current.installing
      ? 'installing'
      : current.deferred
        ? 'ready'
        : 'unavailable';

  return {
    state,
    canInstall: state === 'ready',
    installed: current.installed,
    desktop,
    install,
    // Пока промпт доступен, ручная подсказка не нужна.
    hint: current.deferred || current.installed ? null : manualHint(),
  };
}
