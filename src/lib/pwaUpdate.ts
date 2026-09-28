import { registerSW } from 'virtual:pwa-register';

/**
 * Регистрация Service Worker и ручное обновление PWA.
 *
 * registerType: 'autoUpdate' (см. vite.config.ts) — новая версия подхватывается
 * сама при следующей загрузке. Возвращаемая им функция позволяет применить
 * обновление не дожидаясь следующего открытия; ею пользуется карточка
 * «Обновление» в настройках.
 *
 * Модуль регистрирует воркер при импорте, поэтому в main.tsx он подключается
 * ради побочного эффекта.
 */
const updateServiceWorker = registerSW({ immediate: true });

/** Активировать свежего воркера и перезагрузить страницу. */
export function applyPwaUpdate(): Promise<void> {
  return Promise.resolve(updateServiceWorker(true));
}

/** PWA без Service Worker и без Electron: обновлять нечем. */
export function isPwaUpdateSupported(): boolean {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  return !(
    window as unknown as { momentumDesktop?: { isElectron?: boolean } }
  ).momentumDesktop?.isElectron;
}
