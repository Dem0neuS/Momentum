// Пересборка растровых иконок из SVG-исходников в public/icons.
//
//   npm i -D sharp
//   node scripts/build-icons.mjs
//
// sharp ставится разработчиком, а не в package.json: он нужен только при
// смене геометрии знака, а в CI и в сборке приложения не участвует. Тянуть
// нативный модуль в зависимости ради одной команды — лишний риск для
// пайплайна.
//
// Правки вносятся в SVG (public/icons/momentum-logo*.svg), а не в этот
// скрипт: он только растеризует.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Не найден sharp. Установите его: npm i -D sharp');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const icons = resolve(here, '..', 'public', 'icons');
if (!existsSync(icons)) {
  console.error(`Каталог не найден: ${icons}`);
  process.exit(1);
}

const read = (name) => readFileSync(join(icons, name), 'utf8');

/**
 * Набор PNG. Каждый выход — один SVG в одном размере.
 * mono — однотонный силуэт: currentColor разрешаем свойством color на
 * корневом <svg> (заменой строки нельзя: первое вхождение currentColor
 * в файле попадает в комментарий, и атрибут stroke остался бы нетронутым).
 */
const outputs = [
  { file: 'icon-512.png', svg: 'momentum-logo.svg', size: 512 },
  { file: 'icon-192.png', svg: 'momentum-logo.svg', size: 192 },
  { file: 'icon-180.png', svg: 'momentum-logo.svg', size: 180 },
  { file: 'apple-touch-icon.png', svg: 'momentum-logo.svg', size: 180 },
  { file: 'icon-maskable-512.png', svg: 'momentum-logo-maskable.svg', size: 512 },
  { file: 'icon-light-512.png', svg: 'momentum-logo-light.svg', size: 512 },
  // Favicon — основной знак с тёмной подложкой, а не моно-версия.
  // Favicon грузится как отдельный документ и не наследует color страницы,
  // поэтому белый силуэт на прозрачном фоне на светлой панели вкладок
  // просто исчезает. С подложкой знак читается на любом фоне.
  { file: 'favicon-32.png', svg: 'momentum-logo.svg', size: 32 },
  // Моно — для badge уведомлений (Android рисует его однотонным силуэтом)
  // и для использования в CSS через color.
  { file: 'badge-192.png', svg: 'momentum-logo-mono.svg', size: 192, monoColor: '#FFFFFF' },
  { file: 'badge-512.png', svg: 'momentum-logo-mono.svg', size: 512, monoColor: '#FFFFFF' },
];

for (const out of outputs) {
  const src = join(icons, out.svg);
  if (!existsSync(src)) {
    console.error(`Нет исходника: ${src}`);
    process.exit(1);
  }
  let svg = read(out.svg);
  if (out.monoColor) svg = svg.replace('<svg ', `<svg color="${out.monoColor}" `);

  const buf = await sharp(Buffer.from(svg), { density: 384 })
    .resize(out.size, out.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(icons, out.file), buf);
  console.log(`${out.file.padEnd(24)} ${out.size}×${out.size}  ${(buf.length / 1024).toFixed(1)} КБ`);
}

// favicon.svg = основной знак с тёмной подложкой: читается на любой панели
// вкладок. Моно-исходник с currentColor остаётся отдельным файлом — там
// цвет задаёт CSS, и для вкладки он не применим.
writeFileSync(join(icons, 'favicon.svg'), read('momentum-logo.svg'));
console.log('favicon.svg              основной знак (тёмная подложка)');
console.log('\nГотово. Проверить геометрию: node scripts/verify-icons.mjs');
