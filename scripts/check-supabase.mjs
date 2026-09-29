#!/usr/bin/env node
/**
 * Проверка подключения к Supabase.
 *
 * Запуск: npm run supabase:check
 *
 * Проверяет, что проект настроен и отвечает, ничего не создавая в базе:
 * спрашивает публичный /auth/v1/settings. Для этого достаточно anon-ключа.
 * Создание тестового пользователя сознательно не делается — иначе каждый
 * запуск проверки оставлял бы мусор в реальном проекте.
 *
 * Ключи не печатаются: в вывод попадает только происхождение проекта.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');

let bad = 0;
const check = (name, ok, detail) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

/** Разбирает .env.local: KEY=VALUE, # — комментарий. */
function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

if (!fs.existsSync(envPath)) {
  console.error('.env.local не найден. Скопируйте .env.local.example в .env.local и заполните.');
  process.exit(1);
}

const env = readEnv(envPath);
const url = env.VITE_SUPABASE_URL || '';
const anon = env.VITE_SUPABASE_ANON_KEY || '';

check('VITE_SUPABASE_URL заполнен', Boolean(url), url ? 'происхождение: ' + new URL(url).origin : 'пусто');
check('VITE_SUPABASE_ANON_KEY заполнен', Boolean(anon), anon ? `длина ${anon.length}` : 'пусто');

if (!url || !anon) {
  console.error('\nЗаполните обе переменные и запустите проверку снова.');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error(`\nVITE_SUPABASE_URL не похож на адрес: ${url}`);
  process.exit(1);
}
check('адрес проекта в https и на supabase.co', parsed.protocol === 'https:' && /supabase\.(co|in)$/.test(parsed.hostname), parsed.hostname);

// Ключ не должен быть service_role: он обходит RLS и в бандле ему не место.
const looksSecret = /service_role|sb_secret/i.test(anon);
check('это anon-ключ, а не service_role', !looksSecret, looksSecret ? 'похоже на сервисный ключ — остановитесь' : '');

if (bad) process.exit(1);

console.log(`\nЗапрашиваю ${parsed.origin}/auth/v1/settings …`);
const res = await fetch(`${parsed.origin}/auth/v1/settings`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
});

if (!res.ok) {
  const body = await res.text().catch(() => '');
  check('проект отвечает', false, `HTTP ${res.status} — ${body.slice(0, 200)}`);
  console.error('\nЧаще всего это означает одно из трёх:');
  console.error('  1) проект ещё создаётся (подождите минуту);');
  console.error('  2) ключ скопирован из другой строки таблицы API Keys;');
  console.error('  3) в адрете опечатка — сверьте его с Project Settings → Data API.');
  process.exit(1);
}

const settings = await res.json();
check('проект отвечает', true, 'HTTP 200');
check('email-авторизация включена', settings.mailer_autoconfirm === false, `mailer_autoconfirm=${settings.mailer_autoconfirm}`);

console.log('\nЧто ещё нужно сделать в самом Supabase:');
console.log('  1) SQL Editor → выполнить supabase/schema.sql (создаёт таблицу и RLS);');
console.log('  2) Authentication → URL Configuration:');
console.log('       Site URL:   https://dem0neuS.github.io/Momentum/');
console.log('       Redirect URLs: https://dem0neuS.github.io/Momentum/**, http://localhost:5173/**');
console.log('  3) Authentication → SMTP: настроить Яндекс (пароль приложения вместо основного),');
console.log('     иначе писем для восстановления пароля не будет.');
console.log('\nКлючи можно и не выдавать: проверка читает их из .env.local сама.');
