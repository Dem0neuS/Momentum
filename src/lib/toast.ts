/**
 * Уведомления с отменой действия (undo).
 * Каждое действие кладётся в историю сессии и показывает тост с кнопкой «Отменить».
 * Горячая клавиша Ctrl+Z / Cmd+Z вызывает то же самое undo из истории.
 */
import { toast } from 'sonner';
import { useHistoryStore } from '@/store/historyStore';
import { useSettingsStore } from '@/store/settingsStore';

export function stateLabel(undo: boolean): string {
  return undo ? 'Отменить' : 'Отменено';
}

/** Показать тост с кнопкой «Отменить». Возвращает id действия в истории. */
export function toastWithUndo(
  label: string,
  undo: () => void,
  opts?: { description?: string; icon?: React.ReactNode },
): void {
  const timeoutMs = useSettingsStore.getState().settings.undoTimeoutMs;
  const actionId = useHistoryStore.getState().push({ label, undo });

  toast(label, {
    description: opts?.description,
    icon: opts?.icon,
    duration: timeoutMs,
    action: {
      label: 'Отменить',
      onClick: () => {
        useHistoryStore.getState().undoById(actionId);
      },
    },
  });
}

/** Простое уведомление с несколькими кнопками (например, «серия прервалась») */
export function toastWithActions(
  title: string,
  actions: { label: string; onClick: () => void }[],
  opts?: { description?: string },
): void {
  const [first, ...rest] = actions;
  toast(title, {
    description: opts?.description,
    duration: 7000,
    action: first ? { label: first.label, onClick: first.onClick } : undefined,
    cancel: rest[0]
      ? {
          label: rest[0].label,
          onClick: rest[0].onClick,
        }
      : undefined,
  });
}

export function toastSimple(title: string, description?: string): void {
  toast(title, { description });
}