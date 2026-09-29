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
 * Подписка на смену раздела в адресной строке.
 *
 * Одного `popstate` мало. Ярлык из манифеста открывает адрес, отличающийся от
 * текущего только параметром `?section=`, и такой переход браузер выполняет
 * **внутри документа**: приложение не перезагружается, состояние не меняется,
 * а `popstate` при этом не срабатывает (он бывает только при обходе истории).
 * Навигационный API присылает для таких переходов событие `navigate` — им и
 * пользуемся. Там, где API нет, остаётся `popstate`.
 */
export function watchDeepLink(onChange: () => void): () => void {
  const nav = (window as unknown as { navigation?: EventTarget }).navigation;
  if (nav) {
    const onNavigate = () => onChange();
    nav.addEventListener('navigate', onNavigate);
    return () => nav.removeEventListener('navigate', onNavigate);
  }
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
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
