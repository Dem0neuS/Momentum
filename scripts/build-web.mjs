#!/usr/bin/env node
/**
 * Сборка веб-версии для публикации.
 *
 * Запуск: npm run build:web
 *
 * Отдельный скрипт, а не флаги в package.json, потому что значения
 * подставляются из имени репозитория: префикс на GitHub Pages равен пути
 * проекта, и он меняется вместе с репозиторием. Держать `/Momentum/` в трёх
 * местах (скрипт, workflow, документация) — значит гарантированно забыть
 * про одно из них и опубликовать нерабочую страницу.
 *
 * Что подставляется:
 *   MOMENTUM_BASE        префикс сайта: /<имя репозитория>/
 *   MOMENTUM_APP_URL     адрес, который открывает кнопка на странице загрузки
 *   MOMENTUM_RELEASE_URL страница релиза, куда ведут кнопки для Windows
 *
 * Значения можно переопределить из окружения — CI делает ровно это.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// Имя репозитория: из package.json, если это git-репозиторий, иначе из
// переменной окружения. В CI имя известно точно.
function repoName() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY.split('/')[1];
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: root,
    encoding: 'utf8',
  });
  const match = /[:/]([^/:]+?)(?:\.git)?\s*$/m.exec(remote.stdout?.trim() ?? '');
  return match?.[1] ?? 'Momentum';
}

const repo = repoName();
const owner = process.env.GITHUB_REPOSITORY?.split('/')[0] ?? 'Dem0neuS';
const base = `/${repo}/`;

// Имя пользователя в адресе GitHub Pages нечувствительно к регистру, но
// в QR-коде и в подписи лучше написать ровно как в репозитории.
const site = `https://${owner.toLowerCase()}.github.io/${repo}/`;

const env = {
  ...process.env,
  MOMENTUM_BASE: process.env.MOMENTUM_BASE ?? base,
  MOMENTUM_APP_URL: process.env.MOMENTUM_APP_URL ?? site,
  // releases/latest переживает следующие релизы: страницу не придётся
  // пересобирать ради нового номера версии. Ссылку на конкретный тег можно
  // задать через MOMENTUM_RELEASE_URL.
  MOMENTUM_RELEASE_URL: process.env.MOMENTUM_RELEASE_URL ?? `https://github.com/${owner}/${repo}/releases/latest`,
};

console.log(`Публикация: префикс ${env.MOMENTUM_BASE}`);
console.log(`Адрес приложения: ${env.MOMENTUM_APP_URL}`);

/**
 * Команда запуска npm.
 *
 * На Windows npm — это npm.cmd, а Node с версии 20.12 не запускает .cmd и .bat
 * без shell: попытка даёт ENOENT и молчаливый ненулевой код выхода. Поэтому
 * на Windows вызываем cli.js напрямую через текущий интерпретатор. Через
 * shell не идём — Node предупреждает, что аргументы при этом не экранируются.
 */
function npmRun(args) {
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const useCli = process.platform === 'win32' && fs.existsSync(npmCli);
  const cmd = useCli ? process.execPath : 'npm';
  const argv = useCli ? [npmCli, ...args] : args;
  const run = spawnSync(cmd, argv, { cwd: root, stdio: 'inherit', env });
  if (run.error) {
    console.error(`Не удалось запустить npm: ${run.error.message}`);
    process.exit(1);
  }
  return run.status ?? 1;
}

const status = npmRun(['run', 'build']);
if (status !== 0) process.exit(status);

// Проверка результата обязательна: сборка с неверным префиксом успешна,
// но страница откроется пустой. Ловим это здесь, а не у пользователя.
const verify = spawnSync(process.execPath, ['scripts/verify-manifest.mjs', env.MOMENTUM_BASE], {
  cwd: root,
  stdio: 'inherit',
  env,
});

if (verify.status !== 0) {
  console.error('\nСборка прошла, но манифест негоден — публиковать нельзя.');
  process.exit(verify.status ?? 1);
}
