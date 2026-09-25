import { motion, AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, FolderCog, Plus, Trash2 } from 'lucide-react';
import type { Category, Habit, Subcategory } from '@/lib/types';
import { useHabitsStore } from '@/store/habitsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Menu } from '@/components/ui/menu';
import { HabitCard } from './HabitCard';
import { cn } from '@/lib/utils';

interface CategoryTreeProps {
  category: Category;
  subs: { sub: Subcategory; items: Habit[] }[];
  direct: Habit[];
  date: string;
  isOver: boolean;
  onOpenDetail: (h: Habit) => void;
  onAddHabit: (categoryId: string | null) => void;
  onManageCategories: () => void;
}

/** Секция категории с аккордеоном, подкатегориями и меню управления */
export function CategorySection({
  category,
  subs,
  direct,
  date,
  isOver,
  onOpenDetail,
  onAddHabit,
  onManageCategories,
}: CategoryTreeProps) {
  const collapsed = useSettingsStore((s) => s.settings.collapsedCategories[category.id] ?? false);
  const setCollapsed = useSettingsStore((s) => s.setCategoryCollapsed);
  const deleteCategory = useHabitsStore((s) => s.deleteCategory);
  const logs = useHabitsStore((s) => s.logs);

  const items = [...direct, ...subs.flatMap((s) => s.items)];
  const doneToday = items.filter((h) =>
    logs.some((l) => l.habitId === h.id && l.date === date && l.status === 'done'),
  ).length;

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border bg-card shadow-soft transition-all',
        isOver && 'ring-2 ring-primary/50',
      )}
    >
      <div
        className="flex w-full items-center gap-3 px-3 py-2.5"
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(category.id, !collapsed)}
        onKeyDown={(e) => e.key === 'Enter' && setCollapsed(category.id, !collapsed)}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: `${category.color}1f` }}
        >
          {category.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{category.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {items.length > 0 ? `${doneToday} из ${items.length} сегодня` : 'нет привычек'}
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {items.filter((h) => h.archived).length > 0 ? `${items.length - items.filter((h) => h.archived).length} активных` : `${items.length}`}
        </span>
        <Menu
          align="end"
          trigger={
            <button
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
              aria-label="Управление категорией"
            >
              <FolderCog className="h-4 w-4" />
            </button>
          }
          items={[
            { label: 'Добавить привычку', icon: <Plus />, onClick: () => onAddHabit(category.id) },
            { label: 'Управление категориями', icon: <FolderCog />, onClick: () => onManageCategories() },
            { separator: true },
            {
              label: 'Удалить категорию',
              icon: <Trash2 />,
              danger: true,
              onClick: () => {
                if (globalThis.confirm(`Удалить категорию «${category.name}»? Привычки останутся без категории.`)) {
                  deleteCategory(category.id);
                }
              },
            },
          ]}
        />
        <motion.button
          animate={{ rotate: collapsed ? 0 : 180 }}
          className="rounded-lg p-1 text-muted-foreground"
          aria-label={collapsed ? 'Развернуть' : 'Свернуть'}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <div className="space-y-2 border-t border-border/50 p-3">
              {subs.map(({ sub, items: subItems }) => (
                <SubcategoryGroup
                  key={sub.id}
                  sub={sub}
                  items={subItems}
                  date={date}
                  categoryColor={category.color}
                  onOpenDetail={onOpenDetail}
                  onAddHabit={onAddHabit}
                />
              ))}
              {direct.length > 0 && (
                <div className="space-y-2 pt-0.5">
                  {direct.map((h) => (
                    <HabitCard
                      key={h.id}
                      habit={h}
                      date={date}
                      categoryColor={category.color}
                      onOpenDetail={onOpenDetail}
                    />
                  ))}
                </div>
              )}
              {direct.length === 0 && subs.length === 0 && (
                <p className="px-2 py-1 text-sm text-muted-foreground">
                  Пока пусто. Добавьте привычку в эту категорию.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Dnd-зона для переноса привычки в подкатегорию */
function SubDropZone({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'rounded-2xl ring-2 ring-primary/40')}>
      {children}
    </div>
  );
}

function SubcategoryGroup({
  sub,
  items,
  date,
  categoryColor,
  onOpenDetail,
  onAddHabit,
}: {
  sub: Subcategory;
  items: Habit[];
  date: string;
  categoryColor?: string;
  onOpenDetail: (h: Habit) => void;
  onAddHabit: (categoryId: string | null) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className="text-sm">{sub.icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {sub.name}
        </span>
        <span className="text-[11px] text-muted-foreground">{items.length}</span>
        <button
          className="ml-auto rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
          onClick={() => onAddHabit(sub.categoryId)}
          title="Добавить привычку"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <SubDropZone id={`cat:${sub.categoryId}:sub:${sub.id}`} className="space-y-2">
        {items.map((h) => (
          <HabitCard
            key={h.id}
            habit={h}
            date={date}
            categoryColor={categoryColor}
            onOpenDetail={onOpenDetail}
          />
        ))}
        {items.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground">Нет привычек</p>
        )}
      </SubDropZone>
    </div>
  );
}

/** Заглушка раздела «Без категории» */
export function UncategorizedSection({
  items,
  date,
  isOver,
  onOpenDetail,
  onAddHabit,
}: {
  items: Habit[];
  date: string;
  isOver: boolean;
  onOpenDetail: (h: Habit) => void;
  onAddHabit: () => void;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-dashed border-border/70 bg-card/50 p-3',
        isOver && 'ring-2 ring-primary/50',
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-sm">🗂️</span>
        <span className="text-sm font-semibold">Без категории</span>
        {items.length > 0 && <span className="text-[11px] text-muted-foreground">{items.length}</span>}
        <button
          className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onAddHabit}
          aria-label="Добавить привычку"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {items.map((h) => (
          <HabitCard key={h.id} habit={h} date={date} onOpenDetail={onOpenDetail} />
        ))}
        {items.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground">Привычки без категории появятся здесь</p>
        )}
      </div>
    </section>
  );
}