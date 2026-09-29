import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Базовый путь сборки.
 *
 * По умолчанию '/': десктопная версия раздаётся встроенным сервером
 * electron с корня, и там другой префикс быть не может. Веб-публикация
 * на GitHub Pages лежит в подкаталоге (…/Momentum/), поэтому при публикации
 * MOMENTUM_BASE переопределяется на '/Momentum/'.
 *
 * От пути зависят и манифест, и scope service worker'а: если scope шире базы,
 * браузер не предложит установку, а иконки и шрифты перестанут грузиться.
 */
const base = process.env.MOMENTUM_BASE || '/';

/** Хост Supabase для connect-src: из полного URL берём только происхождение. */
const supabaseOrigin = (() => {
  const url = process.env.VITE_SUPABASE_URL;
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
})();

const manifest: Partial<ManifestOptions> = {
  id: base,
  name: 'Momentum',
  short_name: 'Momentum',
  description: 'Твой день. Твой ритм. Твой прогресс. Привычки, тренировки, таблицы и план 3-2-1.',
  theme_color: '#0A0C12',
  background_color: '#0A0C12',
  display: 'standalone',
  display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
  orientation: 'portrait',
  start_url: base,
  scope: base,
  lang: 'ru',
  dir: 'ltr',
  categories: ['productivity', 'lifestyle', 'health'],
  prefer_related_applications: false,
  icons: [
    { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    // Однотонный силуэт: Chrome рисует им тематическую панель, а Android —
    // badge уведомлений. Цветную иконку туда скармливать нельзя: выйдет
    // серый квадрат.
    { src: `${base}icons/badge-512.png`, sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
  ],
  shortcuts: [
    {
      name: 'Привычки',
      short_name: 'Привычки',
      description: 'Отметить привычки на сегодня',
      url: `${base}?section=habits`,
      icons: [{ src: `${base}icons/icon-192.png`, sizes: '192x192' }],
    },
    {
      name: 'Тренировки',
      short_name: 'Тренировки',
      description: 'Открыть тренировки',
      url: `${base}?section=workouts`,
      icons: [{ src: `${base}icons/icon-192.png`, sizes: '192x192' }],
    },
    {
      name: 'План на завтра',
      short_name: 'План',
      description: 'Составить план на завтра',
      url: `${base}?section=dayplan`,
      icons: [{ src: `${base}icons/icon-192.png`, sizes: '192x192' }],
    },
  ],
};

// Политика безопасности для собранного приложения. В dev её не добавляем:
// HMR требует websocket-соединений, которые жёсткий connect-src 'self' не всегда пропускает.
const CSP_META = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  // Кабинет и синхронизация ходят в Supabase, поэтому его адрес должен быть
  // разрешён. Ключ подставляется на сборку: без VITE_SUPABASE_URL в политике
  // остаётся только 'self' — то есть ровно то, что нужно локальной версии.
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

/**
 * Пустой файл `.nojekyll` в dist.
 *
 * GitHub Pages по умолчанию прогоняет вывод через Jekyll, который выбрасывает
 * всё, начинающееся с подчёркивания, и каталоги без файлов. Служебные файлы
 * service worker'а к таким не относятся, но сам факт обработки Jekyll ломает
 * пути вида /sw.js при обновлении приложения. Файл отключает обработку.
 */
function nojekyll(): Plugin {
  return {
    name: 'momentum:nojekyll',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
    },
  };
}

/**
 * Подстановки для страницы загрузки.
 *
 * Адрес приложения известен только после публикации (это корень сайта или
 * подкаталог на Pages), а релиз появляется позже сборки. Поэтому оба значения
 * приходят из окружения, а в HTML стоят заглушки.
 */
function downloadPage(): Plugin {
  // По умолчанию относительный адрес: он верен в любой сборке, потому что
  // страница загрузки лежит рядом с приложением. В публикации подставляется
  // абсолютный — его удобнее набрать руками с телефона.
  const appUrl = process.env.MOMENTUM_APP_URL || './';
  const releaseUrl =
    process.env.MOMENTUM_RELEASE_URL || 'https://github.com/Dem0neuS/Momentum/releases';
  return {
    name: 'momentum:download-page',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      if (!ctx.filename.endsWith('download.html')) return html;
      return html
        .replaceAll('%APP_URL%', appUrl)
        .replaceAll('%RELEASE_URL%', releaseUrl);
    },
  };
}

/** Вставляет CSP в собранный index.html (в Electron-обёртке это второй слой). */
function cspMeta(): Plugin {
  return {
    name: 'momentum:csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP_META },
          injectTo: 'head-prepend' as const,
        },
      ];
    },
  };
}

export default defineConfig({
  // Vite переписывает под этот префикс пути в собранном HTML и в регистрации
  // service worker'а. Для десктопной версии остаётся '/'.
  base,
  plugins: [
    react(),
    cspMeta(),
    nojekyll(),
    downloadPage(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/apple-touch-icon.png',
        'icons/favicon.svg',
        'icons/favicon-32.png',
        'icons/icon-light-512.png',
        'icons/momentum-logo.svg',
        'icons/momentum-logo-light.svg',
        'icons/momentum-logo-mono.svg',
        'icons/momentum-logo-maskable.svg',
        // QR на странице загрузки: без него в precache страница офлайн не
        // покажет, как открыть приложение на телефоне.
        'icons/qr-install.svg',
      ],
      manifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Префикс базы обязателен: без него service worker на Pages искал бы
        // /index.html в корне домена и отдавал бы первую страницу чужого сайта
        // (или 404). Денилист не нужен — fallback применяется только к
        // навигациям, а не к запросам файлов.
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      // Страница загрузки — второй вход. Без неё Vite считает единственной
      // точкой входа index.html, и download.html в dist просто не появится.
      input: {
        main: path.resolve(__dirname, 'index.html'),
        download: path.resolve(__dirname, 'download.html'),
      },
      output: {
        // Вендорный код выносим в отдельные чанки: он меняется реже кода приложения,
        // поэтому кэш PWA не сбрасывается при каждой правке интерфейса.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          const pkg = /node_modules[\\/](@[^\\/]+[\\/])?[^\\/]+/.exec(id)?.[0] ?? '';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (pkg.includes('framer-motion') || pkg.includes('motion-dom') || pkg.includes('motion-utils')) return 'vendor-motion';
          if (pkg.includes('@dnd-kit')) return 'vendor-dnd';
          if (pkg.includes('recharts') || pkg.includes('victory-vendor') || pkg.includes('d3-')) return 'vendor-charts';
          if (pkg.includes('hyperformula')) return 'vendor-formula';
          if (pkg.includes('@tanstack')) return 'vendor-table';
          if (pkg.includes('dexie') || pkg.includes('zustand') || pkg.includes('use-sync-external-store')) return 'vendor-data';
          if (pkg.includes('lucide-react')) return 'vendor-icons';
          if (pkg.includes('date-fns') || pkg.includes('sonner') || pkg.includes('class-variance-authority')) return 'vendor-utils';
          return 'vendor';
        },
        onlyExplicitManualChunks: true,
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});