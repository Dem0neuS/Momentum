import { describe, it, expect } from 'vitest';
import { cn, clamp, plural, truncate, hexToRgba, uid, nowIso } from '@/lib/utils';

describe('utils: cn', () => {
  it('склеивает условные классы', () => {
    expect(cn('a', false && 'b', null, undefined, 'c')).toBe('a c');
  });

  it('разрешает конфликты tailwind в пользу последнего', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'font-bold')).toBe('text-red-500 font-bold');
  });
});

describe('utils: clamp', () => {
  it('зажимает в границы', () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(20, 1, 10)).toBe(10);
    expect(clamp(-3, -1, 1)).toBe(-1);
  });
});

describe('utils: plural', () => {
  const forms: [string, string, string] = ['день', 'дня', 'дней'];

  it('выбирает форму по русским правилам', () => {
    expect(plural(1, forms)).toBe('день');
    expect(plural(2, forms)).toBe('дня');
    expect(plural(4, forms)).toBe('дня');
    expect(plural(5, forms)).toBe('дней');
    expect(plural(0, forms)).toBe('дней');
  });

  it('11–14 — всегда третья форма', () => {
    expect(plural(11, forms)).toBe('дней');
    expect(plural(13, forms)).toBe('дней');
    expect(plural(114, forms)).toBe('дней');
  });

  it('21, 22, 25 — по последней цифре', () => {
    expect(plural(21, forms)).toBe('день');
    expect(plural(22, forms)).toBe('дня');
    expect(plural(25, forms)).toBe('дней');
  });
});

describe('utils: truncate', () => {
  it('короткую строку не трогает', () => {
    expect(truncate('abc', 3)).toBe('abc');
    expect(truncate('abcd', 4)).toBe('abcd');
  });

  it('длинную обрезает и ставит многоточие', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abcde', 4)).toBe('abc…');
  });
});

describe('utils: hexToRgba', () => {
  it('понимает трёхзначный hex', () => {
    expect(hexToRgba('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('понимает шестизначный hex с решёткой и без', () => {
    expect(hexToRgba('#0A0C12', 1)).toBe('rgba(10, 12, 18, 1)');
    expect(hexToRgba('4A8CFF', 0.25)).toBe('rgba(74, 140, 255, 0.25)');
  });
});

describe('utils: uid и nowIso', () => {
  it('uid возвращает непустые уникальные строки', () => {
    const ids = new Set(Array.from({ length: 200 }, () => uid()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });

  it('nowIso возвращает корректную дату', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Number.isNaN(Date.parse(nowIso()))).toBe(false);
  });
});
