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
          border: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          borderRadius: '14px',
          boxShadow: '0 12px 32px -8px rgba(15, 23, 42, 0.35)',
          fontSize: '14px',
        },
      }}
    />
  </React.StrictMode>,
);