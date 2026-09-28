import { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useHabitsStore } from '@/store/habitsStore';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ColorPicker } from '@/components/ui/color-picker';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { cn } from '@/lib/utils';

export function CategoryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useHabitsStore((s) => s.categories);
  const subcategories = useHabitsStore((s) => s.subcategories);
  const addCategory = useHabitsStore((s) => s.addCategory);
  const updateCategory = useHabitsStore((s) => s.updateCategory);
  const deleteCategory = useHabitsStore((s) => s.deleteCategory);
  const addSubcategory = useHabitsStore((s) => s.addSubcategory);
  const updateSubcategory = useHabitsStore((s) => s.updateSubcategory);
  const deleteSubcategory = useHabitsStore((s) => s.deleteSubcategory);

  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<'cat' | 'sub' | null>(null);
  const [deleteId, setDeleteId] = useState('');
  const [deleteName, setDeleteName] = useState('');

  const createCategory = () => {
    if (!newName.trim()) return;
    addCategory({
      name: newName.trim(),
      icon: '📁',
      color: categories.length % 2 === 0 ? '#6C4DF6' : '#4A8CFF',
    });
    setNewName('');
  };

  const confirmDelete = () => {
    if (toDelete === 'cat') deleteCategory(deleteId);
    if (toDelete === 'sub') deleteSubcategory(deleteId);
    setToDelete(null);
    setDeleteId('');
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Категории и подкатегории" size="lg">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createCategory()}
              placeholder="Название новой категории…"
              aria-label="Название новой категории"
            />
            <Button variant="gradient" onClick={createCategory}>
              <Plus className="h-4 w-4" /> Добавить
            </Button>
          </div>

          <div className="space-y-2">
            {categories
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((cat) => {
                const isOpen = expanded === cat.id;
                const subs = subcategories.filter((sc) => sc.categoryId === cat.id);
                return (
                  <div key={cat.id} className="rounded-lg border border-border/60 bg-background/30">
                    <div className="flex flex-wrap items-center gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : cat.id)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-8 sm:w-8"
                        aria-label={`${isOpen ? 'Свернуть' : 'Развернуть'} категорию ${cat.name}`}
                        aria-expanded={isOpen}
                      >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      <span className="text-lg">{cat.icon}</span>
                      <Input
                        value={cat.name}
                        className="h-8 w-36 flex-1 rounded-lg text-sm"
                        aria-label={`Название категории ${cat.name}`}
                        onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                      />
                      <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-destructive-ink/70 transition-colors hover:bg-destructive/10 hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-8 sm:w-8"
                        onClick={() => {
                          setToDelete('cat');
                          setDeleteId(cat.id);
                          setDeleteName(cat.name);
                        }}
                        aria-label={`Удалить категорию ${cat.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="space-y-3 border-t border-border/50 p-3">
                        <EmojiPicker
                          value={cat.icon}
                          onChange={(icon) => updateCategory(cat.id, { icon })}
                        />
                        <ColorPicker value={cat.color} onChange={(color) => updateCategory(cat.id, { color })} />

                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Подкатегории
                          </p>
                          {subs.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-2">
                              <span className="text-base">{sub.icon}</span>
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: sub.color }}
                              />
                              <Input
                                value={sub.name}
                                className="h-8 flex-1 rounded-lg text-sm"
                                aria-label={`Название подкатегории ${sub.name}`}
                                onChange={(e) => updateSubcategory(sub.id, { name: e.target.value })}
                              />
                              <button
                                type="button"
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-destructive-ink/70 transition-colors hover:bg-destructive/10 hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-8 sm:w-8"
                                onClick={() => {
                                  setToDelete('sub');
                                  setDeleteId(sub.id);
                                  setDeleteName(sub.name);
                                }}
                                aria-label={`Удалить подкатегорию ${sub.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <SubcategoryAdd categoryId={cat.id} onAdd={addSubcategory} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            {categories.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Категорий пока нет — создайте первую выше.
              </p>
            )}
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={toDelete === 'cat' ? 'Удалить категорию?' : 'Удалить подкатегорию?'}
        message={
          toDelete === 'cat'
            ? `Привычки из «${deleteName}» останутся, но станут без категории.`
            : `Привычки «${deleteName}» останутся без подкатегории.`
        }
        confirmLabel="Удалить"
        danger
        onConfirm={confirmDelete}
      />
    </>
  );
}

function SubcategoryAdd({
  categoryId,
  onAdd,
}: {
  categoryId: string;
  onAdd: (input: { categoryId: string; name: string; icon: string; color: string }) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const add = () => {
    if (!name.trim()) return;
    onAdd({ categoryId, name: name.trim(), icon, color: '#7A8398' });
    setName('');
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder="Добавить подкатегорию…"
        aria-label="Название новой подкатегории"
        className="h-8 flex-1 rounded-lg text-sm"
      />
      <Button variant="ghost" size="sm" onClick={add}>
        <Plus className="h-4 w-4" /> Добавить
      </Button>
    </div>
  );
}