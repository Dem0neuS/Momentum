// Генерация PWA-иконок Momentum (без внешних зависимостей, кроме pngjs)
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const VIOLET = [124, 92, 255];
const BLUE = [74, 140, 255];
const NAVY = [10, 12, 18];
const WHITE = [255, 255, 255];

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function makeCanvas(size) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i++) png.data[i] = 0;
  return png;
}

function blendPixel(png, x, y, [r, g, b], alpha = 1) {
  const w = png.width;
  if (x < 0 || y < 0 || x >= w || y >= w) return;
  const idx = (y * w + x) * 4;
  const a = alpha;
  png.data[idx] = Math.round(r * a + png.data[idx] * (1 - a));
  png.data[idx + 1] = Math.round(g * a + png.data[idx + 1] * (1 - a));
  png.data[idx + 2] = Math.round(b * a + png.data[idx + 2] * (1 - a));
  png.data[idx + 3] = Math.round(255 * a + png.data[idx + 3] * (1 - a));
}

function fillRoundRect(png, x0, y0, x1, y1, radius, color) {
  radius = Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const inCorner =
        (x < x0 + radius && y < y0 + radius) ||
        (x > x1 - radius && y < y0 + radius) ||
        (x < x0 + radius && y > y1 - radius) ||
        (x > x1 - radius && y > y1 - radius);
      if (inCorner) {
        // расстояние до центра угла
        const cx = x < x0 + radius ? x0 + radius : x1 - radius;
        const cy = y < y0 + radius ? y0 + radius : y1 - radius;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > radius) continue;
        blendPixel(png, x, y, color, 1);
      } else {
        blendPixel(png, x, y, color, 1);
      }
    }
  }
}

function drawThickLine(png, x0, y0, x1, y1, width, colorFn) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
  const r = width / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const color = colorFn(t);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.hypot(dx, dy) <= r) {
          blendPixel(png, Math.round(x + dx), Math.round(y + dy), color, 1);
        }
      }
    }
  }
}

function drawArrow(png, size, maskable) {
  // Логотип: восходящая ломаная с наконечником — символ движения/роста
  const margin = maskable ? 0.17 : 0.2;
  const x = (v) => v * size;
  const y = (v) => v * size;

  // Ломаная вверх: три сегмента
  const pts = [
    [margin, 1 - margin - 0.06],
    [0.38, 0.72],
    [0.56, 0.78],
    [0.82, 0.42],
  ];

  let total = 0;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push({ ...pts[i], ex: pts[i + 1][0], ey: pts[i + 1][1], len, start: total });
    total += len;
  }

  const stroke = 0.075 * size;
  for (const s of segs) {
    drawThickLine(
      png,
      x(s[0]), y(s[1]),
      x(s.ex), y(s.ey),
      stroke,
      (t) => lerp(VIOLET, BLUE, (s.start + t * s.len) / total),
    );
  }

  // Наконечник стрелки
  const tipX = x(pts[pts.length - 1][0]);
  const tipY = y(pts[pts.length - 1][1]);
  const len = 0.14 * size;
  const ang = Math.atan2(pts[pts.length - 1][1] - pts[pts.length - 2][1], pts[pts.length - 1][0] - pts[pts.length - 2][0]);
  const b1 = [ang + Math.PI * 0.72, ang - Math.PI * 0.72];
  for (const b of b1) {
    drawThickLine(
      png,
      tipX, tipY,
      tipX + Math.cos(b) * len, tipY + Math.sin(b) * len,
      stroke * 0.9,
      () => BLUE,
    );
  }

  // Маленькая восходящая точка-«M» внизу — лёгкая отсылка к букве M
  drawThickLine(png, x(0.32), y(0.88), x(0.32), y(0.94), stroke * 0.45, () => WHITE);
  drawThickLine(png, x(0.44), y(0.88), x(0.44), y(0.94), stroke * 0.45, () => WHITE);
  drawThickLine(png, x(0.32), y(0.94), x(0.44), y(0.94), stroke * 0.45, () => WHITE);
}

function render(size, maskable) {
  const png = makeCanvas(size);
  const pad = maskable ? 0 : Math.round(size * 0.02);
  if (maskable) {
    for (let i = 0; i < size; i++)
      for (let j = 0; j < size; j++) blendPixel(png, i, j, NAVY, 1);
  } else {
    fillRoundRect(png, pad, pad, size - 1 - pad, size - 1 - pad, size * 0.22, NAVY);
  }
  drawArrow(png, size, maskable);
  return png;
}

const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
];

for (const [name, size, maskable] of jobs) {
  const png = render(size, maskable);
  writeFileSync(join(outDir, name), PNG.sync.write(png));
  console.log(`✓ ${name} (${size}x${size})`);
}