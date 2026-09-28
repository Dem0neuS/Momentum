import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Регистрация Service Worker (автообновление PWA)
registerSW({ immediate: true });

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
        },
      }}
    />
  </React.StrictMode>,
);