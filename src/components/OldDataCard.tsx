import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArchiveRestore, Loader2, Search } from 'lucide-react';
import { Button } from './ui/button';
import { ConfirmDialog } from './ui/confirm-dialog';
import { useSettingsStore } from '@/store/settingsStore';
import { useHistoryStore } from '@/store/historyStore';
import { collectAllData } from '@/db/db';
import { mergeLocalData, replaceLocalData, syncNow } from '@/sync/engine';
import { reloadAll } from '@/lib/boot';
import { downloadJson } from '@/lib/utils';
import { todayKey } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { oldDataBridge, recoveredBackup, type OldDataOrigin } from '@/lib/oldData';

/** Какие счётчики показывать и в каком порядке. */
const COUNT_ORDER = [
  'habits',
  'habitLogs',
  'workouts',
  'dayPlans',
  'calendarNotes',
  'sheets',
  'cells',
  'exercises',
  'dayPlanItems',
  'workoutTemplates',
  'categories',
  'subcategories',
  'streaks',
] as const;

const COUNT_LABELS: Record<string, [string, string, string]> = {
  habits: ['привычка', 'привычки', 'привычек'],
  habitLogs: ['отметка', 'отметки', 'отметок'],
  workouts: ['тренировка', 'тренировки', 'тренировок'],
  exercises: ['упражнение', 'упражнения', 'упражнений'],
  workoutTemplates: ['шаблон', 'шаблона', 'шаблонов'],
  sheets: ['таблица', 'таблицы', 'таблиц'],
  cells: ['ячейка', 'ячейки', 'ячеек'],
  dayPlans: ['план', 'плана', 'планов'],
  dayPlanItems: ['пункт', 'пункта', 'пунктов'],
  calendarNotes: ['заметка', 'заметки', 'заметок'],
  categories: ['категория', 'категории', 'категорий'],
  subcategories: ['подкатегория', 'подкатегории', 'подкатегорий'],
  streaks: ['серия', 'серии', 'серий'],
};

type Mode = 'merge' | 'replace';

interface Pending {
  origin: OldDataOrigin;
  mode: Mode;
}

/**
 * Поиск и восстановление данных из прошлых запусков десктопной версии.
 *
 * В веб-версии и PWA профиль Chromium недоступен, поэтому карточка там не
 * рисуется. Сканирование запускается только по кнопке: это небыстрая
 * операция, которая поднимает временные серверы на старых портах.
 */
