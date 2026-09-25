import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Check, Plus } from 'lucide-react';
import type { BlockType, DayPlan, DayPlanItem } from '@/lib/types';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlanItem } from './PlanItem';

export const BLOCK_META: Record<
  BlockType,
  { labelKey: 'mainLabel' | 'mediumLabel' | 'smallLabel'; color: string; hint: string; emoji: string; defaultCountKey: 'mainDefaultCount' | 'mediumDefaultCount' | 'smallDefaultCount' }
> = {
  main: { labelKey: 'mainLabel', color: '#8B5CF6', hint: 'Главное на сегодня', emoji: '⭐', defaultCountKey: 'mainDefaultCount' },
  medium: { labelKey: 'mediumLabel', color: '#3B82F6', hint: 'Важное', emoji: '🔷', defaultCountKey: 'mediumDefaultCount' },
  small: { labelKey: 'smallLabel', color: '#F59E0B', hint: 'Мелочи', emoji: '🔹', defaultCountKey: 'smallDefaultCount' },
};

export function PlanBlock({
  plan,
  block,
  items,
}: {
  plan: DayPlan;
  block: BlockType;
  items: DayPlanItem[];
}) {
  const addItem = useDayPlanStore((s) => s.addItem);
  const blockSettings = useSettingsStore((s) => s.settings.blockSettings);
  const meta = BLOCK_META[block];
  const label = blockSettings[meta.labelKey];
  const defaultCount = blockSettings[meta.defaultCountKey];

  const { setNodeRef, isOver } = useDroppable({ id: block });
  const [text, setText] = useState('');
  const [time, setTime] = useState('');

  const add = () => {
    if (!text.trim()) return;
    addItem(plan.id, block, text.trim(), { time: time || undefined });
    setText('');
    setTime('');
  };

  const done = items.filter((i) => i.completed).length;
  const limitReached = items.length >= defaultCount;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'rounded-2xl border bg-card p-3 shadow-soft transition-all',
        isOver && 'ring-2 ring-primary/50',
        block === 'main' && 'border-violet-500/25',
        block === 'medium' && 'border-blue-500/25',
        block === 'small' && 'border-amber-500/25',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
          style={{ backgroundColor: `${meta.color}1c` }}
        >
          {meta.emoji}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
        </div>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          {done}/{items.length}
          {limitReached && items.length > 0 && <Check className="h-3 w-3 text-success" />}
        </span>
      </div>

      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {items.map((item) => (
            <PlanItem key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>

      {items.length === 0 && (
        <p className="mb-1 rounded-xl border border-dashed border-border/60 px-3 py-3 text-center text-xs text-muted-foreground">
          Пусто — добавьте пункт
        </p>
      )}

      {/* Быстрое добавление */}
      <div className="mt-2 flex items-center gap-1.5">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={`Добавить в «${label}»…`}
          className={cn('h-9 rounded-xl text-sm', `focus-visible:ring-${meta.color}`)}
          style={{ ['--tw-ring-color' as string]: `${meta.color}66` }}
        />
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="h-9 w-24 rounded-xl text-xs"
          aria-label="Время"
        />
        <Button variant="ghost" size="icon-sm" onClick={add} aria-label="Добавить пункт" className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}