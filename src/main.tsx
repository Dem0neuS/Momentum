import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';
// Регистрация Service Worker (автообновление PWA). Модуль регистрирует воркер
// при импорте и отдаёт функцию ручного обновления для настроек.
import '@/lib/pwaUpdate';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: {
          border: 'var(--border-card)',
          background: 'var(--surface)',
          color: 'var(--text)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-pop)',
          fontSize: 'var(--fs-caption)',
          // Ширина по содержимому, а не фиксированные 356 px sonner:
          // иначе тост с двумя кнопками сжимает текст до нечитаемой колонки.
          width: 'auto',
          maxWidth: 'min(480px, calc(100vw - 2rem))',
        },
      }}
    />
  </React.StrictMode>,
);