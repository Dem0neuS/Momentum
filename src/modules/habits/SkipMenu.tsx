import { useState } from 'react';
import { ArrowLeft, Ban } from 'lucide-react';
import type { Habit } from '@/lib/types';
import { SKIP_REASONS } from '@/lib/constants';
import { useHabitsStore } from '@/store/habitsStore';
import { Dialog } from '@/components/ui/dialog';
import { toastSimple } from '@/lib/toast';

/** Список причин пропуска (используется в меню пропуска и heatmap) */
export function SkipReasons({
  habit,
  date,
  onDone,
  onBack,
}: {
  habit: Habit;
  date: string;
  onDone: () => void;
  onBack?: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  const apply = (reason?: string) => {
    useHabitsStore.getState().skipHabit(habit.id, date, reason);
    onDone();
  };

  return (
    <div className="space-y-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-tap items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Назад
        </button>
      )}
      <p className="text-sm font-medium">Пропустить «{habit.name}»?</p>
      <p className="text-xs text-muted-foreground">
        Пропуск не считается выполнением, но и не разрывает серию.
      </p>
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => apply()}
          className="min-h-tap w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
        >
          Без причины
        </button>
        {SKIP_REASONS.filter((r) => r.value !== 'Свой вариант').map((r) => (
          <button
            type="button"
            key={r.value}
            onClick={() => apply(r.value)}
            className="flex min-h-tap w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
          >
            <span>{r.icon}</span> {r.value}
          </button>
        ))}
        {!custom ? (
          <button
            type="button"
            onClick={() => setCustom(true)}
            className="min-h-tap w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
          >
            ✍️ Свой вариант…
          </button>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (customText.trim()) apply(customText.trim());
            }}
          >
            <input
              autoFocus
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Причина пропуска"
              className="h-field flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
            <button
              type="submit"
              className="min-h-tap rounded-lg bg-primary px-3 text-sm text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              Ок
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Диалог пропуска дня (свайп, долгое нажатие, правый клик, кнопка) */
export function SkipMenuDialog({
  open,
  onClose,
  habit,
  date,
}: {
  open: boolean;
  onClose: () => void;
  habit: Habit | null;
  date: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="sm" hideClose ariaLabel="Пропуск дня">
      {habit ? (
        <>
          <div className="mb-2 flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: `${habit.color}22` }}
            >
              {habit.icon}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{habit.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Ban className="h-3 w-3" /> Пропуск дня
              </p>
            </div>
          </div>
          <SkipReasons
            habit={habit}
            date={date}
            onDone={onClose}
            onBack={() => {
              toastSimple('Пропуск отменён');
              onClose();
            }}
          />
        </>
      ) : null}
    </Dialog>
  );
}