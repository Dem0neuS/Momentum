import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { useCalendarStore } from '@/store/calendarStore';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  dayKey,
  formatDayTitle,
  formatMonthYear,
  monthGrid,
  parseDayKey,
  startOfMonth,
  todayKey,
} from '@/lib/dates';
import { BLOCK_META } from '@/modules/dayPlan/PlanBlock';
import type { SectionId } from '@/components/navigation';
import type { BlockType, DayPlan, DayPlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const BLOCKS: BlockType[] = ['main', 'medium', 'small'];

function byCreatedAt(a: { createdAt: string }, b: { createdAt: string }): number {
  return a.createdAt.localeCompare(b.createdAt);
}

function byOrder(a: DayPlanItem, b: DayPlanItem): number {
  return a.order - b.order;
}

export function CalendarPage({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const notes = useCalendarStore((s) => s.notes);
  const selectedDate = useCalendarStore((s) => s.selectedDate);
  const setSelectedDate = useCalendarStore((s) => s.setSelectedDate);
  const addNote = useCalendarStore((s) => s.addNote);
  const updateNote = useCalendarStore((s) => s.updateNote);
  const deleteNote = useCalendarStore((s) => s.deleteNote);

  const plans = useDayPlanStore((s) => s.plans);
  const items = useDayPlanStore((s) => s.items);
  const toggleItem = useDayPlanStore((s) => s.toggleItem);
  const setPlanDate = useDayPlanStore((s) => s.setSelectedDate);

  const blockSettings = useSettingsStore((s) => s.settings.blockSettings);

  // Показываемый месяц не обязан совпадать с выбранной датой: можно листать
  // вперёд/назад, не меняя день, который открыт ниже.
  const [cursor, setCursor] = useState(() => startOfMonth(parseDayKey(selectedDate)));
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  // Незаконченная заметка не должна «переезжать» на другой день.
  useEffect(() => {
    setDraft('');
    setEditingId(null);
    setEditDraft('');
  }, [selectedDate]);

  const today = todayKey();
  const days = useMemo(() => monthGrid(cursor), [cursor]);

  const planByDate = useMemo(() => {
    const map = new Map<string, DayPlan>();
    for (const plan of plans) map.set(plan.date, plan);
    return map;
  }, [plans]);

  const itemsByPlan = useMemo(() => {
    const map = new Map<string, DayPlanItem[]>();
    for (const item of items) {
      const list = map.get(item.planId) ?? [];
      list.push(item);
      map.set(item.planId, list);
    }
    for (const list of map.values()) list.sort(byOrder);
    return map;
  }, [items]);

  const noteCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of notes) map.set(note.date, (map.get(note.date) ?? 0) + 1);
    return map;
  }, [notes]);

  const selectedPlan = planByDate.get(selectedDate);
  const selectedItems = selectedPlan ? (itemsByPlan.get(selectedPlan.id) ?? []) : [];
  const done = selectedItems.filter((i) => i.completed).length;
  const total = selectedItems.length;
  const dayNotes = notes.filter((n) => n.date === selectedDate).sort(byCreatedAt);
  const isTodaySelected = selectedDate === today;

  const selectDay = (date: Date) => {
    const key = dayKey(date);
    setSelectedDate(key);
    if (date.getMonth() !== cursor.getMonth() || date.getFullYear() !== cursor.getFullYear()) {
      setCursor(startOfMonth(date));
    }
  };

  const goToday = () => {
    const now = new Date();
    setSelectedDate(dayKey(now));
    setCursor(startOfMonth(now));
  };

  const openPlan = (date: string) => {
    setPlanDate(date);
    onNavigate('dayplan');
  };

  const submitNote = () => {
    if (!draft.trim()) return;
    addNote(selectedDate, draft);
    setDraft('');
  };

  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditDraft(text);
  };

  const saveEdit = () => {
    if (!editingId || !editDraft.trim()) return;
    updateNote(editingId, editDraft);
    setEditingId(null);
    setEditDraft('');
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <section className="rounded-lg border border-border/70 bg-card p-3 shadow-card sm:p-4">
        <div className="mb-3 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-center text-sm font-semibold capitalize sm:text-base">
            {formatMonthYear(cursor)}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Следующий месяц"
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="px-2 text-[11px] sm:px-3 sm:text-xs"
            onClick={goToday}
            disabled={isTodaySelected && cursor.getTime() === startOfMonth(new Date()).getTime()}
          >
            Сегодня
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="pb-1 text-center text-[11px] font-medium text-muted-foreground"
              aria-hidden
            >
              {w}
            </div>
          ))}

          {days.map((date) => {
            const key = dayKey(date);
            const inMonth =
              date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear();
            const isSelected = key === selectedDate;
            const isToday = key === today;
            const plan = planByDate.get(key);
            const list = plan ? (itemsByPlan.get(plan.id) ?? []) : [];
            const listDone = list.filter((i) => i.completed).length;
            const complete = list.length > 0 && listDone === list.length;
            const noteCount = noteCountByDate.get(key) ?? 0;

            const label = formatDayTitle(date);
            const details = [
              list.length ? `выполнено ${listDone} из ${list.length}` : '',
              noteCount ? `заметок: ${noteCount}` : '',
            ].filter(Boolean);

            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(date)}
                aria-current={isSelected ? 'date' : undefined}
                aria-label={details.length ? `${label}, ${details.join(', ')}` : label}
                className={cn(
                  'relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent hover:bg-accent',
                  isToday && !isSelected && 'border-primary/40 bg-primary/5',
                  !inMonth && 'opacity-40',
                )}
              >
                <span
                  className={cn(
                    'text-[13px] font-semibold tabular-nums',
                    isToday && 'text-primary-ink',
                  )}
                >
                  {date.getDate()}
                </span>
                {list.length > 0 ? (
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-none tabular-nums',
                      complete ? 'text-success-ink' : 'text-muted-foreground',
                    )}
                  >
                    {listDone}/{list.length}
                  </span>
                ) : (
                  <span className="h-[10px]" aria-hidden />
                )}
                <span
                  className={cn(
                    'h-1 w-1 rounded-full',
                    noteCount > 0 ? 'bg-primary' : 'bg-transparent',
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {isTodaySelected ? 'Сегодня' : 'Выбранный день'}
          </p>
          <h1 className="truncate text-xl font-bold">{formatDayTitle(parseDayKey(selectedDate))}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => openPlan(selectedDate)}>
          <ExternalLink aria-hidden />
          Открыть план
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border/70 bg-card p-4 shadow-card">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">План дня</h2>
            {total > 0 && (
              <span className={cn('text-xs font-medium', done === total ? 'text-success-ink' : 'text-muted-foreground')}>
                {done} из {total}
              </span>
            )}
          </div>

          {total > 0 ? (
            <div className="space-y-3">
              {BLOCKS.map((block) => {
                const list = selectedItems.filter((i) => i.blockType === block).sort(byOrder);
                if (!list.length) return null;
                const meta = BLOCK_META[block];
                return (
                  <div key={block}>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span aria-hidden>{meta.emoji}</span>
                      {blockSettings[meta.labelKey]}
                    </p>
                    <ul className="space-y-0.5">
                      {list.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            aria-pressed={item.completed}
                            className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                          >
                            <span
                              aria-hidden
                              className={cn(
                                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                item.completed
                                  ? 'border-success bg-success text-success-foreground'
                                  : 'border-border-strong',
                              )}
                            >
                              {item.completed && <Check className="h-3 w-3" strokeWidth={3} />}
                            </span>
                            <span
                              className={cn(
                                'min-w-0 flex-1',
                                item.completed && 'text-muted-foreground line-through',
                              )}
                            >
                              {item.time && (
                                <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">
                                  {item.time}
                                </span>
                              )}
                              {item.text}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center">
              <p className="text-sm text-muted-foreground">На этот день пока ничего не запланировано.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => openPlan(selectedDate)}>
                Составить план
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border/70 bg-card p-4 shadow-card">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Заметки</h2>
            {dayNotes.length > 0 && (
              <span className="text-xs text-muted-foreground">{dayNotes.length}</span>
            )}
          </div>

          {dayNotes.length > 0 ? (
            <ul className="space-y-1.5">
              {dayNotes.map((note) => (
                <li key={note.id}>
                  {editingId === note.id ? (
                    <div className="rounded-md border border-border bg-surface-2 p-2">
                      <Textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        autoFocus
                        aria-label="Текст заметки"
                      />
                      <div className="mt-2 flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft('');
                          }}
                        >
                          Отмена
                        </Button>
                        <Button size="sm" onClick={saveEdit} disabled={!editDraft.trim()}>
                          Сохранить
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1 rounded-md border border-border/60 bg-surface px-2.5 py-2">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">
                        {note.text}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground"
                        onClick={() => startEdit(note.id, note.text)}
                        aria-label="Изменить заметку"
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-danger-ink"
                        onClick={() => deleteNote(note.id)}
                        aria-label="Удалить заметку"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Пока пусто. Запишите мысль, идею или напоминание на этот день.
            </p>
          )}

          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitNote();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Добавить заметку…"
              aria-label="Новая заметка"
            />
            <Button
              type="submit"
              size="icon"
              className="shrink-0"
              disabled={!draft.trim()}
              aria-label="Добавить заметку"
            >
              <Plus aria-hidden />
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
