import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Database,
  Download,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSettingsStore } from '@/store/settingsStore';
import { useHistoryStore } from '@/store/historyStore';
import { collectAllData, replaceAllData, clearAllData } from '@/db/db';
import { downloadJson, readJsonFile } from '@/lib/utils';
import { todayKey } from '@/lib/dates';
import { reloadAll, initApp } from '@/lib/boot';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setSkipPolicy = useSettingsStore((s) => s.setSkipPolicy);
  const setBlockSettings = useSettingsStore((s) => s.setBlockSettings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importing, setImporting] = useState(false);

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
      <Dialog open={open} onClose={onClose} title="Настройки" size="md">
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Оформление</h3>
            <Field label="Тема">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'light', label: 'Светлая' },
                  { value: 'dark', label: 'Тёмная' },
                  { value: 'system', label: 'Системная' },
                ].map((t) => (
                  <Button
                    key={t.value}
                    size="sm"
                    variant={settings.theme === t.value ? 'gradient' : 'outline'}
                    onClick={() => setTheme(t.value as typeof settings.theme)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Правила пропусков</h3>
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
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Отмена действий</h3>
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
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">План 3-2-1</h3>
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
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Напоминания</h3>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Вечернее напоминание</p>
                <p className="text-xs text-muted-foreground">«Спланируй завтра» после 20:00</p>
              </div>
              <Switch
                checked={settings.eveningReminder}
                onCheckedChange={(v) => update({ eveningReminder: v })}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Данные</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="h-4 w-4" /> Экспорт JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Импорт JSON
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmReset(true)}>
                <RefreshCw className="h-4 w-4" /> Сбросить данные
              </Button>
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
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Database className="h-3.5 w-3.5" /> Все данные хранятся локально в вашем браузере (IndexedDB)
            </p>
          </section>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Сбросить все данные?"
        message="Все привычки, тренировки, таблицы и планы будут удалены. Вместо них создадутся стартовые привычки. Действие нельзя отменить без бэкапа."
        confirmLabel="Сбросить"
        danger
        onConfirm={() => void resetData()}
      />
    </>
  );
}