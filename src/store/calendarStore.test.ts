import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { useCalendarStore } from '@/store/calendarStore';
import { useHistoryStore } from '@/store/historyStore';
import { todayKey } from '@/lib/dates';

const DATE = '2026-11-09';
const OTHER_DATE = '2026-11-10';

const initial = {
  loaded: false,
  notes: [],
  selectedDate: todayKey(),
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  useCalendarStore.setState(initial);
  useHistoryStore.getState().clear();
});

describe('calendarStore: заметки', () => {
  it('добавляет несколько заметок на один день', async () => {
    const store = useCalendarStore.getState();
    store.addNote(DATE, 'Позвонить в сервис');
    store.addNote(DATE, 'Купить хлеб');
    store.addNote(OTHER_DATE, 'Другая дата');

    expect(useCalendarStore.getState().notesFor(DATE)).toHaveLength(2);
    expect(useCalendarStore.getState().notesFor(OTHER_DATE)).toHaveLength(1);

    await vi.waitFor(async () => {
      expect(await db.calendarNotes.where('date').equals(DATE).count()).toBe(2);
    });
  });

  it('не сохраняет пустую заметку', async () => {
    useCalendarStore.getState().addNote(DATE, '   ');
    expect(useCalendarStore.getState().notes).toHaveLength(0);
    expect(await db.calendarNotes.count()).toBe(0);
  });

  it('переживает перезагрузку стора', async () => {
    useCalendarStore.getState().addNote(DATE, 'Запись');
    await vi.waitFor(async () => {
      expect(await db.calendarNotes.count()).toBe(1);
    });

    useCalendarStore.setState(initial);
    await useCalendarStore.getState().load();

    const notes = useCalendarStore.getState().notesFor(DATE);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe('Запись');
  });

  it('редактирует заметку в сторе и в базе', async () => {
    useCalendarStore.getState().addNote(DATE, 'Черновик');
    const note = useCalendarStore.getState().notes[0];
    useCalendarStore.getState().updateNote(note.id, '  Готовый текст  ');

    expect(useCalendarStore.getState().notes[0].text).toBe('Готовый текст');
    await vi.waitFor(async () => {
      expect((await db.calendarNotes.get(note.id))?.text).toBe('Готовый текст');
    });
  });

  it('удаляет заметку, а отмена возвращает её', async () => {
    useCalendarStore.getState().addNote(DATE, 'Удалить меня');
    const note = useCalendarStore.getState().notes[0];

    useCalendarStore.getState().deleteNote(note.id);
    expect(useCalendarStore.getState().notes).toHaveLength(0);
    await vi.waitFor(async () => {
      expect(await db.calendarNotes.count()).toBe(0);
    });

    expect(useHistoryStore.getState().undo()).toBe(true);
    await vi.waitFor(async () => {
      expect(await db.calendarNotes.count()).toBe(1);
    });
    expect(useCalendarStore.getState().notesFor(DATE)[0].text).toBe('Удалить меня');
  });

  it('выбранная дата не сбрасывается при повторной загрузке', () => {
    useCalendarStore.getState().setSelectedDate(DATE);
    useCalendarStore.getState().load();
    expect(useCalendarStore.getState().selectedDate).toBe(DATE);
  });
});
