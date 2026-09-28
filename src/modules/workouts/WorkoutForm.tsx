import { useEffect, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Save, Trash2 } from 'lucide-react';
import type { Exercise, Workout, WorkoutTemplate, WorkoutType } from '@/lib/types';
import { WORKOUT_TYPES } from '@/lib/types';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { WORKOUT_TYPE_META } from '@/lib/constants';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TemplatesDropdown } from './TemplatesDropdown';
import { uid } from '@/lib/utils';
import { createDndAnnouncements, dndScreenReaderInstructions } from '@/lib/dndA11y';

export function WorkoutForm({
  open,
  onClose,
  workout,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  workout: Workout | null;
  defaultDate: string;
}) {
  const exercises = useWorkoutsStore((s) => s.exercises);
  const addWorkout = useWorkoutsStore((s) => s.addWorkout);
  const updateWorkout = useWorkoutsStore((s) => s.updateWorkout);
  const replaceExercises = useWorkoutsStore((s) => s.replaceExercises);
  const saveTemplateFromWorkout = useWorkoutsStore((s) => s.saveTemplateFromWorkout);

  const [name, setName] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState<WorkoutType>('strength');
  const [notes, setNotes] = useState('');
  // Упражнения остаются черновиком до нажатия «Сохранить». Поэтому «Отмена»
  // действительно ничего не оставляет в IndexedDB, даже если поля уже менялись.
  const [draftExercises, setDraftExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(workout?.name ?? '');
    setDate(workout?.date ?? defaultDate);
    setType(workout?.type ?? 'strength');
    setNotes(workout?.notes ?? '');
    setDraftExercises(
      workout
        ? exercises
            .filter((e) => e.workoutId === workout.id)
            .sort((a, b) => a.order - b.order)
            .map((e) => ({ ...e }))
        : [],
    );
  }, [open, workout, defaultDate, exercises]);

  const sensors = useSensors(
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const addDraftExercise = (partial?: Partial<Exercise>) => {
    setDraftExercises((current) => [
      ...current,
      {
        id: uid(),
        workoutId: workout?.id ?? '',
        name: partial?.name?.trim() || 'Новое упражнение',
        sets: partial?.sets ?? 3,
        reps: partial?.reps ?? 10,
        weight: partial?.weight ?? 0,
        ...(partial?.incline !== undefined ? { incline: partial.incline } : {}),
        ...(partial?.speed !== undefined ? { speed: partial.speed } : {}),
        ...(partial?.distance !== undefined ? { distance: partial.distance } : {}),
        ...(partial?.duration !== undefined ? { duration: partial.duration } : {}),
        ...(partial?.restTime !== undefined ? { restTime: partial.restTime } : {}),
        note: partial?.note ?? '',
        order: current.length,
      },
    ]);
  };

  const applyTemplate = (template: WorkoutTemplate) => {
    if (!workout && !name.trim()) setName(template.name);
    const templateType =
      template.type ??
      (template.exercises.some(hasCardioMetrics) ? 'cardio' : undefined);
    if (templateType) setType(templateType);
    setDraftExercises((current) => [
      ...current,
      ...template.exercises.map((e, i) => ({
        id: uid(),
        workoutId: workout?.id ?? '',
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        ...(e.incline !== undefined ? { incline: e.incline } : {}),
        ...(e.speed !== undefined ? { speed: e.speed } : {}),
        ...(e.distance !== undefined ? { distance: e.distance } : {}),
        ...(e.duration !== undefined ? { duration: e.duration } : {}),
        ...(e.restTime !== undefined ? { restTime: e.restTime } : {}),
        note: e.note ?? '',
        order: current.length + i,
      })),
    ]);
  };

  const updateDraftExercise = (id: string, patch: Partial<Exercise>) => {
    setDraftExercises((current) => current.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const deleteDraftExercise = (id: string) => {
    setDraftExercises((current) => current.filter((e) => e.id !== id).map((e, i) => ({ ...e, order: i })));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setDraftExercises((current) => {
      const oldIndex = current.findIndex((x) => x.id === active.id);
      const newIndex = current.findIndex((x) => x.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex).map((x, i) => ({ ...x, order: i }));
    });
  };

  const save = () => {
    if (!name.trim() && draftExercises.length === 0) return;
    const normalized = draftExercises.map((e, i) => ({ ...e, order: i }));
    if (workout) {
      updateWorkout(workout.id, { name: name.trim() || 'Тренировка', date, type, notes });
      replaceExercises(workout.id, normalized);
    } else {
      const id = addWorkout({ name: name.trim() || 'Тренировка', date, type, notes });
      replaceExercises(
        id,
        normalized.map((e) => ({ ...e, id: uid(), workoutId: id })),
      );
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={workout ? 'Редактировать тренировку' : 'Новая тренировка'}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="gradient" onClick={save}>
            <Save className="h-4 w-4" /> Сохранить
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="workout-name" className="text-xs font-medium text-muted-foreground">Название</label>
            <Input id="workout-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Грудь + трицепс" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="workout-date" className="text-xs font-medium text-muted-foreground">Дата</label>
            <Input id="workout-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="workout-type" className="text-xs font-medium text-muted-foreground">Тип</label>
            <Select
              id="workout-type"
              value={type}
              onChange={(e) => setType(e.target.value as WorkoutType)}
              options={WORKOUT_TYPES.map((t) => ({
                value: t,
                label: WORKOUT_TYPE_META[t].label,
                icon: WORKOUT_TYPE_META[t].emoji,
              }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="workout-notes" className="text-xs font-medium text-muted-foreground">Заметки</label>
            <Input id="workout-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Необязательно" />
          </div>
        </div>

        {/* Упражнения */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Упражнения</p>
            <div className="flex items-center gap-2">
              <TemplatesDropdown
                workoutId={workout?.id}
                onApplied={applyTemplate}
                onSaveTemplate={
                  workout
                    ? () => saveTemplateFromWorkout(workout.id, name.trim() || workout.name, draftExercises)
                    : undefined
                }
              />
              <Button variant="outline" size="sm" onClick={() => addDraftExercise()}>
                + Упражнение
              </Button>
            </div>
          </div>

          {draftExercises.length === 0 && (
            <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
              Добавьте упражнения или примените шаблон. Можно создать тренировку и без них.
            </p>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{
              screenReaderInstructions: dndScreenReaderInstructions,
              announcements: createDndAnnouncements(
                (id) => draftExercises.find((e) => e.id === id)?.name,
              ),
            }}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={draftExercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {draftExercises.map((ex, i) => (
                  <ExerciseRow
                    key={ex.id}
                    ex={ex}
                    index={i}
                    type={type}
                    onUpdate={(patch) => updateDraftExercise(ex.id, patch)}
                    onDelete={() => deleteDraftExercise(ex.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </Dialog>
  );
}

function hasCardioMetrics(exercise: Partial<Exercise>): boolean {
  return (
    exercise.incline !== undefined ||
    exercise.speed !== undefined ||
    exercise.distance !== undefined ||
    exercise.duration !== undefined
  );
}

function ExerciseRow({
  ex,
  index,
  type,
  onUpdate,
  onDelete,
}: {
  ex: Exercise;
  index: number;
  type: WorkoutType;
  onUpdate: (patch: Partial<Exercise>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/40 p-2.5"
    >
      <button {...attributes} {...listeners} data-drag-handle className="mt-3 flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/50 hover:bg-accent hover:text-foreground sm:mt-4 sm:h-8 sm:w-8" aria-label={`Переместить «${ex.name || 'упражнение'}»`}>
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary-ink">
            {index + 1}
          </span>
          <Input
            className="h-field flex-1 rounded-md text-sm sm:h-8"
            value={ex.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Название упражнения"
          />
        </div>
        {type === 'cardio' ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NumberField
              label="Угол наклона, °"
              value={ex.incline ?? 0}
              onChange={(v) => onUpdate({ incline: v })}
              allowFloat
              step={0.1}
            />
            <NumberField
              label="Скорость, км/ч"
              value={ex.speed ?? 0}
              onChange={(v) => onUpdate({ speed: v })}
              allowFloat
              step={0.1}
            />
            <NumberField
              label="Расстояние, км"
              value={ex.distance ?? 0}
              onChange={(v) => onUpdate({ distance: v })}
              allowFloat
              step={0.01}
            />
            <NumberField
              label="Время, мин"
              value={ex.duration ?? 0}
              onChange={(v) => onUpdate({ duration: v })}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NumberField label="Подходы" value={ex.sets} onChange={(v) => onUpdate({ sets: v })} />
            <NumberField label="Повтор." value={ex.reps} onChange={(v) => onUpdate({ reps: v })} />
            <NumberField label="Вес, кг" value={ex.weight} onChange={(v) => onUpdate({ weight: v })} allowFloat />
            <NumberField
              label="Отдых, сек"
              value={ex.restTime ?? 0}
              onChange={(v) => onUpdate({ restTime: v })}
              step={15}
            />
          </div>
        )}
      </div>
      <button type="button" onClick={onDelete} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-danger-soft hover:text-danger-ink sm:h-8 sm:w-8" aria-label="Удалить упражнение">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  allowFloat,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  allowFloat?: boolean;
  step?: number;
}) {
  const inputStep = step ?? (allowFloat ? 0.5 : 1);

  return (
    <div className="space-y-0.5">
      <span className="flex h-8 items-end text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        min={0}
        step={inputStep}
        aria-label={label}
        className="h-field rounded-md text-sm sm:h-8"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
      />
    </div>
  );
}
