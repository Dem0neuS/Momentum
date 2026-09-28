import { Layers, Play, Save, Trash2 } from 'lucide-react';
import type { WorkoutTemplate } from '@/lib/types';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { Menu } from '@/components/ui/menu';
import { toastSimple } from '@/lib/toast';

export function TemplatesDropdown({
  workoutId,
  onApplied,
  onSaveTemplate,
}: {
  workoutId?: string;
  onApplied?: (tpl: WorkoutTemplate) => void;
  onSaveTemplate?: () => void;
}) {
  const templates = useWorkoutsStore((s) => s.templates);
  const saveTemplateFromWorkout = useWorkoutsStore((s) => s.saveTemplateFromWorkout);
  const deleteTemplate = useWorkoutsStore((s) => s.deleteTemplate);

  if (templates.length === 0 && !workoutId) return null;

  return (
    <Menu
      align="end"
      trigger={
        <button
          type="button"
          className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-border/70 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-8"
          aria-label="Шаблоны тренировок"
        >
          <Layers className="h-3.5 w-3.5" />
          Шаблоны
        </button>
      }
      panelClassName="max-h-[70vh] overflow-auto"
      items={[
        ...(workoutId
          ? [
              {
                label: 'Сохранить как шаблон',
                icon: <Save />,
                onClick: () => (onSaveTemplate ? onSaveTemplate() : saveTemplateFromWorkout(workoutId)),
              },
              ...(templates.length > 0 ? [{ separator: true }] : []),
            ]
          : []),
        ...templates.map((t) => ({
          label: `${t.name} (${t.exercises.length} упр.)`,
          icon: <Play />,
          onClick: () => {
            if (onApplied) onApplied(t);
            else toastSimple('Нет получателя', 'Откройте форму тренировки');
          },
        })),
        ...(templates.length > 0
          ? [
              { separator: true },
              ...templates.map((t) => ({
                label: `Удалить «${t.name}»`,
                icon: <Trash2 />,
                danger: true,
                onClick: () => {
                  if (globalThis.confirm(`Удалить шаблон «${t.name}»?`)) deleteTemplate(t.id);
                },
              })),
            ]
          : []),
      ]}
    />
  );
}