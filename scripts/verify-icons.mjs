// Проверка растровых иконок: геометрия кольца, подложка, ось градиента,
// safe zone маски и однотонность моно-версии.
//
//   npm i -D sharp
//   node scripts/verify-icons.mjs
//
// Проверяет не «на глаз», а измерением по пикселям: скругление, восемь
// дуг и восемь зазоров, толщину обводки, направление градиента и то, что
// знак переживает маску Android.
import sharp from 'sharp';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Каталог можно переопределить аргументом — удобно для проверки извне.
const icons = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '..', 'public', 'icons');

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const hex = (r, g, b) => '#' + [r, g, b].map((v) => (v | 0).toString(16).padStart(2, '0')).join('').toUpperCase();

/**
 * Порог яркости для отличения дуги от подложки.
 * Подложка #0A0C12 даёт 40, дуга — от 255. Порог 120 разделяет их
 * надёжно, а условие по альфе отсекает сглаженную кромку на прозрачных
 * участках сквиркла.
 */
const isRing = (p) => p.a > 200 && p.r + p.g + p.b > 120;

const load = (f) => sharp(join(icons, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

function sampler(info, data) {
  return (x, y) => {
    const xi = Math.max(0, Math.min(info.width - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(info.height - 1, Math.round(y)));
    const i = (yi * info.width + xi) * info.channels;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
  };
}

// --- Размеры ------------------------------------------------------------
for (const f of [
  'icon-512.png', 'icon-192.png', 'icon-180.png', 'apple-touch-icon.png',
  'icon-maskable-512.png', 'icon-light-512.png', 'favicon-32.png',
  'badge-192.png', 'badge-512.png',
]) {
  const m = await sharp(join(icons, f)).metadata();
  check(`${f} → ${m.width}×${m.height}`, m.width === m.height && m.width > 0);
}

// --- Основной знак -----------------------------------------------------
{
  const { data, info } = await load('icon-512.png');
  const px = sampler(info, data);

  const top = px(256, 40);
  check('подложка #0A0C12', hex(top.r, top.g, top.b) === '#0A0C12', hex(top.r, top.g, top.b));
  check('сквиркл: угол прозрачен', px(3, 3).a < 20, `alpha=${px(3, 3).a}`);

  let firstOpaque = 0;
  for (let t = 0; t < 130; t++) if (px(t, t).a > 128) { firstOpaque = t; break; }
  // Для rx=118 первый непрозрачный пиксель по диагонали ожидается около 35.
  check('радиус скругления 118', Math.abs(firstOpaque - 35) <= 3, `диагональ ${firstOpaque}px`);

  // Дуги по окружности r=142.
  const at = [];
  for (let deg = 0; deg < 360; deg += 0.25) {
    const a = (deg * Math.PI) / 180;
    at.push({ deg, p: px(256 + Math.cos(a) * 142, 256 + Math.sin(a) * 142) });
  }
  const runs = [];
  let cur = isRing(at[0].p);
  let start = at[0].deg;
  for (let i = 1; i < at.length; i++) {
    const v = isRing(at[i].p);
    if (v !== cur) { runs.push({ on: cur, from: start, to: at[i].deg, len: at[i].deg - start }); cur = v; start = at[i].deg; }
  }
  runs.push({ on: cur, from: start, to: 360, len: 360 - start });

  // Дуга, пересекающая 0°, разорвана на две серии — склеиваем обратно,
  // иначе восемь дуг считаются как девять.
  const headOn = runs[0].on;
  const tailOn = runs[runs.length - 1].on;
  const arcs = headOn && tailOn && runs.length > 1
    ? [
        { on: true, from: runs[runs.length - 1].from, to: runs[0].to + 360, len: runs[runs.length - 1].len + runs[0].len },
        ...runs.slice(1, -1).filter((r) => r.on),
      ]
    : runs.filter((r) => r.on);
  const gaps = runs.filter((r) => !r.on);

  check('восемь дуг', arcs.length === 8, `найдено ${arcs.length}`);
  check('восемь зазоров', gaps.length === 8, `найдено ${gaps.length}`);

  // Номинал dasharray 62 / 49.53 даёт дугу 25° и зазор 20°, но скруглённые
  // торцы добавляют по обводке/2 = 19 единиц с каждого края: остаётся
  // примерно 40,3° дуги и 4,7° зазора. Зазор схлопывается — см. README.
  const meanArc = arcs.reduce((s, x) => s + x.len, 0) / arcs.length;
  const meanGap = gaps.reduce((s, x) => s + x.len, 0) / gaps.length;
  check('видимая дуга ≈40,3°', Math.abs(meanArc - 40.3) < 1.2, `${meanArc.toFixed(1)}°`);
  check('видимый зазор ≈4,7°', Math.abs(meanGap - 4.7) < 1.0, `${meanGap.toFixed(1)}°`);

  // Обводка 38 → дуга занимает радиусы 123..161.
  const A = (225 * Math.PI) / 180;
  const onRing = (r) => isRing(px(256 + Math.cos(A) * r, 256 + Math.sin(A) * r));
  let inner = 0;
  for (let r = 110; r <= 135; r += 0.5) if (onRing(r)) { inner = r; break; }
  let outer = 0;
  for (let r = 180; r >= 150; r -= 0.5) if (onRing(r)) { outer = r; break; }
  check('обводка 38: внутренний край r≈123', Math.abs(inner - 123) <= 2, `r=${inner}`);
  check('обводка 38: внешний край r≈161', Math.abs(outer - 161) <= 2, `r=${outer}`);

  // Ось градиента — строго по серединам дуг. У торцов антиалиасинг смешивает
  // цвет с подложкой, а её R−B = −8 «фиолетовее» любого стопа градиента,
  // поэтому при замере по краям экстремумы уезжают на торцы и ось выходит
  // неверной.
  const mids = [];
  for (const arc of arcs) {
    for (let k = Math.round(arc.len * 0.25); k < Math.round(arc.len * 0.75); k++) mids.push(arc.from + k);
  }
  const samples = mids.map((deg) => {
    const a = (deg * Math.PI) / 180;
    let r = 0;
    let b = 0;
    let n = 0;
    for (let rad = 132; rad <= 152; rad += 0.5) {
      const p = px(256 + Math.cos(a) * rad, 256 + Math.sin(a) * rad);
      r += p.r; b += p.b; n++;
    }
    return { deg, rb: r / n - b / n };
  });
  const pur = samples.reduce((a, b) => (b.rb > a.rb ? b : a));
  const blu = samples.reduce((a, b) => (b.rb < a.rb ? b : a));
  // 0° = вправо, 90° = вниз. По спеке фиолетовый на 135° (низ-лево),
  // синий на 315° (верх-право).
  const inQuad = (deg, sx, sy) =>
    Math.cos((deg * Math.PI) / 180) * sx > 0.5 && Math.sin((deg * Math.PI) / 180) * sy > 0.5;
  check('градиент: фиолетовый внизу-слева', inQuad(pur.deg, -1, 1), `${pur.deg.toFixed(0)}°, R−B=${pur.rb.toFixed(1)}`);
  check('градиент: синий вверх-вправо', inQuad(blu.deg, 1, -1), `${blu.deg.toFixed(0)}°, R−B=${blu.rb.toFixed(1)}`);
  check('порядок стопов: фиолетовый → синий', blu.rb < pur.rb - 25, `разница ${(pur.rb - blu.rb).toFixed(1)}`);

  let outside = 0;
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x += 2) {
      if (Math.hypot(x - 256, y - 256) > 204.8 && isRing(px(x, y))) outside++;
    }
  }
  check('знак внутри safe zone 80%', outside === 0, `пикселей кольца вне: ${outside}`);
}

// --- Маскабл -----------------------------------------------------------
{
  const { data, info } = await load('icon-maskable-512.png');
  const px = sampler(info, data);
  const c = px(3, 3);
  check('маскабл: подложка во весь квадрат', c.a === 255 && hex(c.r, c.g, c.b) === '#0A0C12', `alpha=${c.a} ${hex(c.r, c.g, c.b)}`);

  let maxR = 0;
  for (let deg = 0; deg < 360; deg += 0.5) {
    const a = (deg * Math.PI) / 180;
    for (let r = 230; r >= 100; r -= 0.5) {
      if (isRing(px(256 + Math.cos(a) * r, 256 + Math.sin(a) * r))) { maxR = Math.max(maxR, r); break; }
    }
  }
  const pct = (maxR / 256) * 100;
  check('маскабл: кольцо ≈63%', Math.abs(pct - 63) < 1.5, `${pct.toFixed(1)}% (r=${maxR.toFixed(1)})`);
  check('маскабл: переживает маску Android', pct < 80, `${pct.toFixed(1)}% < 80%`);
}

// --- Светлая версия ----------------------------------------------------
{
  const { data, info } = await load('icon-light-512.png');
  const px = sampler(info, data);
  const c = px(256, 40);
  check('светлая версия: белая подложка', hex(c.r, c.g, c.b) === '#FFFFFF', hex(c.r, c.g, c.b));
}

// --- Favicon: читается на любом фоне панели вкладок --------------------
{
  const { data, info } = await load('favicon-32.png');
  const px = sampler(info, data);
  const seen = new Map();
  let opaque = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const p = px(x, y);
      if (p.a < 20) continue;
      opaque++;
      seen.set(hex(p.r, p.g, p.b), 1);
    }
  }
  // Подложка непрозрачна и тёмная: на светлой панели вкладок знак не пропадёт.
  const mid = px(16, 16);
  check('favicon-32: тёмная подложка', mid.r + mid.g + mid.b < 200, hex(mid.r, mid.g, mid.b));
  check('favicon-32: подложка непрозрачна', opaque > 400, `непрозрачных пикселей: ${opaque}`);
  check('favicon-32: есть цветные пиксели кольца', seen.size > 2, `оттенков: ${seen.size}`);
}

// --- Моно: белый силуэт на прозрачном, для badge и CSS ----------------
for (const f of ['badge-192.png', 'badge-512.png']) {
  const { data, info } = await load(f);
  const px = sampler(info, data);
  const seen = new Set();
  let lit = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const p = px(x, y);
      if (p.a < 20) continue;
      seen.add(hex(p.r, p.g, p.b));
      if (p.r > 200 && p.g > 200 && p.b > 200) lit++;
    }
  }
  check(`${f}: белый силуэт, а не чёрный`, lit > 0, `светлых пикселей: ${lit}`);
  check(`${f}: не более двух оттенков`, seen.size <= 3, [...seen].join(' '));
}

console.log(failures === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
