import { useMemo, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Columns,
  Eraser,
  Italic,
  Rows,
  Trash2,
} from 'lucide-react';
import { useSheetsStore } from '@/store/sheetsStore';
import { SheetTabs } from './SheetTabs';
import { SheetGrid, type CellSel } from './SheetGrid';
import { Popover } from '@/components/ui/popover';
import { ColorPicker } from '@/components/ui/color-picker';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { COLORS } from '@/lib/constants';

export function SheetsPage() {
  const sheets = useSheetsStore((s) => s.sheets);
  const activeSheetId = useSheetsStore((s) => s.activeSheetId);
  const setCellStyle = useSheetsStore((s) => s.setCellStyle);
  const addRow = useSheetsStore((s) => s.addRow);
  const removeRow = useSheetsStore((s) => s.removeRow);
  const addCol = useSheetsStore((s) => s.addCol);
  const removeCol = useSheetsStore((s) => s.removeCol);

  const [sel, setSel] = useState<CellSel | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const sheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  const selectedCell = sel && sheet ? useSheetsStore.getState().getCell(sheet.id, sel.r, sel.c) : null;

  const style = (patch: Record<string, unknown>) => {
    if (sheet && sel) setCellStyle(sheet.id, sel.r, sel.c, patch);
  };

  const toolBtn = (active: boolean) =>
    cn(
      'flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
      active && 'border-primary/40 bg-primary/10 text-primary',
    );

  const sheetCount = sheets.length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Таблицы</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Формулы =SUM/AVERAGE/MIN/MAX/COUNT/IF, ссылки A1 и диапазоны A1:B5
        </p>
      </div>

      <SheetTabs sheets={sheets} />

      {!sheet ? (
        <EmptyState
          icon={<Columns className="h-8 w-8" />}
          title="Листов пока нет"
          description="Создайте первый лист, чтобы начать работать с таблицами."
          action={
            <Button variant="gradient" onClick={() => useSheetsStore.getState().addSheet()}>
              + Создать лист
            </Button>
          }
        />
      ) : (
        <>
          {/* Панель инструментов */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-card p-1.5 shadow-soft">
            <button
              className={toolBtn(!!selectedCell?.style?.bold)}
              onClick={() => style({ bold: !selectedCell?.style?.bold })}
              title="Жирный"
              aria-label="Жирный"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              className={toolBtn(!!selectedCell?.style?.italic)}
              onClick={() => style({ italic: !selectedCell?.style?.italic })}
              title="Курсив"
              aria-label="Курсив"
            >
              <Italic className="h-4 w-4" />
            </button>
            <span className="mx-0.5 h-6 w-px bg-border/70" />
            <button
              className={toolBtn(selectedCell?.style?.align === 'left')}
              onClick={() => style({ align: 'left' })}
              title="По левому краю"
              aria-label="По левому краю"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              className={toolBtn(selectedCell?.style?.align === 'center')}
              onClick={() => style({ align: 'center' })}
              title="По центру"
              aria-label="По центру"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              className={toolBtn(selectedCell?.style?.align === 'right')}
              onClick={() => style({ align: 'right' })}
              title="По правому краю"
              aria-label="По правому краю"
            >
              <AlignRight className="h-4 w-4" />
            </button>
            <span className="mx-0.5 h-6 w-px bg-border/70" />
            <Popover
              trigger={
                <button className={cn(toolBtn(!!selectedCell?.style?.bg), 'gap-1')} title="Цвет заливки" aria-label="Цвет заливки">
                  <span className="h-3 w-3 rounded-sm border border-border/60" style={{ backgroundColor: selectedCell?.style?.bg ?? COLORS[3] }} />
                </button>
              }
              align="start"
            >
              <div className="w-56 p-2">
                <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">Заливка ячейки</p>
                <ColorPicker value={selectedCell?.style?.bg ?? COLORS[3]} onChange={(c) => style({ bg: c })} />
              </div>
            </Popover>
            <Popover
              trigger={
                <button className={toolBtn(!!selectedCell?.style?.color)} title="Цвет текста" aria-label="Цвет текста">
                  <span className="text-[11px] font-bold" style={{ color: selectedCell?.style?.color ?? COLORS[2] }}>
                    A
                  </span>
                </button>
              }
              align="start"
            >
              <div className="w-56 p-2">
                <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">Цвет текста</p>
                <ColorPicker value={selectedCell?.style?.color ?? COLORS[2]} onChange={(c) => style({ color: c })} />
              </div>
            </Popover>
            <span className="mx-0.5 h-6 w-px bg-border/70" />
            <button
              className={toolBtn(false)}
              onClick={() => style({ bold: false, italic: false, align: undefined, bg: undefined, color: undefined })}
              title="Сбросить стиль"
              aria-label="Сбросить стиль"
            >
              <Eraser className="h-4 w-4" />
            </button>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => sheet && addRow(sheet.id)} title="Добавить строку">
                <Rows className="h-3.5 w-3.5" /> Строка
              </Button>
              <Button variant="outline" size="sm" onClick={() => sheet && addCol(sheet.id)} title="Добавить столбец">
                <Columns className="h-3.5 w-3.5" /> Столбец
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (!sheet) return;
                  if (globalThis.confirm(`Удалить последнюю строку листа «${sheet.name}»?`)) {
                    removeRow(sheet.id, sheet.rowCount - 1);
                  }
                }}
                title="Удалить последнюю строку"
              >
                <Trash2 className="h-3.5 w-3.5" /> Строка
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (!sheet) return;
                  if (globalThis.confirm(`Удалить последний столбец листа «${sheet.name}»?`)) {
                    removeCol(sheet.id, sheet.colCount - 1);
                  }
                }}
                title="Удалить последний столбец"
              >
                <Trash2 className="h-3.5 w-3.5" /> Столбец
              </Button>
            </div>
          </div>

          <p className="px-1 text-xs text-muted-foreground">
            {sheet.rowCount} строк × {sheet.colCount} столбцов{sel ? ` · выбрано ${cellRefLabel(sel)}` : ''} · двойной клик — редактирование, Enter — вниз, Tab — вправо
          </p>

          <SheetGrid sheet={sheet} sel={sel} setSel={setSel} editing={editing} setEditing={setEditing} />
        </>
      )}
    </div>
  );
}

function cellRefLabel(sel: CellSel): string {
  const code = (n: number) => {
    let s = '';
    let x = n;
    while (x >= 0) {
      s = String.fromCharCode(65 + (x % 26)) + s;
      x = Math.floor(x / 26) - 1;
    }
    return s;
  };
  return `${code(sel.c)}${sel.r + 1}`;
}