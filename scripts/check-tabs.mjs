// Проверка переходов по вкладкам на ПЕРВОМ открытии приложения.
//
// Перехват ставится через Page.addScriptToEvaluateOnNewDocument — то есть ДО
// кода приложения. Иначе не поймать стартовый history.replaceState, который
// App делает в useEffect при маунте.
//
// Клики синтетические (.click()): их ловит обычный onClick React, и при этом
// не нужен живой браузер с окном. Кликаем все пять вкладок подряд и смотрим,
// что раздел доезжает и адрес совпадает.
//
// Запуск: node scripts/check-tabs.mjs [адрес]
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9225;
const APP = process.argv[2] ?? 'http://127.0.0.1:4180/';
const PROFILE = mkdtempSync(join(tmpdir(), 'momentum-tabs-'));

/** Любой браузер на Chromium: Яндекс, Chrome, Edge — им управляем по CDP. */
function findBrowser() {
  const fromEnv = process.env.MOMENTUM_BROWSER;
  const candidates = [
    fromEnv,
    'C:\\Program Files\\Yandex\\YandexBrowser\\Application\\browser.exe',
    'C:\\Program Files (x86)\\Yandex\\YandexBrowser\\Application\\browser.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    console.error('Не найден браузер для проверки. Укажите путь в MOMENTUM_BROWSER.');
    process.exit(1);
  }
  return found;
}

const child = spawn(
  findBrowser(),
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* браузер ещё поднимается */
    }
    await sleep(250);
  }
  throw new Error('CDP не поднялся');
}

const ws = new WebSocket(await targetWs());
await new Promise((r) => {
  ws.onopen = r;
});

let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

const tracer = String.raw`
(() => {
  const T0 = performance.now();
  const log = [];
  const at = () => Math.round(performance.now() - T0);
  const section = () => {
    const active = document.querySelector('[aria-current=page]');
    return active ? active.textContent.trim() : 'нет активного пункта';
  };
  const add = (what, extra) => log.push({ t: at(), what, search: location.search, active: section(), ...(extra || {}) });

  const origReplace = history.replaceState.bind(history);
  history.replaceState = function (a, b, url) {
    const before = location.search;
    const r = origReplace(a, b, url);
    log.push({ t: at(), what: 'replaceState', from: before, to: location.search, active: section() });
    return r;
  };
  const nav = window.navigation;
  if (nav) nav.addEventListener('navigate', (e) => {
    const dest = e.destination && e.destination.url;
    log.push({ t: at(), what: 'navigate', type: e.navigationType, dest: dest ? new URL(dest).search : null, locationSearch: location.search });
  });
  window.addEventListener('popstate', () => add('popstate'));

  window.__log = log;
  window.__done = false;

  // Клик по вкладке и ожидание, пока раздел доедет.
  window.__click = (label) => new Promise((resolve) => {
    const btn = [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim() === label);
    if (!btn) return resolve({ label, error: 'нет кнопки' });
    btn.click();
    setTimeout(() => resolve({
      label,
      search: location.search,
      active: section(),
      header: (document.querySelector('header h2') || {}).textContent || '',
    }), 900);
  });

  window.__run = async () => {
    const out = [];
    for (const label of ['Привычки', 'Тренировки', 'Таблицы', 'План на завтра', 'Дашборд']) {
      out.push(await window.__click(label));
    }
    window.__results = out;
    window.__done = true;
    return out;
  };

  setTimeout(() => { window.__run(); }, 4000);
})();
`;

await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: tracer });
await send('Page.navigate', { url: APP });
await sleep(11000);

const res = await send('Runtime.evaluate', {
  expression: 'JSON.stringify({ log: window.__log, results: window.__results, done: window.__done })',
  returnByValue: true,
});
const data = JSON.parse(res.result.value);

const expected = { 'Привычки': 'habits', 'Тренировки': 'workouts', 'Таблицы': 'sheets', 'План на завтра': 'dayplan', 'Дашборд': '' };
let fail = 0;
console.log('=== переходы по вкладкам ===');
for (const r of data.results ?? []) {
  const want = expected[r.label];
  const wantSearch = want ? `?section=${want}` : '';
  const ok = r.active === r.label && r.search === wantSearch;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'СБОЙ'} ${r.label}: активен «${r.active}», адрес «${r.search}» (ждали «${r.label}» / «${wantSearch}»)`);
}

const writes = data.log.filter((e) => e.what === 'replaceState');
const navs = data.log.filter((e) => e.what === 'navigate');
console.log(`\nreplaceState: ${writes.length}, navigate: ${navs.length}`);
console.log('последние записи адреса:');
for (const w of writes.slice(-6)) console.log(`  ${JSON.stringify(w)}`);

if (fail === 0 && writes.length <= 6) {
  console.log(`\nОК: все вкладки переключаются, лишних записей адреса нет (${writes.length} на 5 переходов).`);
} else {
  console.log(`\nПРОВАЛ: вкладок не так — ${fail}, записей адреса — ${writes.length}.`);
}

ws.close();
child.kill();
try {
  rmSync(PROFILE, { recursive: true, force: true });
} catch {
  /* профиль временный */
}
process.exit(fail ? 1 : 0);
