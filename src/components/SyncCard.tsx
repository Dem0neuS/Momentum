import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  HardDriveDownload,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from './ui/button';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { syncNow } from '@/sync/engine';

/**
 * Состояние синхронизации в разделе «Аккаунт».
 *
 * Показывает ровно три вещи, которые человек может проверить: данные уехали
 * или нет, когда было последнее успешное обновление и что мешает, если не
 * уехали. Без этой строки кабинет выглядит декоративным — непонятно, зачем он.
 */
export function SyncCard() {
  const status = useAuthStore((s) => s.status);
  const phase = useSyncStore((s) => s.phase);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const lastPushed = useSyncStore((s) => s.lastPushed);
  const lastPulled = useSyncStore((s) => s.lastPulled);
  const error = useSyncStore((s) => s.error);
  const choice = useSyncStore((s) => s.choice);
  if (!isSupabaseConfigured || status !== 'authed') return null;

  const busy = phase === 'syncing';

  return (
    <div className="space-y-3 rounded-xl border border-border/60 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <StatusIcon phase={phase} busy={busy} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{headline(phase)}</p>
          <p className="text-xs text-muted-foreground">{detail(phase, lastSyncedAt, lastPushed, lastPulled)}</p>
        </div>
        <Button size="sm" variant="outline" disabled={busy || choice !== null} onClick={syncNow}>
          <RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Обновить
        </Button>
      </div>

      {error && <p className="text-xs text-destructive-ink">{error}</p>}

      {choice && (
        <p className="text-xs text-muted-foreground">
          Решение по данным устройства ещё не принято — обмен ждёт его. Подробности в окне на
          главном экране.
        </p>
      )}
    </div>
  );
}

function StatusIcon({ phase, busy }: { phase: string; busy: boolean }) {
  if (busy || phase === 'syncing') return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-ink" aria-hidden />;
  if (phase === 'error') return <AlertTriangle className="h-4 w-4 shrink-0 text-destructive-ink" aria-hidden />;
  if (phase === 'offline') return <CloudOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
  if (phase === 'choice') return <HardDriveDownload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
  return <CheckCircle2 className="h-4 w-4 shrink-0 text-done-ink" aria-hidden />;
}

function headline(phase: string): string {
  switch (phase) {
    case 'syncing':
      return 'Синхронизируем…';
    case 'error':
      return 'Не синхронизировано';
    case 'offline':
      return 'Нет сети';
    case 'choice':
      return 'Ждём вашего решения';
    default:
      return 'Синхронизировано';
  }
}

function detail(phase: string, lastSyncedAt: number | null, pushed: number, pulled: number): string {
  if (phase === 'error') return 'Правки сохранены на устройстве и уйдут при следующей попытке.';
  if (phase === 'offline') return 'Правки копятся на устройстве и уйдут, как только появится сеть.';
  if (phase === 'choice') return 'Что делать с данными на этом устройстве — решаете вы.';
  if (!lastSyncedAt) return 'Обмен ещё не проходил.';
  return `${whenLabel(lastSyncedAt)}: отправлено ${pushed}, получено ${pulled}.`;
}

function whenLabel(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return 'Только что';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`;
  return new Date(at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
