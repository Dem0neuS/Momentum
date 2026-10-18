import { describe, it, expect } from 'vitest';
import { colLetter, cellRef, parseCellRef, evaluateSheet } from '@/lib/formula';
import type { Cell, Sheet } from '@/lib/types';

function cell(row: number, col: number, raw: string): Cell {
  return { id: `${row}:${col}`, sheetId: 's1', row, col, raw };
}

function sheet(rowCount: number, colCount: number): Sheet {
  return { id: 's1', name: 'Лист', rowCount, colCount, widths: [] };
}

describe('formula: буквы колонок', () => {
  it('colLetter: одна буква', () => {
    expect(colLetter(0)).toBe('A');
    expect(colLetter(1)).toBe('B');
    expect(colLetter(25)).toBe('Z');
  });

  it('colLetter: две буквы', () => {
    expect(colLetter(26)).toBe('AA');
    expect(colLetter(27)).toBe('AB');
    expect(colLetter(51)).toBe('AZ');
    expect(colLetter(52)).toBe('BA');
  });

  it('colLetter: границы разрядов', () => {
    expect(colLetter(701)).toBe('ZZ');
    expect(colLetter(702)).toBe('AAA');
  });

  it('cellRef собирает ссылку из строки и колонки', () => {
    expect(cellRef(0, 0)).toBe('A1');
    expect(cellRef(2, 1)).toBe('B3');
    expect(cellRef(9, 26)).toBe('AA10');
  });
});

describe('formula: разбор ссылок', () => {
  it('parseCellRef разбирает простые ссылки', () => {
    expect(parseCellRef('B3')).toEqual({ row: 2, col: 1 });
    expect(parseCellRef('AA10')).toEqual({ row: 9, col: 26 });
    expect(parseCellRef('Z1')).toEqual({ row: 0, col: 25 });
  });

  it('parseCellRef игнорирует регистр и пробелы вокруг', () => {
    expect(parseCellRef(' b3 ')).toEqual({ row: 2, col: 1 });
  });

  it('parseCellRef отвергает мусор и нулевую строку', () => {
    expect(parseCellRef('A0')).toBeNull();
    expect(parseCellRef('3B')).toBeNull();
    expect(parseCellRef('')).toBeNull();
    expect(parseCellRef('ABC')).toBeNull();
  });

  it('cellRef и parseCellRef — обратные операции', () => {
    expect(parseCellRef(cellRef(4, 3))).toEqual({ row: 4, col: 3 });
  });
});

describe('formula: вычисление листа', () => {
  it('считает SUM по диапазону', () => {
    const cells = [cell(0, 0, '2'), cell(1, 0, '3'), cell(2, 0, '=SUM(A1:A2)')];
    const { values } = evaluateSheet(sheet(3, 1), cells);
    expect(values[0][0]).toBe(2);
    expect(values[1][0]).toBe(3);
    expect(values[2][0]).toBe(5);
  });

  it('понимает арифметику и несколько формул', () => {
    const cells = [
      cell(0, 0, '10'),
      cell(0, 1, '=A1*2'),
      cell(1, 1, '=SUM(A1:B1)'),
    ];
    const { values } = evaluateSheet(sheet(2, 2), cells);
    expect(values[0][1]).toBe(20);
    expect(values[1][1]).toBe(30);
  });

  it('запоминает исходные формулы, но не числа', () => {
    const cells = [cell(0, 0, '5'), cell(0, 1, '=A1+1')];
    const { formulas } = evaluateSheet(sheet(1, 2), cells);
    expect(formulas[0][0]).toBeNull();
    expect(formulas[0][1]).toBe('=A1+1');
  });

  it('текст остаётся текстом, пустая ячейка пуста', () => {
    const cells = [cell(0, 0, 'привет')];
    const { values } = evaluateSheet(sheet(1, 2), cells);
    expect(values[0][0]).toBe('привет');
    // Пустая ячейка может прийти как null или '' — в таблице и то и другое
    // рендерится пустым (SheetGrid: null/undefined → ''), поэтому проверяем
    // именно «пустоту», а не конкретное представление.
    expect(values[0][1] === null || values[0][1] === '').toBe(true);
  });

  it('ошибка формулы превращается в текст вида #…!', () => {
    const { values } = evaluateSheet(sheet(1, 1), [cell(0, 0, '=1/0')]);
    expect(typeof values[0][0]).toBe('string');
    expect(values[0][0] as string).toMatch(/^#.+!$/);
  });

  it('ячейки за пределами листа игнорируются', () => {
    const cells = [cell(0, 0, '7'), cell(5, 5, '999')];
    const { values } = evaluateSheet(sheet(1, 1), cells);
    expect(values).toEqual([[7]]);
  });
});
