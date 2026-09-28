'use strict';

/**
 * Momentum · десктопная обёртка (Electron).
 *
 * Приложение живёт в обычном окне без адресной строки, а данные — в
 * userData (IndexedDB через Dexie), то есть переживают перезапуск.
 *
 * Статика отдаётся встроенным HTTP-сервером на 127.0.0.1, а не через
 * file:// — иначе не работают Service Worker, кэш PWA и ES-модули.
 */

const { app, BrowserWindow, Menu, shell, dialog, session, nativeTheme, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const isDev = process.env.MOMENTUM_DEV === '1';
const DEV_URL = process.env.MOMENTUM_DEV_URL || 'http://127.0.0.1:5173/';
const DIST = path.join(__dirname, '..', 'dist');
// nativeImage понимает PNG (ICO electron не декодирует), иконку exe
// electron-builder собирает сам из этого же файла.
const ICON = path.join(DIST, 'icons', 'icon-512.png');

// Шрифты грузятся с Google Fonts, скрипты и стили — только свои.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** Защита от выхода за пределы dist при раздаче файлов. */
function resolveAsset(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const target = path.normalize(path.join(DIST, clean));
  if (!target.startsWith(DIST)) return null;
  return target;
}

async function statFile(file) {
  try {
    const s = await fsp.stat(file);
    return s.isFile() ? s : null;
  } catch {
    return null;
  }
}

function startServer() {
  // Порт по умолчанию случайный, но его можно зафиксировать — так проще
  // проверять сборку и подключать внешние инструменты.
  const port = Number(process.env.MOMENTUM_PORT) || 0;
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url) {
        res.writeHead(400).end();
        return;
      }
      const requested = resolveAsset(req.url);
      if (!requested) {
        res.writeHead(403).end();
        return;
      }
      let file = requested;
      let stats = await statFile(file);
      if (!stats) {
        // SPA-роутинг: любые неизвестные пути отдают index.html
        file = path.join(DIST, 'index.html');
        stats = await statFile(file);
        if (!stats) {
          res.writeHead(404).end('Сборка не найдена. Выполните npm run build.');
          return;
        }
      }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache', ...SECURITY_HEADERS };
      // Service Worker должен иметь корень на /
      if (path.basename(file) === 'sw.js') headers['Service-Worker-Allowed'] = '/';
      res.writeHead(200, headers);
      fs.createReadStream(file).pipe(res);
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/* --- Сохранение размера и позиции окна ---------------------------------- */

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(win) {
  try {
    if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    const bounds = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }));
  } catch {
    /* состояние окна — необязательно */
  }
}

/* --- Окно ---------------------------------------------------------------- */

let mainWindow = null;
let server = null;
let appUrl = '';

function createWindow() {
  const state = readState();
  mainWindow = new BrowserWindow({
    width: state.width ?? 1180,
    height: state.height ?? 820,
    x: state.x,
    y: state.y,
    minWidth: 420,
    minHeight: 560,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0A0C12' : '#F5F6FA',
    icon: fs.existsSync(ICON) ? ICON : undefined,
    title: 'Momentum',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // В песочнице preload не видит app, поэтому версию передаём аргументом.
      additionalArguments: [`--momentum-version=${app.getVersion()}`],
    },
  });

  if (state.maximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const persist = () => writeState(mainWindow);
  mainWindow.on('close', persist);
  mainWindow.on('resize', persist);
  mainWindow.on('move', persist);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Внешние ссылки открываем в системном браузере, а не внутри окна.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });

  void mainWindow.loadURL(appUrl);
}

/* --- Меню ---------------------------------------------------------------- */

