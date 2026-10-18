import { describe, it, expect } from 'vitest';
import { createDndAnnouncements } from '@/lib/dndA11y';

type Id = { id: string };
const start = (ann: ReturnType<typeof createDndAnnouncements>) =>
  ann.onDragStart as unknown as (e: { active: Id }) => string;
const over = (ann: ReturnType<typeof createDndAnnouncements>) =>
  ann.onDragOver as unknown as (e: { active: Id; over: Id | null }) => string | undefined;
const end = (ann: ReturnType<typeof createDndAnnouncements>) =>
  ann.onDragEnd as unknown as (e: { active: Id; over: Id | null }) => string;
const cancel = (ann: ReturnType<typeof createDndAnnouncements>) =>
  ann.onDragCancel as unknown as (e: { active: Id }) => string;

const labels = (id: string) => (id === 'a' ? 'Привычка' : undefined);

describe('dndA11y: анонсы для скринридера', () => {
  it('называет элемент по метке, а без метки — словом «элемент»', () => {
    expect(start(createDndAnnouncements(labels))({ active: { id: 'a' } })).toBe(
      'Взято: «Привычка». Перемещайте стрелками вверх и вниз.',
    );
    expect(start(createDndAnnouncements(labels))({ active: { id: 'zzz' } })).toBe(
      'Взято: элемент. Перемещайте стрелками вверх и вниз.',
    );
  });

  it('работает без функции меток', () => {
    expect(start(createDndAnnouncements())({ active: { id: 'a' } })).toBe(
      'Взято: элемент. Перемещайте стрелками вверх и вниз.',
    );
  });

  it('пропускает первое onDragOver сразу после подъёма', () => {
    const ann = createDndAnnouncements(labels);
    start(ann)({ active: { id: 'a' } });
    expect(over(ann)({ active: { id: 'a' }, over: { id: 'b' } })).toBeUndefined();
    expect(over(ann)({ active: { id: 'a' }, over: { id: 'b' } })).toBe('«Привычка»: новая позиция.');
  });

  it('не повторяет анонс для той же позиции', () => {
    const ann = createDndAnnouncements(labels);
    start(ann)({ active: { id: 'a' } });
    over(ann)({ active: { id: 'a' }, over: { id: 'b' } }); // первое, пропущено
    over(ann)({ active: { id: 'a' }, over: { id: 'b' } }); // новая позиция
    expect(over(ann)({ active: { id: 'a' }, over: { id: 'b' } })).toBeUndefined();
    expect(over(ann)({ active: { id: 'a' }, over: { id: 'c' } })).toBe('«Привычка»: новая позиция.');
  });

  it('без цели over молчит', () => {
    const ann = createDndAnnouncements(labels);
    start(ann)({ active: { id: 'a' } });
    over(ann)({ active: { id: 'a' }, over: null }); // первое
    expect(over(ann)({ active: { id: 'a' }, over: null })).toBeUndefined();
  });

  it('сообщает об успешном и отменённом завершении', () => {
    const ann = createDndAnnouncements(labels);
    expect(end(ann)({ active: { id: 'a' }, over: { id: 'b' } })).toBe('«Привычка» перемещено.');
    expect(end(ann)({ active: { id: 'a' }, over: null })).toBe(
      'Перемещение «Привычка» не выполнено.',
    );
    expect(cancel(ann)({ active: { id: 'a' } })).toBe('Перемещение «Привычка» отменено.');
  });
});
