import { create } from 'zustand';
import { db } from '@/db/db';
import type { Cell, CellStyle, Sheet } from '@/lib/types';
import { evaluateSheet, type SheetEvaluation } from '@/lib/formula';
import { uid } from '@/lib/utils';

const DEFAULT_COLS = 6;
const DEFAULT_ROWS = 12;

interface SheetsState {
  loaded: boolean;
  sheets: Sheet[];
  cells: Cell[];
  activeSheetId: string | null;
  /** Вычисленные значения (формулы) по каждому листу */
  evals: Record<string, SheetEvaluation>;
  revision: number;

  load: (data?: { sheets: Sheet[]; cells: Cell[] }) => Promise<void>;
  reset: () => void;

  addSheet: (name?: string) => string;
  renameSheet: (id: string, name: string) => void;
  deleteSheet: (id: string) => void;
  setActive: (id: string) => void;

  setCellValue: (sheetId: string, row: number, col: number, raw: string) => void;
  setCellStyle: (sheetId: string, row: number, col: number, patch: Partial<CellStyle>) => void;

  addRow: (sheetId: string) => void;
  removeRow: (sheetId: string, row: number) => void;
  addCol: (sheetId: string) => void;
  removeCol: (sheetId: string, col: number) => void;
  setColWidth: (sheetId: string, col: number, width: number) => void;

  getCell: (sheetId: string, row: number, col: number) => Cell | undefined;
  getDisplayValue: (sheetId: string, row: number, col: number) => string;
  evaluate: (sheetId: string) => void;
}

function findCell(cells: Cell[], sheetId: string, row: number, col: number): Cell | undefined {
  return cells.find((c) => c.sheetId === sheetId && c.row === row && c.col === col);
}

