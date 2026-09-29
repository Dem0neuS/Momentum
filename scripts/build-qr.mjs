#!/usr/bin/env node
/**
 * QR-код со ссылкой на приложение — для установки на телефон.
 *
 * Запуск: node scripts/build-qr.mjs https://dem0neuS.github.io/Momentum/
 *
 * Пишет public/icons/qr-install.svg. Почему SVG, а не PNG: файл остаётся
 * текстом, его видно в git diff и он не размывается на Retina-экране
 * телефона, который этот код и сканирует.
 *
 * Код нужен на странице загрузки: ввести адрес с клавиатуры телефона
 * неудобно, а навести камеру на монитор — секундное дело.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'icons', 'qr-install.svg');

const url = process.argv[2];
if (!url) {
  console.error('Укажите адрес: node scripts/build-qr.mjs https://example.com/');
  process.exit(1);
}

if (!/^https?:\/\//.test(url)) {
  console.error(`Адрес должен начинаться с http(s)://, получено: ${url}`);
  process.exit(1);
}

// Маркер по краю: без него телефон не даст отсканировать код из экрана.
// 4 — стандартная тихая зона QR, этого достаточно.
const svg = await QRCode.toString(url, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 4,
  color: {
    dark: '#0A0C12',
    light: '#F5F6FA',
  },
});

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg, 'utf8');

const size = fs.statSync(out).size;
console.log(`QR-код записан: ${path.relative(root, out)} (${size} байт) — ${url}`);
