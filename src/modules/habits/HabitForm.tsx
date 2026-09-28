import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Habit } from '@/lib/types';
import { useHabitsStore } from '@/store/habitsStore';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/ui/label';
import { ColorPicker } from '@/components/ui/color-picker';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { WEEKDAY_SHORT } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function HabitForm({
  open,
  onClose,
  habit,
  defaultCategoryId,
}: {
  open: boolean;
  onClose: () => void;
  habit?: Habit | null;
  defaultCategoryId?: string | null;
}) {
  const categories = useHabitsStore((s) => s.categories);
  const subcategories = useHabitsStore((s) => s.subcategories);
  const addHabit = useHabitsStore((s) => s.addHabit);
  const updateHabit = useHabitsStore((s) => s.updateHabit);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💧');
  const [color, setColor] = useState('#6C4DF6');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [freqType, setFreqType] = useState<'daily' | 'days' | 'timesPerWeek'>('daily');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [times, setTimes] = useState(3);
  const [targetCount, setTargetCount] = useState(0);
  const [counterUnit, setCounterUnit] = useState('');
  const [allowSkips, setAllowSkips] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (habit) {
      setName(habit.name);
      setIcon(habit.icon);
      setColor(habit.color);
      setCategoryId(habit.categoryId ?? '');
      setSubcategoryId(habit.subcategoryId ?? '');
      const f = habit.frequency;
      setFreqType(f.type);
      setDays(f.type === 'days' ? f.days : [1, 2, 3, 4, 5, 6, 7]);
      setTimes(f.type === 'timesPerWeek' ? f.times : 3);
      setTargetCount(habit.targetCount);
      setCounterUnit(habit.counterUnit);
      setAllowSkips(habit.allowSkips);
    } else {
      setName('');
      setIcon('💧');
      setColor('#6C4DF6');
      setCategoryId(defaultCategoryId ?? '');
      setSubcategoryId('');
      setFreqType('daily');
      setDays([1, 2, 3, 4, 5, 6, 7]);
      setTimes(3);
      setTargetCount(0);
      setCounterUnit('');
      setAllowSkips(true);
    }
  }, [open, habit, defaultCategoryId]);

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Без категории' },
      ...categories
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })),
    ],
    [categories],
  );

  const subOptions = useMemo(
    () => subcategories.filter((sc) => sc.categoryId === categoryId).map((sc) => ({ value: sc.id, label: `${sc.icon} ${sc.name}` })),
    [subcategories, categoryId],
  );

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Введите название привычки');
      return;
    }
    const frequency =
      freqType === 'daily'
        ? { type: 'daily' as const }
        : freqType === 'days'
          ? { type: 'days' as const, days: days.length ? days : [1, 2, 3, 4, 5, 6, 7] }
          : { type: 'timesPerWeek' as const, times: Math.max(1, times) };

    const payload = {
      name: trimmed,
      icon: icon || '⭐',
      color,
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      frequency,
      targetCount: Math.max(0, targetCount),
      counterUnit: targetCount > 0 ? counterUnit : '',
      allowSkips,
    };

    if (habit) {
      updateHabit(habit.id, payload);
      toast('Привычка обновлена');
    } else {
      addHabit(payload);
      toast('Привычка создана');
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={habit ? 'Редактировать привычку' : 'Новая привычка'}
      description={habit ? habit.name : 'Что будете делать регулярно?'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button variant="gradient" onClick={submit}>{habit ? 'Сохранить' : 'Создать'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Название">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Например, Пить воду"
            maxLength={60}
          />
        </Field>

        <Field label="Иконка">
          <EmojiPicker value={icon} onChange={setIcon} />
        </Field>

        <Field label="Цвет">
          <ColorPicker value={color} onChange={setColor} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Категория">
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId('');
              }}
              options={categoryOptions}
            />
          </Field>
          <Field label="Подкатегория">
            <Select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              options={[
                { value: '', label: '— нет —' },
                ...subOptions,
              ]}
              disabled={!categoryId}
            />
          </Field>
        </div>

        <Field label="Частота">
          <Select
            value={freqType}
            onChange={(e) => setFreqType(e.target.value as typeof freqType)}
            options={[
              { value: 'daily', label: 'Ежедневно' },
              { value: 'days', label: 'По дням недели' },
              { value: 'timesPerWeek', label: 'N раз в неделю' },
            ]}
          />
        </Field>

        {freqType === 'days' && (
          <Field label="Дни недели">
            <div className="flex gap-1.5">
              {WEEKDAY_SHORT.map((label, i) => {
                const iso = i + 1;
                const active = days.includes(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() =>
                      setDays((d) => (active ? d.filter((x) => x !== iso) : [...d, iso]))
                    }
                    className={cn(
                      'flex h-11 flex-1 items-center justify-center rounded-md text-xs font-medium transition-all sm:h-9',
                      active
                        ? 'bg-brand text-on-brand shadow-card'
                        : 'bg-secondary text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {freqType === 'timesPerWeek' && (
          <Field label="Сколько раз в неделю">
            <Input
              type="number"
              min={1}
              max={7}
              value={times}
              onChange={(e) => setTimes(Number(e.target.value))}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Цель-счётчик" hint="0 — просто галочка">
            <Input
              type="number"
              min={0}
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
            />
          </Field>
          {targetCount > 0 && (
            <Field label="Единица">
              <Input
                value={counterUnit}
                onChange={(e) => setCounterUnit(e.target.value)}
                placeholder="стаканов, минут…"
                maxLength={20}
              />
            </Field>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-medium">Разрешить пропуски</p>
            <p className="text-xs text-muted-foreground">Пропуск не разрывает серию</p>
          </div>
          <Switch
            checked={allowSkips}
            onCheckedChange={setAllowSkips}
            label="Разрешить пропуски"
          />
        </div>
      </div>
    </Dialog>
  );
}