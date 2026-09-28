import { useState } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Sheet } from '@/lib/types';
import { useSheetsStore } from '@/store/sheetsStore';
import { Menu } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function SheetTabs({ sheets }: { sheets: Sheet[] }) {
  const activeId = useSheetsStore((s) => s.activeSheetId);
  const addSheet = useSheetsStore((s) => s.addSheet);
  const renameSheet = useSheetsStore((s) => s.renameSheet);
  const deleteSheet = useSheetsStore((s) => s.deleteSheet);
  const setActive = useSheetsStore((s) => s.setActive);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const commitRename = () => {
    if (renamingId && renameValue.trim()) renameSheet(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <div role="tablist" aria-label="Листы" className="flex items-center gap-1 overflow-x-auto pb-1">
      {sheets.map((s) => {
        const active = s.id === activeId;
        const renaming = renamingId === s.id;
        return (
          <div key={s.id} className="relative shrink-0">
            {active ? (
              <motion.div
                layoutId="sheet-tab"
                className="absolute inset-0 rounded-xl border border-primary/40 bg-primary/10"
              />
            ) : null}
            {renaming ? (
              <Input
                autoFocus
                aria-label={`Переименование листа ${s.name}`}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="relative z-10 h-11 w-36 rounded-xl px-2 text-xs sm:h-9"
              />
            ) : (
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActive(s.id)}
                onDoubleClick={() => {
                  setRenamingId(s.id);
                  setRenameValue(s.name);
                }}
                className={cn(
                  'relative z-10 flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-9',
                  active ? 'pr-12 text-primary-ink' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span className="text-xs">{s.name.slice(0, 1).toUpperCase()}</span>
                <span className="max-w-28 truncate">{s.name}</span>
              </button>
            )}
            {active && !renaming && (
              <div className="absolute right-1 top-1/2 z-20 -translate-y-1/2">
                <Menu
                  align="end"
                  trigger={
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-6 sm:w-6"
                      aria-label={`Действия с листом ${s.name}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  }
                  items={[
                    {
                      label: 'Переименовать',
                      icon: <Pencil />,
                      onClick: () => {
                        setRenamingId(s.id);
                        setRenameValue(s.name);
                      },
                    },
                    { separator: true },
                    {
                      label: 'Удалить лист',
                      icon: <Trash2 />,
                      danger: true,
                      onClick: () => {
                        if (globalThis.confirm(`Удалить лист «${s.name}»? Данные будут потеряны.`)) {
                          deleteSheet(s.id);
                        }
                      },
                    },
                  ]}
                />
              </div>
            )}
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        className="h-11 shrink-0 px-2.5 text-muted-foreground sm:h-9"
        onClick={() => addSheet()}
      >
        <Plus className="h-4 w-4" /> Лист
      </Button>
    </div>
  );
}