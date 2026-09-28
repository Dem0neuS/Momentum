import type { SectionId } from '@/components/navigation';

const SECTIONS: SectionId[] = ['dashboard', 'habits', 'workouts', 'sheets', 'dayplan'];

/** Раздел из ?section= — им пользуются ярлыки манифеста (манифест → shortcuts). */
export function sectionFromLocation(search: string): SectionId | null {
  try {
    const value = new URLSearchParams(search).get('section');
    return SECTIONS.includes(value as SectionId) ? (value as SectionId) : null;
  } catch {
    return null;
  }
}

/**
 * Записывает текущий раздел в адресную строку без перезагрузки.
 * Так работают ярлыки из меню «Пуск» и повторное открытие того же окна.
 */
export function rememberSection(section: SectionId): void {
  try {
    const url = new URL(window.location.href);
    if (section === 'dashboard') url.searchParams.delete('section');
    else url.searchParams.set('section', section);
    window.history.replaceState(null, '', url);
  } catch {
    /* history недоступен — не критично */
  }
}
