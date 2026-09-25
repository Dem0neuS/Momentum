import { HyperFormula, type ConfigParams } from 'hyperformula';
import type { Cell, CellValue, Sheet } from './types';

/** Индекс колонки → буква: 0 → A, 26 → AA … */
export function colLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function cellRef(row: number, col: number): string {
  return `${colLetter(col)}${row + 1}`;
}

/** 'B3' → { row: 2, col: 1 } */
export function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = /^([A-Za-z]+)([1-9][0-9]*)$/.exec(ref.trim());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: parseInt(m[2], 10) - 1, col: col - 1 };
}

function toCellInput(raw: string): string | number {
  const trimmed = raw.trim();
  if (raw.startsWith('=')) return raw;
  if (trimmed === '') return '';
  if (/^-?\d*\.?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function valueToCellValue(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const e = v as { type?: string };
    return `#${e?.type ?? 'ОШИБКА'}!`;
  }
  return String(v);
}

export interface SheetEvaluation {
  values: CellValue[][];
  formulas: (string | null)[][];
}

/**
 * Вычисление значений листа через HyperFormula.
 * Формулы начинаются с «=»: SUM, AVERAGE, MIN, MAX, COUNT, IF,
 * ссылки на ячейки (A1) и диапазоны (A1:B5), арифметика.
 */
export function evaluateSheet(sheet: Sheet, cells: Cell[]): SheetEvaluation {
  const rowCount = Math.max(1, sheet.rowCount);
  const colCount = Math.max(1, sheet.colCount);

  const matrix: (string | number)[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => ''),
  );
  const formulas: (string | null)[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => null),
  );

  for (const cell of cells) {
    if (cell.row < rowCount && cell.col < colCount) {
      matrix[cell.row][cell.col] = toCellInput(cell.raw);
      if (cell.raw.trim().startsWith('=')) formulas[cell.row][cell.col] = cell.raw.trim();
    }
  }

  const values: CellValue[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => null),
  );

  let hf: HyperFormula | null = null;
  let sheetId: number | null = null;
  try {
    // Свежий инстанс на каждый пересчёт — безопасно и предсказуемо
    hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' } as Partial<ConfigParams>);
    const added = hf.addSheet(sheet.id);
    sheetId = hf.getSheetId(added) ?? null;
    if (sheetId === null) throw new Error('Sheet id not found');
    void hf.setCellContents({ row: 0, col: 0, sheet: sheetId }, matrix);
    const rawValues = hf.getSheetValues(sheetId) as unknown[][];
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        values[r][c] = valueToCellValue(rawValues[r]?.[c]);
      }
    }
  } catch {
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const v = matrix[r][c];
        values[r][c] = typeof v === 'number' ? v : v === '' ? null : v;
      }
    }
  }

  return { values, formulas };
}