export const useSheetsStore = create<SheetsState>((set, get) => ({
  loaded: false,
  sheets: [],
  cells: [],
  activeSheetId: null,
  evals: {},
  revision: 0,

  load: async (data) => {
    if (!data) {
      const [sheets, cells] = await Promise.all([db.sheets.toArray(), db.cells.toArray()]);
      data = { sheets, cells };
    }
    const sheets = data.sheets;
    const evals: Record<string, SheetEvaluation> = {};
    for (const sheet of sheets) {
      evals[sheet.id] = evaluateSheet(sheet, data.cells.filter((c) => c.sheetId === sheet.id));
    }
    set({
      loaded: true,
      sheets,
      cells: data.cells,
      evals,
      activeSheetId: get().activeSheetId ?? sheets[0]?.id ?? null,
    });
  },

  reset: () =>
    set({ loaded: false, sheets: [], cells: [], evals: {}, activeSheetId: null }),

  addSheet: (name) => {
    const s = get();
    const id = uid();
    const sheet: Sheet = {
      id,
      name: name?.trim() || `Лист ${s.sheets.length + 1}`,
      colCount: DEFAULT_COLS,
      rowCount: DEFAULT_ROWS,
      widths: [],
    };
    set({
      sheets: [...s.sheets, sheet],
      activeSheetId: id,
      evals: { ...s.evals, [id]: evaluateSheet(sheet, []) },
    });
    void db.sheets.put(sheet);
    return id;
  },

  renameSheet: (id, name) => {
    const s = get();
    const sheet = s.sheets.find((x) => x.id === id);
    if (!sheet) return;
    const next = { ...sheet, name: name || sheet.name };
    set({ sheets: s.sheets.map((x) => (x.id === id ? next : x)) });
    void db.sheets.put(next);
  },

  deleteSheet: (id) => {
    const s = get();
    const rest = s.sheets.filter((x) => x.id !== id);
    const removedCells = s.cells.filter((c) => c.sheetId === id);
    set({
      sheets: rest,
      cells: s.cells.filter((c) => c.sheetId !== id),
      activeSheetId: s.activeSheetId === id ? (rest[0]?.id ?? null) : s.activeSheetId,
      evals: Object.fromEntries(Object.entries(s.evals).filter(([k]) => k !== id)),
    });
    void db.sheets.delete(id);
    if (removedCells.length) void db.cells.bulkDelete(removedCells.map((c) => c.id));
  },

  setActive: (id) => set({ activeSheetId: id }),

  setCellValue: (sheetId, row, col, raw) => {
    const s = get();
    const sheet = s.sheets.find((x) => x.id === sheetId);
    if (!sheet) return;
    const existing = findCell(s.cells, sheetId, row, col);
    const trimmed = raw;

    if (trimmed === '' && existing) {
      const cells = s.cells.filter((c) => c.id !== existing.id);
      set({ cells, revision: s.revision + 1 });
      void db.cells.delete(existing.id);
      get().evaluate(sheetId);
      return;
    }
    if (trimmed === '' && !existing) return;

    const cell: Cell = existing
      ? { ...existing, raw: trimmed }
      : { id: uid(), sheetId, row, col, raw: trimmed };
    const cells = existing ? s.cells.map((c) => (c.id === existing.id ? cell : c)) : [...s.cells, cell];
    set({ cells, revision: s.revision + 1 });
    void db.cells.put(cell);
    get().evaluate(sheetId);
  },

  setCellStyle: (sheetId, row, col, patch) => {
    const s = get();
    const existing = findCell(s.cells, sheetId, row, col);
    if (!existing) {
      if (!patch.bold && !patch.italic && !patch.align && !patch.bg && !patch.color) return;
      const cell: Cell = { id: uid(), sheetId, row, col, raw: '', style: patch };
      set({ cells: [...s.cells, cell] });
      void db.cells.put(cell);
      return;
    }
    const cell: Cell = { ...existing, style: { ...(existing.style ?? {}), ...patch } };
    set({ cells: s.cells.map((c) => (c.id === existing.id ? cell : c)) });
    void db.cells.put(cell);
  },

  addRow: (sheetId) => {
    const s = get();
    const sheet = s.sheets.find((x) => x.id === sheetId);
    if (!sheet) return;
    const next = { ...sheet, rowCount: sheet.rowCount + 1 };
    set({ sheets: s.sheets.map((x) => (x.id === sheetId ? next : x)) });
    void db.sheets.put(next);
    get().evaluate(sheetId);
  },

  removeRow: (sheetId, row) => {
    const s = get();
    const sheet = s.sheets.find((x) => x.id === sheetId);
    if (!sheet || sheet.rowCount <= 1) return;
    const next = { ...sheet, rowCount: sheet.rowCount - 1 };
    const removedCells = s.cells.filter((c) => c.sheetId === sheetId && c.row === row);
    const beforeCells = s.cells.filter((c) => c.sheetId === sheetId && c.row < row);
    const shiftedCells = s.cells
      .filter((c) => c.sheetId === sheetId && c.row > row)
      .map((c) => ({ ...c, row: c.row - 1 }));
    const cells = s.cells
      .filter((c) => c.sheetId !== sheetId)
      .concat(beforeCells, shiftedCells);
    set({ sheets: s.sheets.map((x) => (x.id === sheetId ? next : x)), cells });
    void db.sheets.put(next);
    void persistSheetCells(get(), sheetId, cells.filter((c) => c.sheetId === sheetId));
    if (removedCells.length) void db.cells.bulkDelete(removedCells.map((c) => c.id));
    get().evaluate(sheetId);
  },

  addCol: (sheetId) => {
    const s = get();
    const sheet = s.sheets.find((x) => x.id === sheetId);
    if (!sheet) return;
    const next = { ...sheet, colCount: sheet.colCount + 1, widths: [...sheet.widths, 120] };
    set({ sheets: s.sheets.map((x) => (x.id === sheetId ? next : x)) });
    void db.sheets.put(next);
    get().evaluate(sheetId);
  },

  removeCol: (sheetId, col) => {
    const s = get();
    const sheet = s.sheets.find((x) => x.id === sheetId);
    if (!sheet || sheet.colCount <= 1) return;
    const next = { ...sheet, colCount: sheet.colCount - 1, widths: sheet.widths.filter((_, i) => i !== col) };
    const removedCells = s.cells.filter((c) => c.sheetId === sheetId && c.col === col);
    const beforeCells = s.cells.filter((c) => c.sheetId === sheetId && c.col < col);
    const shiftedCells = s.cells
      .filter((c) => c.sheetId === sheetId && c.col > col)
      .map((c) => ({ ...c, col: c.col - 1 }));
    const cells = s.cells
      .filter((c) => c.sheetId !== sheetId)
      .concat(beforeCells, shiftedCells);
    set({ sheets: s.sheets.map((x) => (x.id === sheetId ? next : x)), cells });
    void db.sheets.put(next);
    void persistSheetCells(get(), sheetId, cells.filter((c) => c.sheetId === sheetId));
    if (removedCells.length) void db.cells.bulkDelete(removedCells.map((c) => c.id));
    get().evaluate(sheetId);
  },

  setColWidth: (sheetId, col, width) => {
    const s = get();
    const sheet = s.sheets.find((x) => x.id === sheetId);
    if (!sheet) return;
    const widths = [...sheet.widths];
    widths[col] = Math.max(60, Math.min(400, width));
    const next = { ...sheet, widths };
    set({ sheets: s.sheets.map((x) => (x.id === sheetId ? next : x)) });
    void db.sheets.put(next);
  },

  getCell: (sheetId, row, col) => findCell(get().cells, sheetId, row, col),
  getDisplayValue: (sheetId, row, col) => {
    const ev = get().evals[sheetId];
    const v = ev?.values?.[row]?.[col];
    if (v === null || v === undefined) return '';
    return String(v);
  },

  evaluate: (sheetId) => {
    const s = get();
    const sheet = s.sheets.find((x) => x.id === sheetId);
    if (!sheet) return;
    const cells = s.cells.filter((c) => c.sheetId === sheetId);
    set((st) => ({ evals: { ...st.evals, [sheetId]: evaluateSheet(sheet, cells) } }));
  },
}));

function persistSheetCells(_store: SheetsState, sheetId: string, cells: Cell[]): void {
  const sheetCells = cells.filter((c) => c.sheetId === sheetId);
  void db.transaction('rw', db.cells, async () => {
    await db.cells.where('sheetId').equals(sheetId).delete();
    if (sheetCells.length) await db.cells.bulkPut(sheetCells);
  });
}