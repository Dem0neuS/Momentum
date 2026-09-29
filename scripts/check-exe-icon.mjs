// Проверка знака внутри собранного .exe.
//
// electron-builder вшивает иконку Windows как ресурс PE (icon.ico), поэтому
// «старый логотип» в установленном приложении означал бы, что в пакет уехала
// другая картинка. Здесь иконка достаётся прямо из файла и сравнивается с
// текущим public/icons/icon-512.png (и, при желании, с файлом из истории).
//
// Использование:
//   node scripts/check-exe-icon.mjs release/win-unpacked/Momentum.exe [old.png]
import { closeSync, openSync, readFileSync, readSync } from 'node:fs';
import { PNG } from 'pngjs';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Все PNG внутри файла: ищутся по сигнатуре, длиной считается до IEND. */
function findEmbeddedPngs(buf) {
  const out = [];
  let from = 0;
  for (;;) {
    const start = buf.indexOf(SIG, from);
    if (start < 0) break;
    from = start + 1;
    if (buf.slice(start + 12, start + 16).toString('latin1') !== 'IHDR') continue;
    const width = buf.readUInt32BE(start + 16);
    const height = buf.readUInt32BE(start + 20);
    const end = buf.indexOf(Buffer.from('IEND', 'latin1'), start);
    if (end < 0) continue;
    const bytes = buf.slice(start, end + 8);
    out.push({ offset: start, width, height, bytes });
  }
  return out;
}

/** Пересэмплирование в size×size усреднением по блокам (box filter). */
function resample(pixels, w, h, size) {
  const out = new Float64Array(size * size * 3);
  const kx = w / size;
  const ky = h / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      const x0 = Math.floor(x * kx);
      const x1 = Math.min(w, Math.ceil((x + 1) * kx));
      const y0 = Math.floor(y * ky);
      const y1 = Math.min(h, Math.ceil((y + 1) * ky));
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * w + sx) * 4;
          r += pixels[i];
          g += pixels[i + 1];
          b += pixels[i + 2];
          n++;
        }
      }
      const o = (y * size + x) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  }
  return out;
}

/** Среднее расхождение 0..255 между двумя картинками, приведёнными к 128×128. */
function compare(a, b) {
  const size = 128;
  const pa = resample(a.data, a.width, a.height, size);
  const pb = resample(b.data, b.width, b.height, size);
  let sum = 0;
  let max = 0;
  for (let i = 0; i < pa.length; i++) {
    const d = Math.abs(pa[i] - pb[i]);
    sum += d;
    if (d > max) max = d;
  }
  return { mean: sum / pa.length, max };
}

const exePath = process.argv[2];
if (!exePath) {
  console.error('Укажите путь к .exe: node scripts/check-exe-icon.mjs <exe> [old.png]');
  process.exit(1);
}

// Большой .exe целиком читать и сканировать медленно: ресурсы лежат в одном
// месте, поэтому можно ограничиться окном (offset, length) в килобайтах.
const winOffset = Number(process.argv[4] ?? 0);
const winLength = Number(process.argv[5] ?? 0);

let exe;
if (winLength > 0) {
  const fd = openSync(exePath, 'r');
  const buf = Buffer.alloc(winLength);
  readSync(fd, buf, 0, winLength, winOffset);
  closeSync(fd);
  exe = buf;
  console.log(`Окно ${exePath}: ${winOffset}..${winOffset + winLength}`);
} else {
  exe = readFileSync(exePath);
}

const pngs = findEmbeddedPngs(exe).filter((p) => p.width >= 64 && p.width <= 512);
console.log(`PNG внутри ${exePath}: ${pngs.length} (>=64px)`);
for (const p of pngs) console.log(`  ${p.width}x${p.height} @${p.offset} — ${p.bytes.length} Б`);

const current = PNG.sync.read(readFileSync(new URL('../public/icons/icon-512.png', import.meta.url)));
console.log(`\nТекущий знак: public/icons/icon-512.png ${current.width}x${current.height}`);

const oldPath = process.argv[3];
const old = oldPath ? PNG.sync.read(readFileSync(oldPath)) : null;
if (old) console.log(`Старый знак:  ${oldPath} ${old.width}x${old.height}`);

let fail = 0;
const large = pngs.filter((p) => p.width >= 128).sort((a, b) => b.width - a.width);
for (const p of large.slice(0, 3)) {
  let img;
  try {
    img = PNG.sync.read(p.bytes);
  } catch {
    console.log(`\n${p.width}x${p.height}: нечитаемый PNG, пропускаю`);
    continue;
  }
  const vsCurrent = compare(img, current);
  const line = `\n${p.width}x${p.height}: расхождение с текущим — среднее ${vsCurrent.mean.toFixed(1)}, максимум ${vsCurrent.max.toFixed(1)}`;
  if (old) {
    const vsOld = compare(img, old);
    console.log(`${line}; со старым — среднее ${vsOld.mean.toFixed(1)}`);
  } else {
    console.log(line);
  }
  if (vsCurrent.mean > 12) {
    fail++;
    console.log('  -> это НЕ текущий знак');
  }
}

if (!large.length) {
  console.log('PNG-иконок крупнее 128px не найдено — возможно, ресурсы в формате BMP.');
  process.exit(2);
}
console.log(fail ? `\nПРОВАЛ: расходится ${fail} иконок` : '\nОК: знак в .exe совпадает с текущим');
process.exit(fail ? 1 : 0);
