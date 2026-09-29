import type { SectionId } from '@/components/navigation';

const SECTIONS: SectionId[] = ['dashboard', 'habits', 'workouts', 'sheets', 'dayplan'];

/**
 * Адрес, который мы сами записали последним вызовом rememberSection.
 *
 * Событие `navigate` Навигационного API прилетает и на наш собственный
 * `history.replaceState`. Без этого поля подписка читала бы адрес, который
 * только что записала сама, и возвращала раздел назад — с переходом в
 * противоположную сторону. Взгляд на адрес переключается между «Привычки» и
 * «Дашборд», а раздел остаётся прежним: видно, как ползунок меню дёргается
 * туда-обратно и ничего не открывает.
 */
let ownWrite: string | null = null;

/** Ключ адреса без origins: сравнивать нужно путь с параметрами, не полный URL. */
function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

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
 *
 * Обработчику отдаётся именно тот адрес, который браузер собирается открыть:
 * `window.location` во время `navigate` ещё старый, новое значение лежит в
 * `event.destination.url`. Чтение location здесь возвращало бы предыдущий
 * раздел и откатывало бы переход.
 */
export function watchDeepLink(onChange: (search: string) => void): () => void {
  const nav = (window as unknown as { navigation?: EventTarget }).navigation;

  if (nav) {
    const onNavigate = (event: Event) => {
      const dest = (event as Event & { destination?: { url?: string } }).destination?.url;
      const key = dest ? urlKey(dest) : urlKey(window.location.href);
      if (key === ownWrite) return;
      ownWrite = null;
      onChange(new URL(key, window.location.origin).search);
    };
    nav.addEventListener('navigate', onNavigate);
    return () => nav.removeEventListener('navigate', onNavigate);
  }

  const onPopState = () => {
    const key = urlKey(window.location.href);
    if (key === ownWrite) return;
    ownWrite = null;
    onChange(window.location.search);
  };
  window.addEventListener('popstate', onPopState);
  return () => window.removeEventListener('popstate', onPopState);
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
    const key = urlKey(url.href);
    // Адрес уже верный — второй replaceState только разбудил бы подписку.
    if (key === ownWrite) return;
    ownWrite = key;
    window.history.replaceState(null, '', url);
  } catch {
    /* history недоступен — не критично */
  }
}
