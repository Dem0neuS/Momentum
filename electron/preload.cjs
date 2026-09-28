'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/** Версия приложения приходит из main через additionalArguments (sandbox без доступа к app). */
const versionArg = process.argv.find((a) => a.startsWith('--momentum-version='));
const appVersion = versionArg ? versionArg.split('=')[1] : '';

/**
 * Минимальный мост между приложением и оболочкой.
 * В веб-версии window.momentumDesktop отсутствует — код это проверяет
 * (см. src/lib/usePwaInstall.ts).
 */
contextBridge.exposeInMainWorld('momentumDesktop', {
  isElectron: true,
  platform: process.platform,
  version: appVersion,
  electron: process.versions.electron,
  /** Открыть внешнюю ссылку в системном браузере. */
  openExternal: (url) => ipcRenderer.send('momentum:open-external', String(url)),
  /** Свернуть/развернуть окно — на случай, если понадобится полноэкранный режим. */
  setFullScreen: (value) => ipcRenderer.send('momentum:full-screen', Boolean(value)),
  /** Проверить обновление: скачивание начинается само, сеть не блокирует UI. */
  checkUpdate: () => ipcRenderer.invoke('momentum:update-check'),
  /**
   * Накопленное состояние без обращения к сети. Нужно при открытии и перезагрузке
   * окна: реальную проверку делает main по расписанию, а не каждая перерисовка.
   */
  getUpdateState: () => ipcRenderer.invoke('momentum:update-state'),
  /** Скачать обновление после согласия пользователя. */
  downloadUpdate: () => ipcRenderer.invoke('momentum:update-download'),
  /** Установить скачанное обновление и перезапустить приложение. */
  installUpdate: () => ipcRenderer.invoke('momentum:update-install'),
  /** Подписка на события обновления; возвращает функцию отписки. */
  onUpdateEvent: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('momentum:update-event', listener);
    return () => ipcRenderer.removeListener('momentum:update-event', listener);
  },
  /** Пункт меню «Проверить обновления» — попросить проверку из UI. */
  onUpdateCheckRequested: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('momentum:update-check-requested', listener);
    return () => ipcRenderer.removeListener('momentum:update-check-requested', listener);
  },
});
