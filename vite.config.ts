import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';
import path from 'node:path';

const manifest: Partial<ManifestOptions> = {
  id: '/',
  name: 'Momentum',
  short_name: 'Momentum',
  description: 'Твой день. Твой ритм. Твой прогресс. Привычки, тренировки, таблицы и план 3-2-1.',
  theme_color: '#0A0C12',
  background_color: '#0A0C12',
  display: 'standalone',
  display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
  orientation: 'portrait',
  start_url: '/',
  scope: '/',
  lang: 'ru',
  dir: 'ltr',
  categories: ['productivity', 'lifestyle', 'health'],
  prefer_related_applications: false,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    // Однотонный силуэт: Chrome рисует им тематическую панель, а Android —
    // badge уведомлений. Цветную иконку туда скармливать нельзя: выйдет
    // серый квадрат.
    { src: '/icons/badge-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
  ],
  shortcuts: [
    {
      name: 'Привычки',
      short_name: 'Привычки',
      description: 'Отметить привычки на сегодня',
      url: '/?section=habits',
      icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
    },
    {
      name: 'Тренировки',
      short_name: 'Тренировки',
      description: 'Открыть тренировки',
      url: '/?section=workouts',
      icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
    },
    {
      name: 'План на завтра',
      short_name: 'План',
      description: 'Составить план на завтра',
      url: '/?section=dayplan',
      icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
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
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

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
  plugins: [
    react(),
    cspMeta(),
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
      ],
      manifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
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