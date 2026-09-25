import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Minus, Pencil, Plus, X } from 'lucide-react';
import type { Habit, HabitLog } from '@/lib/types';
import { ProgressRing } from '@/components/ProgressRing';
import { useHabitsStore } from '@/store/habitsStore';
import { useLongPress } from '@/lib/hooks';
import { vibrate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type RingMenu = 'counter' | 'skip' | null;

/** Сдержанная вспышка частиц при завершении */
function Burst({ trigger, color }: { trigger: boolean; color: string }) {
  if (!trigger) return null;
  const dots = 7;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {Array.from({ length: dots }).map((_, i) => {
        const angle = (i / dots) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * 26, y: Math.sin(angle) * 26, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

export function HabitRing({
  habit,
  log,
  date,
  size = 46,
  onOpenSkip,
  className,
}: {
  habit: Habit;
  log?: HabitLog;
  date: string;
  size?: number;
  onOpenSkip?: () => void;
  className?: string;
}) {
  const [menu, setMenu] = useState<RingMenu>(null);
  const [inputMode, setInputMode] = useState(false);
  const [value, setValue] = useState('');
  const store = useHabitsStore;

  const target = habit.targetCount;
  const isCounter = target > 0;
  const valueNow = log?.value ?? 0;
  const status = log?.status ?? 'none';
  const done = status === 'done';
  const skipped = status === 'skipped';
  const progress = isCounter ? Math.min(1, valueNow / target) : done ? 1 : 0;

  // Вспышка частиц при переходе в «выполнено»
  const [burstKey, setBurstKey] = useState(0);
  const justCompleted = done;

  const color = skipped ? '#94A3B8' : habit.color;

  const handleClick = () => {
    if (skipped) {
      // Снять пропуск по тапу
      useHabitsStore.getState().setLogStatus(habit.id, date, 'none');
      return;
    }
    if (isCounter) {
      setMenu((m) => (m === 'counter' ? null : 'counter'));
      return;
    }
    useHabitsStore.getState().toggleHabit(habit.id, date);
  };

  const longPress = useLongPress(() => {
    if (habit.allowSkips) {
      onOpenSkip?.();
    }
  }, 480);

  const quick = (fn: () => void) => {
    fn();
    vibrate(6);
  };

  return (
    <div className={cn('relative inline-flex', className)}>
      <div
        {...longPress}
        onClick={handleClick}
        className="cursor-pointer select-none rounded-full outline-none [touch-action:manipulation]"
        title={
          skipped
            ? 'Пропуск. Нажмите, чтобы снять'
            : isCounter
              ? `${valueNow}/${target}`
              : done
                ? 'Выполнено'
                : 'Отметить'
        }
      >
        <ProgressRing
          size={size}
          progress={done || skipped ? 1 : progress}
          color={color}
          glow={done}
          trackColor={skipped ? '#94A3B8' : undefined}
        >
          <motion.div
            key={`${habit.id}-${date}-${status}-${done ? 'done' : 'open'}`}
            animate={{ scale: [0.85, 1] }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            onAnimationComplete={() => {
              if (justCompleted && !skipped) {
                setBurstKey((k) => k + 1);
                vibrate(12);
              }
            }}
            className="flex items-center justify-center"
            style={{ color }}
          >
            {skipped ? (
              <span className="font-semibold" style={{ fontSize: size * 0.42 }}>
                –
              </span>
            ) : done ? (
              <Check strokeWidth={3.2} style={{ width: size * 0.44, height: size * 0.44 }} />
            ) : isCounter && valueNow > 0 ? (
              <span className="font-semibold" style={{ fontSize: size * 0.3, color }}>
                {valueNow}/{target}
              </span>
            ) : null}
          </motion.div>
        </ProgressRing>
      </div>

      <Burst key={burstKey} trigger={burstKey > 0} color={habit.color} />

      {/* Быстрое меню счётчика */}
      <AnimatePresence>
        {menu === 'counter' && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full z-30 mt-1.5 w-44 rounded-xl border border-border/70 bg-popover p-2 shadow-soft-lg"
          >
            {inputMode ? (
              <div className="flex gap-1.5">
                <Input
                  autoFocus
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      quick(() => store.getState().setHabitValue(habit.id, date, Number(value || 0)));
                      setInputMode(false);
                      setMenu(null);
                    }
                    if (e.key === 'Escape') setInputMode(false);
                  }}
                  placeholder={String(target)}
                  className="h-8 text-xs"
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setInputMode(false)}
                  aria-label="Закрыть ввод"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                <Button size="sm" variant="outline" onClick={() => quick(() => store.getState().decrementHabit(habit.id, date))}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => quick(() => store.getState().incrementHabit(habit.id, date))}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="gradient" onClick={() => quick(() => store.getState().setFull(habit.id, date, true))} title="Отметить полностью">
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="mt-1.5 space-y-1">
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-start text-xs text-muted-foreground"
                onClick={() => {
                  setInputMode(true);
                  setValue(String(valueNow));
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Ввести значение
              </Button>
              <button
                className="w-full rounded-lg px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
                onClick={() => {
                  setMenu(null);
                  habit.allowSkips ? onOpenSkip?.() : store.getState().setLogStatus(habit.id, date, 'none');
                }}
              >
                Пропустить день
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}