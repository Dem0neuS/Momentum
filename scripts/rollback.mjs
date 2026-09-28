/**
 * Откат неудачного релиза Momentum.
 *
 * Главное, что стоит понимать про откат десктопного приложения:
 * electron-updater сравнивает версии и НИКОГДА не предлагает downgrade.
 * Если пользователь уже стоит на сломанной 1.0.1, «вернуть ему 1.0.0»
 * технически невозможно. Поэтому откат устроен так же, как у Chrome,
 * VS Code и любого нормального приложения — вперёд по номеру:
 *
 *   1. отменяем код сломанного релиза (git revert, без переписывания истории),
 *   2. поднимаем версию выше текущей,
 *   3. публикуем — обновлятор предложит её всем, включая «сломанных».
 *
 * Репозиторий публичный, поэтому история не переписывается: только revert.
 * Ничего не коммитится без явного --yes.
 *
 * Запуск:
 *   node scripts/rollback.mjs status
 *   node scripts/rollback.mjs plan  --to 1.0.0
 *   node scripts/rollback.mjs run   --to 1.0.0 --yes
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgFile = path.join(root, 'package.json');

/** Вывод git/gh в stdout, при ошибке — null. */
function run(command, args, { allowFail = false } = {}) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFail) return null;
    throw error;
  }
}

const git = (args, options) => run('git', args, options);

function readVersion() {
  return JSON.parse(readFileSync(pkgFile, 'utf8')).version;
}

/** Разбор и сравнение версий вида 1.2.3 — сознательно без зависимостей. */
function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(value).trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

/** Следующая версия выше текущей: сперва patch, при занятоте — minor, затем major. */
function nextVersion(current) {
  const v = parseVersion(current);
  if (!v) throw new Error(`Не понимаю версию «${current}» — нужен вид 1.2.3`);
  return { major: v.major, minor: v.minor, patch: v.patch + 1 };
}

/** Поднимает версию, пока она не станет строго больше всех уже занятых. */
function nextFreeVersion(current, taken) {
  const floor = taken.reduce((max, value) => {
    const v = parseVersion(value);
    return v && (!max || v.major > max.major || (v.major === max.major && (v.minor > max.minor || (v.minor === max.minor && v.patch > max.patch))))
      ? v
      : max;
  }, null);

  let candidate = nextVersion(current);
  const isGreater = (a) => {
    if (!floor) return true;
    if (a.major !== floor.major) return a.major > floor.major;
    if (a.minor !== floor.minor) return a.minor > floor.minor;
    return a.patch > floor.patch;
  };
  while (!isGreater(candidate)) candidate = nextVersion(formatVersion(candidate));
  return formatVersion(candidate);
}

/**
 * Ищем gh: сначала в PATH, потом в стандартных папках установки —
 * после установки из winget текущий сеанс терминала часто ещё не знает про него.
 */
function findGh() {
  if (run('gh', ['--version'], { allowFail: true }) !== null) return 'gh';
  const candidates = [
    'C:\\Program Files\\GitHub CLI\\gh.exe',
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'GitHub CLI', 'gh.exe'),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? 'gh';
}

