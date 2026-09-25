import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, CalendarDays, CheckCircle2, Plus, Search, Sparkles } from 'lucide-react';
import { useHabitsStore } from '@/store/habitsStore';
import { HabitForm } from './HabitForm';
import { HabitDetail } from './HabitDetail';
import { CategoryManager } from './CategoryManager';
import { HabitList } from './HabitList';
import { isScheduledOn, logsMap } from '@/lib/streak';
import { todayKey } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProgressRing } from '@/components/ProgressRing';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { Habit } from '@/lib/types';

type Filter = 'all' | 'today' | 'done' | 'archived';

export function HabitsPage() {
  const habits = useHabitsStore((s) => s.habits);
  const logs = useHabitsStore((s) => s.logs);
  const streaks = useHabitsStore((s) => s.streaks);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [detail, setDetail] = useState<Habit | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState<string | null>(null);

  const today = todayKey();
  const logMap = useMemo(() => logsMap(logs), [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return habits.filter((h) => {
      if (filter === 'archived') {
        if (!h.archived) return false;
      } else if (h.archived) {
        return false;
      }
      if (filter === 'today' && !isScheduledOn(h, new Date(today + 'T12:00:00'))) return false;
      if (filter === 'done' && logMap.get(`${h.id}:${today}`)?.status !== 'done') return false;
      if (q && !h.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [habits, query, filter, today, logMap]);

  const active = habits.filter((h) => !h.archived);
  const doneToday = active.filter((h) => logMap.get(`${h.id}:${today}`)?.status === 'done').length;

  const openAdd = (categoryId: string | null) => {
    setEditing(null);
    setDefaultCategory(categoryId);
    setFormOpen(true);
  };

  const { best, total } = useMemo(() => {
    const vals = active
      .map((h) => streaks[h.id]?.current ?? 0)
      .sort((a, b) => b - a);
    return { best: vals[0] ?? 0, total: active.length };
  }, [active, streaks]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      {/* Заголовок */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Привычки</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total > 0 ? `Сегодня выполнено ${doneToday} из ${total}` : 'Добавьте первую привычку'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{best}</span>
            <span className="text-muted-foreground">макс. серия</span>
          </div>
          <ProgressRing
            size={44}
            stroke={4}
            progress={total > 0 ? doneToday / total : 0}
            color="#8B5CF6"
            trackColor="rgba(139,92,246,0.15)"
          >
            <span className="text-[10px] font-semibold text-muted-foreground">
              {Math.round(total > 0 ? (doneToday / total) * 100 : 0)}%
            </span>
          </ProgressRing>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="sticky top-[calc(var(--header-h,64px)+8px)] z-20 -mx-2 space-y-2 rounded-2xl bg-background/85 px-2 py-2 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск привычки…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} icon={<Sparkles className="h-3.5 w-3.5" />}>
            Все
          </FilterChip>
          <FilterChip active={filter === 'today'} onClick={() => setFilter('today')} icon={<CalendarDays className="h-3.5 w-3.5" />}>
            На сегодня
          </FilterChip>
          <FilterChip active={filter === 'done'} onClick={() => setFilter('done')} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            Выполнено
          </FilterChip>
          <FilterChip active={filter === 'archived'} onClick={() => setFilter('archived')} icon={<Archive className="h-3.5 w-3.5" />}>
            Архив
          </FilterChip>
          <button
            onClick={() => setManagerOpen(true)}
            className="shrink-0 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Категории
          </button>
        </div>
      </div>

      {/* Список */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={filter === 'archived' ? <Archive className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
          title={query || filter !== 'all' ? 'Ничего не найдено' : 'Пока нет привычек'}
          description={
            query || filter !== 'all'
              ? 'Попробуйте изменить поиск или фильтр.'
              : 'Начните с малого: добавьте первую привычку и следите за серией.'
          }
          action={
            !query && filter !== 'archived' ? (
              <Button variant="gradient" onClick={() => openAdd(null)}>
                <Plus className="h-4 w-4" /> Добавить привычку
              </Button>
            ) : undefined
          }
        />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <HabitList
            habits={filtered}
            date={today}
            onOpenDetail={setDetail}
            onAddHabit={openAdd}
            onManageCategories={() => setManagerOpen(true)}
          />
        </motion.div>
      )}

      {/* FAB */}
      <button
        onClick={() => openAdd(null)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-500/30 transition-transform active:scale-95 md:bottom-6 md:right-6"
        aria-label="Добавить привычку"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Модалки */}
      <HabitForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        habit={editing}
        defaultCategoryId={defaultCategory}
      />
      <HabitDetail
        habit={detail}
        onClose={() => setDetail(null)}
        onEdit={(h) => {
          setDetail(null);
          setEditing(h);
          setFormOpen(true);
        }}
      />
      <CategoryManager open={managerOpen} onClose={() => setManagerOpen(false)} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-transparent bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm'
          : 'border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}