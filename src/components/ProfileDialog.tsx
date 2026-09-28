import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  CalendarCheck2,
  Database,
  Download,
  Flame,
  HardDrive,
  RefreshCw,
  Upload,
  Dumbbell,
} from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Field } from './ui/label';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Switch } from './ui/switch';
import { ConfirmDialog } from './ui/confirm-dialog';
import { AccountCard, ChangePasswordCard, RecoveryCard } from './AccountCard';
import { InstallAppCard } from './InstallAppCard';
import { UpdateAppCard } from './UpdateAppCard';
import { useSettingsStore } from '@/store/settingsStore';
import { useHistoryStore } from '@/store/historyStore';
import { useHabitsStore } from '@/store/habitsStore';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { useAuthStore } from '@/store/authStore';
import { collectAllData, replaceAllData, clearAllData } from '@/db/db';
import { downloadJson, readJsonFile } from '@/lib/utils';
import { todayKey } from '@/lib/dates';
import { reloadAll, initApp } from '@/lib/boot';
import { computeMetrics, formatBytes, initialsOf, storageUsed } from '@/lib/metrics';
import { cn } from '@/lib/utils';
import type { ThemeMode } from '@/lib/types';

type Section = 'account' | 'settings' | 'data' | 'danger';

const SECTIONS: { id: Section; title: string }[] = [
  { id: 'account', title: 'Аккаунт' },
  { id: 'settings', title: 'Настройки' },
  { id: 'data', title: 'Данные' },
  { id: 'danger', title: 'Опасная зона' },
];

/**
 * Экран «Профиль».
 *
 * Здесь живёт всё, что раньше было в настройках, плюс имя профиля и кабинет.
 * Отдельного раздела в нижней навигации нет намеренно: на телефоне пять вкладок
 * и FAB, шестую лучше не добавлять — профиль открывается из аватара в шапке.
 */