/** Опубликованные релизы: [{ version, tag, name, publishedAt }]. */
function listReleases() {
  const raw = run(findGh(), ['release', 'list', '--limit', '30', '--json', 'tagName,name,isDraft,isPrerelease,publishedAt'], { allowFail: true });
  if (raw === null) return null; // gh не установлен или не авторизован
  return JSON.parse(raw)
    .filter((item) => !item.isDraft)
    .map((item) => ({
      tag: item.tagName,
      version: item.tagName.replace(/^v/, ''),
      name: item.name ?? '',
      prerelease: item.isPrerelease,
      publishedAt: item.publishedAt,
    }))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

function parseArgs(argv) {
  const args = { command: argv[0], to: null, yes: false, dryRun: false };
  for (let i = 1; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--to') args.to = argv[++i];
    else if (value === '--yes' || value === '-y') args.yes = true;
    else if (value === '--dry-run') args.dryRun = true;
    else throw new Error(`Неизвестный аргумент «${value}»`);
  }
  return args;
}

function status() {
  const current = readVersion();
  const releases = listReleases();
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
  const dirty = git(['status', '--porcelain'], { allowFail: true });

  console.log('Состояние Momentum\n');
  console.log(`  версия в package.json   ${current}`);
  console.log(`  ветка                   ${branch ?? '—'}`);
  console.log(`  незакоммиченные правки  ${dirty ? dirty.split('\n').length : 0}`);

  if (releases === null) {
    console.log('\n  Релизы: не удалось прочитать (нужен gh: gh auth login)');
    return;
  }
  if (releases.length === 0) {
    console.log('\n  Релизов пока нет — откатывать нечего.');
    return;
  }
  console.log('\nОпубликованные релизы (свежие сверху):');
  for (const release of releases.slice(0, 8)) {
    const flags = [release.prerelease ? 'prerelease' : null].filter(Boolean).join(', ');
    console.log(`  ${release.version.padEnd(10)} ${release.publishedAt?.slice(0, 10) ?? ''}  ${flags}`);
  }
  const latest = releases[0];
  if (parseVersion(latest.version) && parseVersion(current)) {
    const delta = parseVersion(current).patch !== parseVersion(latest.version).patch;
    if (delta) console.log(`\n  Внимание: в репозитории ${current}, а последний релиз — ${latest.version}. Публикация не создаст новую версию для пользователей.`);
  }
}

function plan(target) {
  const current = readVersion();
  const releases = listReleases();
  const published = (releases ?? []).map((r) => r.version);

  // Цель отката: конкретная версия, её тег, либо любой git-реф.
  const ref = target || published.find((v) => parseVersion(v) && formatVersion(parseVersion(v)).patch < parseVersion(current)?.patch);
  if (!ref) throw new Error('Не указана цель: --to <версия|тег|коммит>');
  if (target && !parseVersion(target) && git(['rev-parse', '--verify', `${target}^{commit}`], { allowFail: true }) === null) {
    throw new Error(`Не нашёл ни версию «${target}», ни такой git-реф`);
  }

  const base = git(['rev-parse', '--verify', `${ref}^{commit}`], { allowFail: true });
  if (base === null) throw new Error(`Цель отката «${ref}» не найдена в истории`);
  const head = git(['rev-parse', 'HEAD'], { allowFail: true });
  if (base === head) throw new Error('Откатываться не на что: цель совпадает с HEAD');

  const commits = git(['log', '--format=%h %s', `${base}..HEAD`], { allowFail: true }) ?? '';
  const touched = git(['log', '--format=%h', `${base}..HEAD`], { allowFail: true })?.split('\n').filter(Boolean) ?? [];
  const next = nextFreeVersion(current, [...published, current]);

  console.log('План отката\n');
  console.log(`  сейчас            ${current}`);
  console.log(`  откатываем к      ${ref} (${base.slice(0, 7)})`);
  console.log(`  новая версия      ${next}   ← обязательно выше ${current}`);
  console.log(`  отменяем коммитов ${touched.length}\n`);
  if (commits) console.log(commits.split('\n').map((line) => `    ${line}`).join('\n'));
  console.log('\nelectron-updater не умеет понижать версию: откат уйдёт к пользователям');
  console.log(`новым релизом ${next}, а не «назад» на ${ref}. Плохой релиз стоит отозвать.`);
  return { ref, base, next, touched };
}

function run_rollback(args) {
  const result = plan(args.to);
  if (args.dryRun) {
    console.log('\n--dry-run: изменения не вносились.');
    return;
  }
  if (!args.yes) {
    console.log('\nНичего не сделано. Повторите с --yes, чтобы применить.');
    return;
  }

  const dirty = git(['status', '--porcelain'], { allowFail: true });
  if (dirty) {
    console.error('\nЕсть незакоммиченные правки — сначала закоммитьте или уберите их.');
    process.exitCode = 1;
    return;
  }

  // Отменяем всё, что попало в сломанный релиз. История не переписывается.
  const revert = git(['revert', '--no-commit', `${result.base}..HEAD`], { allowFail: true });
  if (revert === null) {
    console.error('\nНе удалось применить revert. Проверьте конфликты: git status');
    process.exitCode = 1;
    return;
  }

  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  const previous = pkg.version;
  pkg.version = result.next;
  writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  git(['add', '-A']);
  git(['commit', '-m', `Откат к состоянию релиза ${args.to ?? result.ref}: версия ${previous} → ${result.next}`]);

  console.log(`\nГотово. Версия ${previous} → ${result.next}, изменения откачены к ${result.ref}.`);
  console.log('\nДальше по порядку:');
  console.log(`  1. Отзовите плохой релиз:  gh release delete <тег> --yes`);
  console.log(`  2. Отправьте коммит:      git push`);
  console.log(`  3. Опубликуйте через вкладку Actions (флажок publish)`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case 'status':
      status();
      break;
    case 'plan':
      plan(args.to);
      break;
    case 'run':
      run_rollback(args);
      break;
    default:
      console.log(`Откат неудачного релиза Momentum

  node scripts/rollback.mjs status
  node scripts/rollback.mjs plan  --to 1.0.0
  node scripts/rollback.mjs run   --to 1.0.0 --yes

electron-updater не поддерживает понижение версии, поэтому откат
выпускается новым номером с отменённым кодом.`);
  }
}

main();
