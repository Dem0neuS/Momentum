'use strict';

/**
 * Единая CSP для десктопной обёртки.
 *
 * Vite кладёт правильную политику (с адресом Supabase в connect-src) в meta
 * собранного index.html. Electron отдаёт тот же файл, но дополнительно ставил
 * CSP ещё и заголовком — а заголовок и meta складываются, и более строгий
 * `connect-src 'self'` из заголовка блокировал вход и синхронизацию в .exe.
 * Поэтому заголовок берём из собранной страницы, а не дублируем константу.
 */

const fs = require('node:fs');
const path = require('node:path');

/** Запасная политика для dev-режима, где meta от Vite ещё не добавлен. */
const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  'form-action \'none\'',
  'frame-ancestors \'none\'',
].join('; ');

/** Достаёт Content-Security-Policy из meta уже собранного index.html. */
function cspFromHtml(html) {
  // Значение content может содержать оба вида кавычек ('self'), поэтому
  // берём его до той же кавычки, которой оно открылось, а не до первой любой.
  const match = /<meta\s+http-equiv=(["'])Content-Security-Policy\1\s+content=(["'])(.*?)\2\s*\/?>/i.exec(html);
  return match ? match[3] : '';
}

/** Origin Supabase из окружения — нужен только в dev, где meta ещё нет. */
function envOrigin(env = process.env) {
  const url = env.VITE_SUPABASE_URL;
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function fallbackCsp(env = process.env) {
  const origin = envOrigin(env);
  return DEFAULT_CSP.replace(
    "connect-src 'self'",
    `connect-src 'self'${origin ? ` ${origin}` : ''}`,
  );
}

/**
 * CSP для ответов встроенного сервера: из dist/index.html, иначе запасная.
 * Ошибки чтения не роняют приложение — в dev страница отдаётся Vite.
 */
function readCsp(distDir, env = process.env) {
  try {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    return cspFromHtml(html) || fallbackCsp(env);
  } catch {
    return fallbackCsp(env);
  }
}

module.exports = { DEFAULT_CSP, cspFromHtml, fallbackCsp, readCsp };
