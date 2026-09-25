import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';
import path from 'node:path';

const manifest: Partial<ManifestOptions> = {
  name: 'Momentum',
  short_name: 'Momentum',
  description: 'Твой день. Твой ритм. Твой прогресс. Привычки, тренировки, таблицы и план 3-2-1.',
  theme_color: '#0F172A',
  background_color: '#0F172A',
  display: 'standalone',
  orientation: 'portrait',
  start_url: '/',
  scope: '/',
  lang: 'ru',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
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
  server: {
    port: 5173,
    host: true,
  },
});