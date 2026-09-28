import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { createDndAnnouncements, dndScreenReaderInstructions } from '@/lib/dndA11y';
import type { Habit } from '@/lib/types';
import { useHabitsStore } from '@/store/habitsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { CategorySection, UncategorizedSection } from './CategoryTree';

const NONE_CONTAINER = 'cat:_none';

function isContainer(id: string): boolean {
  return id.startsWith('cat:');
}

function parseContainer(id: string): { categoryId: string | null; subcategoryId: string | null } {
  if (id === NONE_CONTAINER) return { categoryId: null, subcategoryId: null };
  const parts = id.split(':');
  if (parts[1] === 'none') return { categoryId: null, subcategoryId: null };
  return { categoryId: parts[1], subcategoryId: parts[3] ?? null };
}

/** Обёртка с droppable-зоной для перетаскивания привычек */
function DropZone({
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
    <div ref={setNodeRef} className={className} data-over={isOver}>
      {children}
    </div>
  );
}

export function HabitList({
  habits,
  date,
  onOpenDetail,
  onAddHabit,
  onManageCategories,
}: {
  habits: Habit[];
  date: string;
  onOpenDetail: (h: Habit) => void;
  onAddHabit: (categoryId: string | null) => void;
  onManageCategories: () => void;
}) {
  const categories = useHabitsStore((s) => s.categories);
  const subcategories = useHabitsStore((s) => s.subcategories);
  const moveHabit = useHabitsStore((s) => s.moveHabit);

  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(KeyboardSensor),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const groups = useMemo(() => {
    return categories
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((cat) => ({
        category: cat,
        subs: subcategories
          .filter((sc) => sc.categoryId === cat.id)
          .sort((a, b) => a.order - b.order)
          .map((sub) => ({
            sub,
            items: habits.filter((h) => h.subcategoryId === sub.id),
          })),
        direct: habits.filter((h) => h.categoryId === cat.id && !h.subcategoryId),
      }));
  }, [categories, subcategories, habits]);

  const uncategorized = habits.filter((h) => !h.categoryId);

  const onDragStart = () => setOverId(null);

  const onDragOver = (e: DragOverEvent) => {
    const over = e.over?.id;
    if (over && isContainer(String(over))) setOverId(String(over));
    else setOverId(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setOverId(null);
    const { active, over } = e;
    if (!active || !over) return;
    const habitId = String(active.id);
    const overIdStr = String(over.id);
    if (!isContainer(overIdStr)) return;
    const target = parseContainer(overIdStr);
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (habit.categoryId === target.categoryId && (habit.subcategoryId ?? null) === target.subcategoryId) {
      return;
    }
    moveHabit(habitId, target.categoryId, target.subcategoryId);
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        screenReaderInstructions: dndScreenReaderInstructions,
        announcements: createDndAnnouncements((id) => habits.find((h) => h.id === id)?.name),
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-3">
        {groups.map((g) => (
          <DropZone key={g.category.id} id={`cat:${g.category.id}`}>
            <CategorySection
              category={g.category}
              subs={g.subs}
              direct={g.direct}
              date={date}
              isOver={overId === `cat:${g.category.id}`}
              onOpenDetail={onOpenDetail}
              onAddHabit={onAddHabit}
              onManageCategories={onManageCategories}
            />
          </DropZone>
        ))}

        {uncategorized.length > 0 && (
          <DropZone id={NONE_CONTAINER}>
            <UncategorizedSection
              items={uncategorized}
              date={date}
              isOver={overId === NONE_CONTAINER}
              onOpenDetail={onOpenDetail}
              onAddHabit={() => onAddHabit(null)}
            />
          </DropZone>
        )}
      </div>
    </DndContext>
  );
}