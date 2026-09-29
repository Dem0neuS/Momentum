#!/usr/bin/env node
/**
 * Проверка манифеста собранного приложения.
 *
 * Запуск: node scripts/verify-manifest.mjs /Momentum/
 *
 * Ошибка в префиксе пути не роняет сборку — она просто делает приложение
 * нерабочим: манифест лежит не там, иконки не находятся, браузер не
 * предлагает установку, service worker отдаёт 404. Проверка ловит это
 * до публикации.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const base = (process.argv[2] ?? '/').replace(/\/*$/, '/');

const problems = [];
const ok = [];

function check(name, condition, detail) {
  if (condition) ok.push(name);
  else problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

// Манифест лежит в корне dist, его имя vite-plugin-pwa не меняет.
const manifestPath = path.join(dist, 'manifest.webmanifest');
if (!fs.existsSync(manifestPath)) {
  console.error('Манифест не найден: dist/manifest.webmanifest. Сначала npm run build.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');

// 1. Точки входа обязаны лежать внутри префикса. Без ведущего слэша scope
//    невалиден, и браузер не предложит установку.
check('scope с ведущим слэшем', manifest.scope?.startsWith('/'), manifest.scope);
check('start_url с ведущим слэшем', manifest.start_url?.startsWith('/'), manifest.start_url);
check(`scope = ${base}`, manifest.scope === base, manifest.scope);
check(`start_url = ${base}`, manifest.start_url === base, manifest.start_url);
check(`id = ${base}`, manifest.id === base, manifest.id);

// 2. Иконки. Ни одна не должна быть вне префикса: иначе на Pages не найдётся
//    ни иконка приложения, ни иконка для «Добавить на главный экран».
const icons = manifest.icons ?? [];
check('иконки есть', icons.length > 0, `найдено: ${icons.length}`);
const outside = icons.filter((i) => !i.src?.startsWith(base));
check('все иконки внутри префикса', outside.length === 0, outside.map((i) => i.src).join(', '));

// Android рисует badge одним силуэтом: если цветная иконка попадёт в
// monochrome, на уведомлениях будет серый квадрат.
const monochrome = icons.filter((i) => i.purpose?.includes('monochrome'));
check('есть monochrome-иконка для badge', monochrome.length > 0);
check(
  'maskable-иконка на месте (маска Android не срежет знак)',
  icons.some((i) => i.purpose === 'maskable'),
);

// 3. Ярлыки из манифеста открывают нужный раздел. Проверяем префикс —
//    иначе ярлык на телефоне откроет 404.
const shortcuts = manifest.shortcuts ?? [];
const badShortcuts = shortcuts.filter((s) => !s.url?.startsWith(base));
check('все ярлыки внутри префикса', badShortcuts.length === 0, badShortcuts.map((s) => s.url).join(', '));

// 4. Страница. Абсолютный путь к манифесту или иконкам в Pages не найдётся.
check('index.html ссылается на манифест с префиксом', html.includes(`href="${base}manifest.webmanifest`));
check(
  'иконки в index.html с префиксом',
  html.includes(`href="${base}icons/favicon.svg`) && html.includes(`src="${base}assets/`),
);
check('скрипты собранного приложения с префиксом', !/"src"\s*:\s*"\/assets\//.test(html));

// 5. Service worker. Без префикса в navigateFallback любая навигация внутри
//    приложения отдаст 404: он будет искать index.html в корне домена.
check('navigateFallback внутри префикса', sw.includes(`${base}index.html`));

// 6. Jekyll на Pages выбрасывает каталоги и файлы, начинающиеся с
//    подчёркивания, и каталоги без файлов. Без .nojekyll он может вырезать
//    служебные файлы, нужные обновлению.
check('.nojekyll на месте (Jekyll не трогает вывод)', fs.existsSync(path.join(dist, '.nojekyll')));

for (const line of ok) console.log(`OK    ${line}`);
for (const line of problems) console.log(`FAIL  ${line}`);

if (problems.length) {
  console.error(`\nМанифест негоден для публикации: ${problems.length} проблем.`);
  process.exit(1);
}
console.log(`\nМанифест корректен для публикации по префиксу ${base} (${ok.length} проверок).`);
