import { useMemo, useRef } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { Sheet } from '@/lib/types';
import { useSheetsStore } from '@/store/sheetsStore';
import { cellRef, colLetter } from '@/lib/formula';
import { cn } from '@/lib/utils';

type GridRow = { r: number };

export interface CellSel {
  r: number;
  c: number;
}

export interface CellEdit extends CellSel {
  value: string;
  source: 'cell' | 'formula';
}

export function SheetGrid({
  sheet,
  sel,
  setSel,
  editing,
  setEditing,
}: {
  sheet: Sheet;
  sel: CellSel | null;
  setSel: (s: CellSel) => void;
  editing: CellEdit | null;
  setEditing: (v: CellEdit | null) => void;
}) {
  const setCellValue = useSheetsStore((s) => s.setCellValue);
  const setColWidth = useSheetsStore((s) => s.setColWidth);
  const cells = useSheetsStore((s) => s.cells.filter((c) => c.sheetId === sheet.id));
  const evals = useSheetsStore((s) => s.evals[sheet.id]);
  const editRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<CellEdit | null>(editing);
  editingRef.current = editing;
  const updateEditing = (next: CellEdit | null) => {
    editingRef.current = next;
    setEditing(next);
  };
  /** Закрыть редактирование с клавиатуры и вернуть фокус в сетку. */
  const closeEditing = () => {
    updateEditing(null);
    gridRef.current?.focus();
  };

  const rows = useMemo<GridRow[]>(
    () => Array.from({ length: Math.max(1, sheet.rowCount) }, (_, i) => ({ r: i })),
    [sheet.rowCount],
  );

  const commit = (raw: string | null, r: number, c: number, force = false) => {
    const current = editingRef.current;
    if (!force && (!current || current.r !== r || current.c !== c)) return;
    const value = raw ?? '';
    const prev = cells.find((x) => x.row === r && x.col === c)?.raw ?? '';
    if (value !== prev) setCellValue(sheet.id, r, c, value);
    updateEditing(null);
  };

  /** Зафиксировать правку по клавиатуре и оставить фокус в сетке для следующих клавиш. */
  const commitAndKeepFocus = (raw: string, r: number, c: number) => {
    commit(raw, r, c);
    gridRef.current?.focus();
  };

  const move = (dr: number, dc: number) => {
    if (!sel) return;
    const r = Math.max(0, Math.min(sheet.rowCount - 1, sel.r + dr));
    const c = Math.max(0, Math.min(sheet.colCount - 1, sel.c + dc));
    setSel({ r, c });
  };

  const cellAt = (r: number, c: number) => cells.find((x) => x.row === r && x.col === c);

  const columns = useMemo<ColumnDef<GridRow>[]>(() => {
    const cols: ColumnDef<GridRow>[] = [
      {
        id: '_rownum',
        size: 44,
        minSize: 40,
        maxSize: 60,
        enableResizing: false,
        header: () => (
          <div className="flex items-center justify-center">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">#</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center text-xs font-medium text-muted-foreground">
            {row.original.r + 1}
          </div>
        ),
      },
    ];
    for (let c = 0; c < sheet.colCount; c++) {
      cols.push({
        id: `c${c}`,
        size: sheet.widths[c] ?? 100,
        minSize: 60,
        maxSize: 400,
        header: colLetter(c),
        cell: ({ row }) => {
          const r = row.original.r;
          const cell = cellAt(r, c);
          const val = evals?.values?.[r]?.[c];
          const isSelected = sel?.r === r && sel?.c === c;
          const isEditing = editing?.source === 'cell' && editing.r === r && editing.c === c;
          const display = val === null || val === undefined ? '' : String(val);
          const style = cell?.style;
          const isFormula = cell?.raw?.trim().startsWith('=') ?? false;

          const startEdit = (initial?: string) => {
            setSel({ r, c });
            updateEditing({ r, c, value: initial ?? cell?.raw ?? '', source: 'cell' });
          };

          return (
            <div
              tabIndex={-1}
              role="gridcell"
              aria-label={cellRef(r, c)}
              aria-selected={isSelected}
              onMouseDown={(e) => {
                e.stopPropagation();
                // Перед переходом сначала закрываем редактирование старой ячейки.
                // Иначе общее значение editing может мигрировать в новую ячейку.
                if (editing && (editing.r !== r || editing.c !== c)) {
                  commit(editing.value, editing.r, editing.c);
                }
                setSel({ r, c });
              }}
              onDoubleClick={() => startEdit()}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(
                'group/cell relative flex h-[30px] w-full items-center overflow-hidden px-2 text-[13px] leading-none outline-none',
                !isEditing && 'cursor-cell',
                isSelected && !isEditing && 'after:pointer-events-none after:absolute after:inset-0 after:border-2 after:border-primary/70 after:content-[""]',
              )}
              style={{
                fontWeight: style?.bold ? 700 : undefined,
                fontStyle: style?.italic ? 'italic' : undefined,
                textAlign: style?.align ?? 'left',
                backgroundColor: isFormula
                  ? 'rgba(139,92,246,0.08)'
                  : style?.bg
                    ? `${style.bg}40`
                    : undefined,
                color: style?.color ?? (isFormula ? '#8B5CF6' : undefined),
              }}
            >
              {isEditing ? (
                <input
                  ref={editRef}
                  autoFocus
                  value={editing?.value ?? ''}
                  onChange={(e) => {
                    if (editing) updateEditing({ ...editing, value: e.target.value });
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      commitAndKeepFocus(editing?.value ?? '', r, c);
                      move(1, 0);
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      commitAndKeepFocus(editing?.value ?? '', r, c);
                      move(0, e.shiftKey ? -1 : 1);
                    } else if (e.key === 'Escape') {
                      closeEditing();
                    }
                  }}
                  onBlur={() => {
                    if (editing) commit(editing.value, editing.r, editing.c);
                  }}
                  className="absolute inset-0 h-full w-full bg-background px-1.5 text-[13px] outline-none ring-2 ring-primary"
                />
              ) : (
                <span
                  className={cn(
                    'block w-full truncate whitespace-nowrap',
                    (val === null || val === undefined) && 'text-transparent',
                  )}
                >
                  {display || ' '}
                </span>
              )}
            </div>
          );
        },
      });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.colCount, sheet.widths, cells, evals, sel, editing]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  });

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (editing !== null) return;
    const meta = e.ctrlKey || e.metaKey || e.altKey;
    if (meta) return;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        move(-1, 0);
        break;
      case 'ArrowDown':
        e.preventDefault();
        move(1, 0);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        move(0, -1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        move(0, 1);
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        if (sel) updateEditing({ r: sel.r, c: sel.c, value: cellAt(sel.r, sel.c)?.raw ?? '', source: 'cell' });
        break;
      case 'Tab':
        e.preventDefault();
        move(0, e.shiftKey ? -1 : 1);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (sel) commit('', sel.r, sel.c, true);
        break;
      default:
        if (e.key.length === 1) {
          e.preventDefault();
          if (sel) updateEditing({ r: sel.r, c: sel.c, value: e.key, source: 'cell' });
        }
    }
  };

  const persistResize = () => {
    const sizing = table.getState().columnSizing;
    for (const [colId, w] of Object.entries(sizing)) {
      const m = /^c(\d+)$/.exec(colId);
      if (m) {
        const c = parseInt(m[1], 10);
        if (sheet.widths[c] !== w) setColWidth(sheet.id, c, Math.round(w));
      }
    }
  };

  const selectedBadge = sel ? cellRef(sel.r, sel.c) : '';

  return (
    <div
      ref={gridRef}
      tabIndex={0}
      role="grid"
      aria-label="Таблица"
      aria-rowcount={sheet.rowCount}
      aria-colcount={sheet.colCount}
      onKeyDown={onGridKeyDown}
      className="outline-none"
    >
      {/* Формульная строка */}
      <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-border/70 bg-background/60 px-2 py-1.5">
        <span className="w-14 shrink-0 text-center text-xs font-semibold text-muted-foreground">{selectedBadge}</span>
        <span className="shrink-0 text-muted-foreground/40">ƒx</span>
        <input
          value={editing?.value ?? (sel ? (cellAt(sel.r, sel.c)?.raw ?? '') : '')}
          readOnly={editing === null && !sel}
          onFocus={() => {
            if (sel) {
              updateEditing({ r: sel.r, c: sel.c, value: cellAt(sel.r, sel.c)?.raw ?? '', source: 'formula' });
            }
          }}
          onChange={(e) => {
            if (sel) updateEditing({ r: sel.r, c: sel.c, value: e.target.value, source: 'formula' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (editing) commitAndKeepFocus(editing.value, editing.r, editing.c);
            } else if (e.key === 'Escape') {
              closeEditing();
            }
          }}
          onBlur={() => {
            if (editing) commit(editing.value, editing.r, editing.c);
          }}
          placeholder="Значение или формула, напр. =SUM(A1:A5)"
          className="min-w-0 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Таблица */}
      <div className="overflow-auto rounded-xl border border-border/60 bg-card shadow-soft">
        <table className="border-separate border-spacing-0" style={{ width: table.getTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const isResizable = header.column.getCanResize();
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={cn(
                        'relative border-b border-border/60 bg-muted/60 px-0 py-0 text-[11px] font-semibold text-muted-foreground',
                        header.column.id !== '_rownum' && 'border-r border-border/30',
                      )}
                    >
                      <div className="flex h-[30px] select-none items-center justify-center px-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                      {isResizable && (
                        <div
                          onPointerDown={header.getResizeHandler()}
                          onPointerUp={persistResize}
                          className="absolute -right-0.5 top-0 z-10 h-full w-2 cursor-col-resize touch-none bg-transparent after:absolute after:left-1/2 after:top-0 after:h-full after:w-px after:-translate-x-1/2 after:bg-transparent hover:after:bg-primary/60"
                          role="separator"
                          aria-label="Изменить ширину колонки"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, ri) => (
              <tr key={row.id} className={cn(ri % 2 === 1 && 'bg-background/40')}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className={cn(
                      'border-b border-border/30 p-0',
                      cell.column.id !== '_rownum' && 'border-r border-border/30',
                      cell.column.id === '_rownum' && 'bg-muted/40',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}