import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core';

/** Инструкция для скринридера при фокусе на ручке перетаскивания. */
export const dndScreenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'Нажмите пробел, чтобы взять элемент. Стрелки перемещают элемент, пробел или Enter отпускают его, Escape отменяет перемещение.',
};

function resolveLabel(getLabel: ((id: string) => string | undefined) | undefined, id: unknown): string {
  const value = getLabel?.(String(id))?.trim();
  return value ? `«${value}»` : 'элемент';
}

/**
 * Русские анонсы для скринридера вместо дефолтных dnd-kit,
 * которые проговаривают служебные идентификаторы (UUID).
 */
export function createDndAnnouncements(
  getLabel?: (id: string) => string | undefined,
): Announcements {
  let lastOverId: string | null = null;
  let awaitingFirstOver = false;

  return {
    onDragStart: ({ active }) => {
      lastOverId = null;
      awaitingFirstOver = true;
      return `Взято: ${resolveLabel(getLabel, active.id)}. Перемещайте стрелками вверх и вниз.`;
    },
    onDragOver: ({ active, over }) => {
      // Первое срабатывание сразу после подъёма перебивает сообщение о взятии — пропускаем.
      if (awaitingFirstOver) {
        awaitingFirstOver = false;
        return undefined;
      }
      if (!over) {
        lastOverId = null;
        return undefined;
      }
      const overId = String(over.id);
      if (overId === lastOverId) return undefined;
      lastOverId = overId;
      return `${resolveLabel(getLabel, active.id)}: новая позиция.`;
    },
    onDragEnd: ({ active, over }) => {
      awaitingFirstOver = false;
      return over
        ? `${resolveLabel(getLabel, active.id)} перемещено.`
        : `Перемещение ${resolveLabel(getLabel, active.id)} не выполнено.`;
    },
    onDragCancel: ({ active }) => {
      awaitingFirstOver = false;
      return `Перемещение ${resolveLabel(getLabel, active.id)} отменено.`;
    },
  };
}