function buildMenu() {
  const isMac = process.platform === 'darwin';
  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: 'Momentum',
            submenu: [
              { role: 'about', label: 'О программе' },
              { type: 'separator' },
              { role: 'hide', label: 'Скрыть Momentum' },
              { role: 'hideOthers', label: 'Скрыть остальные' },
              { type: 'separator' },
              { role: 'quit', label: 'Выход' },
            ],
          },
        ]
      : []),
    {
      label: 'Приложение',
      submenu: [
        {
          label: 'О программе',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе',
              message: 'Momentum',
              detail: `Версия ${app.getVersion()}\nПривычки, тренировки, таблицы и план 3-2-1.\n\nДанные хранятся локально на этом компьютере.`,
              buttons: ['Закрыть'],
            }),
        },
        { type: 'separator' },
        {
          label: 'Проверить обновления',
          click: () => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            mainWindow.webContents.send('momentum:update-check-requested');
          },
        },
        { type: 'separator' },
        {
          label: 'Папка данных',
          click: () => void shell.openPath(app.getPath('userData')),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { role: 'forceReload', label: 'Обновить без кэша' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Масштаб 100%' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
      ],
    },
    {
      label: 'Окно',
      submenu: [
        { role: 'minimize', label: 'Свернуть' },
        { role: 'zoom', label: 'Развернуть' },
        { type: 'separator' },
        { role: 'close', label: 'Закрыть' },
      ],
    },
    {
      label: 'Помощь',
      submenu: [
        {
          label: 'Горячие клавиши',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Горячие клавиши',
              message: 'Основные сочетания',
              detail:
                'Ctrl/⌘ + Z — отменить последнее действие\n' +
                'Ctrl/⌘ + R — обновить приложение\n' +
                'Ctrl/⌘ + Shift + I — инструменты разработчика\n' +
                'F11 — полный экран\n' +
                'Alt — показать меню',
              buttons: ['Закрыть'],
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* --- Жизненный цикл ------------------------------------------------------ */

app.whenReady().then(async () => {
  if (isDev) {
    appUrl = DEV_URL;
  } else {
    server = await startServer();
    const { port } = server.address();
    appUrl = `http://127.0.0.1:${port}/`;
  }
  console.log(`[momentum] ${appUrl}`);

  // Разрешаем Service Worker и precache в рамках локального origin.
  if (!isDev) {
    session.defaultSession.setUserAgent(
      `${session.defaultSession.getUserAgent()} Momentum/${app.getVersion()}`,
    );
  }

  buildMenu();
  createWindow();

  // Тихо спрашиваем про обновление через несколько секунд после старта.
  // Скачивание при этом не начинается — только по кнопке пользователя.
  if (!isDev) {
    setTimeout(() => {
      const updater = getAutoUpdater();
      if (updater) void updater.checkForUpdates().catch(() => {});
    }, 8000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* --- Мост из preload ----------------------------------------------------- */

ipcMain.on('momentum:open-external', (_event, url) => {
  if (typeof url === 'string' && /^https?:/i.test(url)) void shell.openExternal(url);
});

ipcMain.on('momentum:full-screen', (_event, value) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setFullScreen(Boolean(value));
});

/* --- Автообновление -------------------------------------------------------
 *
 * electron-updater умеет проверять GitHub Releases и ставить NSIS-обновление
 * поверх текущей версии. Ничего не скачивается само: пользователь видит
 * предложение в настройках и нажимает кнопку сам.
 */

let autoUpdater;
/** null — ещё не брали, false — недоступно (dev-режим или нет electron-updater). */
let updaterError = null;

function sendUpdateEvent(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('momentum:update-event', payload);
}

function getAutoUpdater() {
  if (autoUpdater !== undefined) return autoUpdater;
  if (!app.isPackaged) {
    autoUpdater = false;
    return false;
  }
  try {
    const { autoUpdater: updater } = require('electron-updater');
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.logger = null;
    updater.on('error', (error) => {
      updaterError = error?.message ?? String(error);
      sendUpdateEvent({ phase: 'error', message: updaterError });
    });
    updater.on('update-available', (info) => {
      sendUpdateEvent({ phase: 'available', version: info?.version ?? null });
    });
    updater.on('update-not-available', () => sendUpdateEvent({ phase: 'up-to-date' }));
    updater.on('download-progress', (progress) => {
      sendUpdateEvent({
        phase: 'downloading',
        percent: Number(progress?.percent ?? 0),
        transferred: Number(progress?.transferred ?? 0),
        total: Number(progress?.total ?? 0),
      });
    });
    updater.on('update-downloaded', (info) => {
      sendUpdateEvent({ phase: 'downloaded', version: info?.version ?? null });
    });
    autoUpdater = updater;
  } catch (error) {
    updaterError = error?.message ?? String(error);
    autoUpdater = false;
  }
  return autoUpdater;
}

ipcMain.handle('momentum:update-check', async () => {
  const updater = getAutoUpdater();
  if (!updater) {
    return { available: false, supported: false, message: updaterError ?? 'Обновление доступно только в установленной версии' };
  }
  try {
    const result = await updater.checkForUpdates();
    const version = result?.updateInfo?.version ?? null;
    return {
      available: Boolean(result && !result.updateInfo?.version?.includes(app.getVersion())),
      supported: true,
      version,
      currentVersion: app.getVersion(),
    };
  } catch (error) {
    return { available: false, supported: true, message: error?.message ?? String(error) };
  }
});

ipcMain.handle('momentum:update-download', async () => {
  const updater = getAutoUpdater();
  if (!updater) return { ok: false, message: 'Обновление недоступно' };
  try {
    await updater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error?.message ?? String(error) };
  }
});

ipcMain.handle('momentum:update-install', () => {
  const updater = getAutoUpdater();
  if (!updater) return { ok: false };
  // Данные лежат в userData и переживают замену файлов программы.
  setImmediate(() => updater.quitAndInstall(false, true));
  return { ok: true };
});

app.on('before-quit', () => {
  if (mainWindow) writeState(mainWindow);
  server?.close();
});

// Второй экземпляр не нужен: переключаемся на уже открытое окно.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

void URL;