export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setSkipPolicy = useSettingsStore((s) => s.setSkipPolicy);
  const setBlockSettings = useSettingsStore((s) => s.setBlockSettings);

  const habits = useHabitsStore((s) => s.habits);
  const logs = useHabitsStore((s) => s.logs);
  const streaks = useHabitsStore((s) => s.streaks);
  const workouts = useWorkoutsStore((s) => s.workouts);

  const authStatus = useAuthStore((s) => s.status);
  const recoveryMode = useAuthStore((s) => s.recoveryMode);

  const fileRef = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<Section>('account');
  const [confirmReset, setConfirmReset] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bytes, setBytes] = useState(0);

  // Имя профиля: пишем по мере ввода, но глобальный Ctrl+Z его не отменяет.
  const [name, setName] = useState(settings.profileName);
  useEffect(() => {
    if (open) setName(settings.profileName);
  }, [open, settings.profileName]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void storageUsed().then((v) => {
      if (alive) setBytes(v);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const metrics = useMemo(
    () => computeMetrics(habits, logs, streaks, workouts),
    [habits, logs, streaks, workouts],
  );

  const displayName = name.trim() || 'Профиль';
  const authed = authStatus === 'authed';

  const saveName = (value: string) => {
    setName(value);
    update({ profileName: value });
  };

  const exportData = async () => {
    const data = await collectAllData(settings);
    downloadJson(`momentum-backup-${todayKey()}.json`, data);
    toast('Бэкап сохранён в JSON');
  };

  const importData = async (file: File) => {
    setImporting(true);
    try {
      const data = await readJsonFile<Record<string, unknown>>(file);
      if (!data || typeof data !== 'object' || (!('habits' in data) && !('sheets' in data))) {
        toast.error('Не удалось распознать файл бэкапа');
        return;
      }
      await replaceAllData(data as never);
      useHistoryStore.getState().clear();
      await reloadAll();
      toast('Данные импортированы');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка импорта: файл повреждён');
    } finally {
      setImporting(false);
    }
  };

  const resetData = async () => {
    await clearAllData();
    useHistoryStore.getState().clear();
    await initApp();
    toast('Данные сброшены, созданы стартовые привычки');
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        title="Профиль"
        className="sm:max-w-3xl"
      >
        <div className="space-y-6">
          {/* Шапка-герой: аватар, имя, где лежат данные, чипы. */}
          <div className="space-y-4 rounded-xl border border-border/60 p-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[30%] text-xl font-semibold text-on-brand"
                style={{ background: 'linear-gradient(135deg, #7C5CFF, #4A8CFF)' }}
              >
                {initialsOf(displayName)}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <Field label="Как к вам обращаться" hint="Имя хранится только на этом устройстве.">
                  <Input
                    value={name}
                    onChange={(e) => saveName(e.target.value)}
                    placeholder="Введите имя"
                    maxLength={40}
                  />
                </Field>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Database className="h-3.5 w-3.5" aria-hidden />
                  {authed
                    ? 'Данные хранятся на устройстве и копируются в ваш аккаунт'
                    : 'Данные хранятся локально в вашем браузере (IndexedDB)'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Chip active={authed}>{authed ? 'Аккаунт · Синхронизация' : 'Без аккаунта'}</Chip>
              <Chip>{metrics.logCount} записей</Chip>
              <Chip>{formatBytes(bytes)} на устройстве</Chip>
            </div>
          </div>

          {/* Пять метрик из существующих сторов. */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Итоги
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Metric icon={<CalendarCheck2 />} value={metrics.daysWithActivity} label="дней с активностью" />
              <Metric icon={<Activity />} value={`${metrics.completion30}%`} label="выполнение за 30 дней" />
              <Metric icon={<Flame />} value={metrics.bestStreak} label="лучшая серия" />
              <Metric icon={<Dumbbell />} value={metrics.workoutsTotal} label="тренировок" />
              <Metric icon={<HardDrive />} value={formatBytes(bytes)} label="занято места" />
            </div>
          </section>

          <div className="flex flex-wrap gap-1.5 border-b border-border/50 pb-2" role="tablist" aria-label="Разделы профиля">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={section === s.id}
                onClick={() => setSection(s.id)}
                // На телефоне вкладка — палец, а не курсор: 44 px. На десктопе
                // та же строка становится плотнее, там достаточно 28.
                className={cn(
                  'min-h-tap rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1.5',
                  section === s.id
                    ? 'bg-accent text-accent-foreground'
                    : 'font-medium text-muted-foreground hover:bg-accent/60',
                )}
              >
                {s.title}
              </button>
            ))}
          </div>

          {section === 'account' && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Аккаунт
              </h3>
              {recoveryMode ? (
                <RecoveryCard />
              ) : (
                <>
                  <AccountCard />
                  <ChangePasswordCard />
                </>
              )}
            </section>
          )}

          {section === 'settings' && (
            <section className="space-y-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Настройки
              </h3>

              {/* Тема первой — самое частое. */}
              <Field label="Тема">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'light', label: 'Светлая' },
                      { value: 'dark', label: 'Тёмная' },
                      { value: 'system', label: 'Системная' },
                    ] as const
                  ).map((t) => (
                    <Button
                      key={t.value}
                      size="sm"
                      variant={settings.theme === t.value ? 'gradient' : 'outline'}
                      onClick={() => setTheme(t.value as ThemeMode)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </Field>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Правила пропусков
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Пропуски подряд до сброса серии">
                    <Input
                      type="number"
                      min={0}
                      value={settings.skipPolicy.maxConsecutiveSkips}
                      onChange={(e) => setSkipPolicy({ maxConsecutiveSkips: Math.max(0, Number(e.target.value)) })}
                    />
                  </Field>
                  <Field label="Лимит пропусков в месяц (0 — без лимита)">
                    <Input
                      type="number"
                      min={0}
                      value={settings.skipPolicy.maxSkipsPerMonth}
                      onChange={(e) => setSkipPolicy({ maxSkipsPerMonth: Math.max(0, Number(e.target.value)) })}
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  Пропуск не разрывает серию, но 2+ дня подряд без отметки сбрасывают её.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Отмена действий
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Время показа тоста «Отменить»">
                    <Select
                      value={String(settings.undoTimeoutMs)}
                      onChange={(e) => update({ undoTimeoutMs: Number(e.target.value) })}
                      options={[
                        { value: '3000', label: '3 секунды' },
                        { value: '5000', label: '5 секунд' },
                        { value: '8000', label: '8 секунд' },
                        { value: '10000', label: '10 секунд' },
                      ]}
                    />
                  </Field>
                  <Field label="Глубина истории Ctrl+Z">
                    <Select
                      value={String(settings.undoHistoryLimit)}
                      onChange={(e) => update({ undoHistoryLimit: Number(e.target.value) })}
                      options={[
                        { value: '10', label: '10 действий' },
                        { value: '20', label: '20 действий' },
                        { value: '50', label: '50 действий' },
                      ]}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  План 3-2-1
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ['main', 'Главные'],
                      ['medium', 'Средние'],
                      ['small', 'Маленькие'],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={`Название блока (${label})`}>
                      <Input
                        defaultValue={settings.blockSettings[`${key}Label`]}
                        onBlur={(e) =>
                          setBlockSettings({ [`${key}Label`]: e.target.value || settings.blockSettings[`${key}Label`] })
                        }
                      />
                    </Field>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Напоминания
                </h4>
                <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Вечернее напоминание</p>
                    <p className="text-xs text-muted-foreground">«Спланируй завтра» после 20:00</p>
                  </div>
                  <Switch
                    checked={settings.eveningReminder}
                    onCheckedChange={(v) => update({ eveningReminder: v })}
                    label="Вечернее напоминание"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Приложение
                </h4>
                <InstallAppCard />
                <UpdateAppCard />
              </div>
            </section>
          )}

          {section === 'data' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Данные
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {/* Единственная кнопка с бренд-градиентом: главное действие. */}
                <Button variant="gradient" size="sm" onClick={() => void exportData()}>
                  <Download className="h-4 w-4" /> Экспорт · JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importing}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> Импорт
                </Button>
                <span className="text-xs text-muted-foreground">
                  {metrics.logCount} отметок · {formatBytes(bytes)}
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importData(f);
                  e.target.value = '';
                }}
              />
              <InstallAppCard />
            </section>
          )}

          {section === 'danger' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Опасная зона
              </h3>
              <div className="space-y-3 rounded-xl border border-destructive/50 bg-destructive/5 p-4">
                <div>
                  <p className="text-sm font-medium">Очистить все данные</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Привычки, тренировки, таблицы и планы будут удалены, вместо них создадутся
                    стартовые привычки. Действие нельзя отменить без бэкапа.
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setConfirmReset(true)}>
                  <RefreshCw className="h-4 w-4" /> Очистить все данные
                </Button>
              </div>
            </section>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Очистить все данные?"
        message="Все привычки, тренировки, таблицы и планы будут удалены. Вместо них создадутся стартовые привычки. Действие нельзя отменить без бэкапа."
        confirmLabel="Очистить"
        cancelLabel="Отмена"
        danger
        onConfirm={() => void resetData()}
      />
    </>
  );
}

function Chip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        active
          ? 'rounded-full bg-gradient-brand px-2.5 py-1 text-[11px] font-semibold text-on-brand'
          : 'rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground'
      }
    >
      {children}
    </span>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="space-y-1 rounded-xl border border-border/60 px-3 py-2.5">
      <span className="text-primary-ink" aria-hidden>
        {icon}
      </span>
      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
