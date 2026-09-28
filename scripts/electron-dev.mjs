/**
 * Запуск Electron в режиме разработки: поднимает Vite программно
 * (без отдельного процесса) и открывает окно на http://127.0.0.1:<port>.
 *
 * Запуск: node scripts/electron-dev.mjs
 */
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  server: { port: 5173, strictPort: false },
  // В dev не нужен service worker: он кэшировал бы модули и мешал HMR.
  plugins: [],
});
await server.listen();
const { port } = server.httpServer.address();
const url = `http://127.0.0.1:${port}/`;
console.log(`[electron-dev] Vite: ${url}`);

const electron = require('electron');
const child = spawn(electron, [root], {
  stdio: 'inherit',
  env: { ...process.env, MOMENTUM_DEV: '1', MOMENTUM_DEV_URL: url, ELECTRON_ENABLE_LOGGING: '1' },
});

child.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
