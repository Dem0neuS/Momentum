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
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {sheets.map((s) => {
        const active = s.id === activeId;
        return (
          <div key={s.id} className="relative shrink-0">
            {active ? (
              <motion.div
                layoutId="sheet-tab"
                className="absolute inset-0 rounded-xl border border-primary/40 bg-primary/10"
              />
            ) : null}
            <button
              onClick={() => setActive(s.id)}
              onDoubleClick={() => {
                setRenamingId(s.id);
                setRenameValue(s.name);
              }}
              className={cn(
                'relative z-10 flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <span className="text-xs">{s.name.slice(0, 1).toUpperCase()}</span>
              {renamingId === s.id ? (
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="h-6 w-24 rounded-md px-1.5 text-xs"
                />
              ) : (
                <span className="max-w-28 truncate">{s.name}</span>
              )}
              {active && (
                <span className="ml-0.5 flex items-center">
                  <Menu
                    align="end"
                    trigger={
                      <span className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </span>
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
                </span>
              )}
            </button>
          </div>
        );
      })}
      <Button variant="ghost" size="sm" className="h-9 shrink-0 px-2.5 text-muted-foreground" onClick={() => addSheet()}>
        <Plus className="h-4 w-4" /> Лист
      </Button>
    </div>
  );
}