export function OldDataCard() {
  const settings = useSettingsStore((s) => s.settings);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [origins, setOrigins] = useState<OldDataOrigin[]>([]);
  const [currentPort, setCurrentPort] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busyPort, setBusyPort] = useState<number | null>(null);
  const [restored, setRestored] = useState<Record<number, number>>({});
  const [pending, setPending] = useState<Pending | null>(null);

  const bridge = oldDataBridge();
  const sorted = useMemo(
    () =>
      [...origins].sort(
        (a, b) => (b.total ?? 0) - (a.total ?? 0) || b.at - a.at,
      ),
    [origins],
  );
  const useful = sorted.filter((o) => (o.total ?? 0) > 0);
  const empty = sorted.filter((o) => (o.total ?? 0) === 0);
  const shown = showAll ? useful : useful.slice(0, 6);

  if (!bridge) return null;

  const scan = async () => {
    setScanning(true);
    setScanned(false);
    setError(null);
    setOrigins([]);
    setRestored({});
    setShowAll(false);
    try {
      const result = await bridge.scanOldData();
      setOrigins(result.origins ?? []);
      setCurrentPort(result.currentPort ?? 0);
      setScanned(true);
    } catch (e) {
      console.error(e);
      setError('Не удалось проверить старые копии.');
    } finally {
      setScanning(false);
    }
  };

  const restore = async (origin: OldDataOrigin, mode: Mode) => {
    setBusyPort(origin.port);
    try {
      const payload = await bridge.readOldData(origin.port);
      if (payload.error) throw new Error(payload.error);

      const parsed = recoveredBackup(payload, settings);
      if (!parsed.ok) throw new Error(parsed.error);

      if (mode === 'replace') {
        // Замена необратима без файла: сохраняем текущие данные в загрузки,
        // как и обычный экспорт. Импорт из JSON потом вернёт их обратно.
        downloadJson(`momentum-before-restore-${todayKey()}.json`, await collectAllData(settings));
        await replaceLocalData(parsed.data);
        useHistoryStore.getState().clear();
        await reloadAll();
        syncNow();
        toast('Данные заменены. Копия прежних данных сохранена в JSON');
      } else {
        const added = await mergeLocalData(parsed.data);
        useHistoryStore.getState().clear();
        await reloadAll();
        syncNow();
        setRestored((prev) => ({ ...prev, [origin.port]: added }));
        toast(
          added > 0
            ? `Добавлено ${added} ${plural(added, ['запись', 'записи', 'записей'])}`
            : 'Новых записей нет',
        );
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Не удалось восстановить данные');
    } finally {
      setBusyPort(null);
    }
  };

  return (
    <>
      <div className="space-y-3 rounded-xl border border-border/60 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <ArchiveRestore className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Старые данные на компьютере</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              До версии 1.0.7 приложение при каждом запуске меняло адрес и могло оставить
              данные в прошлых копиях. Найдём их и восстановим выбранную.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={scanning} onClick={() => void scan()}>
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {scanning ? 'Ищем…' : scanned ? 'Проверить снова' : 'Найти старые данные'}
          </Button>
          {scanned && currentPort > 0 && (
            <span className="text-xs text-muted-foreground">
              Текущая база — 127.0.0.1:{currentPort}
            </span>
          )}
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive-ink">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {error}
          </p>
        )}

        {scanned && useful.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Копий с данными не найдено. Пустые базы остаются в профиле, но восстанавливать в
            них нечего.
          </p>
        )}

        {shown.length > 0 && (
          <div className="space-y-2">
            {shown.map((origin) => {
              const busy = busyPort === origin.port;
              const added = restored[origin.port];
              return (
                <div
                  key={origin.port}
                  className="rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">127.0.0.1:{origin.port}</p>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        {whenLabel(origin.at)} · {summaryOf(origin.counts)}
                      </p>
                      {looksLikeSeed(origin) && (
                        <p className="mt-0.5 text-[11px] text-warning-ink">
                          Похоже, здесь только стартовые привычки — без отметок и планов.
                        </p>
                      )}
                      {origin.error && (
                        <p className="mt-0.5 text-[11px] text-destructive-ink">{origin.error}</p>
                      )}
                      {added !== undefined && (
                        <p className="mt-0.5 text-[11px] text-done-ink">
                          {added > 0
                            ? `Добавлено ${added} ${plural(added, ['запись', 'записи', 'записей'])}`
                            : 'Новых записей не было'}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || Boolean(origin.error)}
                      onClick={() => setPending({ origin, mode: 'merge' })}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Добавить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      disabled={busy || Boolean(origin.error)}
                      onClick={() => setPending({ origin, mode: 'replace' })}
                    >
                      Заменить
                    </Button>
                  </div>
                </div>
              );
            })}
            {!showAll && useful.length > shown.length && (
              <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
                Показать все ({useful.length})
              </Button>
            )}
          </div>
        )}

        {empty.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">
              Пустые копии ({empty.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {empty.map((origin) => (
                <li key={origin.port} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">127.0.0.1:{origin.port}</span>
                  <span>{whenLabel(origin.at)}</span>
                  {origin.error && <span className="text-destructive-ink">{origin.error}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending?.mode === 'replace' ? 'Заменить текущие данные?' : 'Добавить старые данные?'}
        message={
          pending?.mode === 'replace'
            ? 'Текущие привычки, тренировки, таблицы и планы будут заменены данными из копии. Перед заменой приложение сохранит JSON-бэкап текущих данных в загрузки. Если включена синхронизация, изменения уйдут в аккаунт.'
            : 'Текущие данные останутся. Добавятся только записи, которых сейчас нет; настройки и имя профиля не изменятся.'
        }
        confirmLabel={pending?.mode === 'replace' ? 'Заменить' : 'Добавить'}
        danger={pending?.mode === 'replace'}
        onConfirm={() => {
          if (pending) void restore(pending.origin, pending.mode);
        }}
      />
    </>
  );
}

function whenLabel(at: number): string {
  return new Date(at).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summaryOf(counts: Record<string, number> | undefined): string {
  if (!counts) return 'данных нет';
  const parts: string[] = [];
  for (const key of COUNT_ORDER) {
    const value = counts[key] ?? 0;
    if (value <= 0) continue;
    const forms = COUNT_LABELS[key];
    if (!forms) continue;
    parts.push(`${value} ${plural(value, forms)}`);
  }
  if (parts.length === 0) return 'данных нет';
  const head = parts.slice(0, 4).join(' · ');
  return parts.length > 4 ? `${head} · ещё ${parts.length - 4}` : head;
}

/**
 * Похоже на свежую базу сразу после первого запуска: восемь категорий,
 * четыре подкатегории, четыре стартовые привычки и ни одной пользовательской
 * записи. Это не приговор — кнопки остаются, но человеку полезно знать, что
 * «данных» здесь только стартовый набор.
 */
function looksLikeSeed(origin: OldDataOrigin): boolean {
  const counts = origin.counts ?? {};
  if ((origin.total ?? 0) !== 20) return false;
  if (counts.categories !== 8 || counts.subcategories !== 4) return false;
  if (counts.habits !== 4 || counts.streaks !== 4) return false;
  return [
    'habitLogs',
    'workouts',
    'exercises',
    'workoutTemplates',
    'sheets',
    'cells',
    'dayPlans',
    'dayPlanItems',
    'calendarNotes',
  ].every((key) => !counts[key]);
}
