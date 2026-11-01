import { create } from 'zustand';
import type { SyncChoice, SyncPhase } from '@/sync/types';

/**
 * Состояние синхронизации для интерфейса.
 *
 * Сам обмен живёт в движке (@/sync/engine) — здесь только его «внешний вид»:
 * что показать в профиле и что нажать. Стор не ходит в сеть и не знает
 * протокола, чтобы состояние можно было читать из любого компонента.
 */
interface SyncState {
  phase: SyncPhase;
  userId: string | null;
  /** Метка времени последнего удачного обмена. */
  lastSyncedAt: number | null;
  /** Сколько записей ушло в облако и сколько пришло — для отладки и подписи. */
  lastPushed: number;
  lastPulled: number;
  error: string | null;
  /** Чем закончилась попытка, если неудачей. */
  choice: SyncChoice | null;

  setState(patch: Partial<Pick<SyncState, 'phase' | 'userId' | 'error' | 'choice'>>): void;
  markSyncing(): void;
  markSynced(pushed: number, pulled: number, at: number): void;
  markError(message: string): void;
  askChoice(kind: SyncChoice): void;
  cancelChoice(): void;
}

export const useSyncStore = create<SyncState>((set) => ({
  phase: 'off',
  userId: null,
  lastSyncedAt: null,
  lastPushed: 0,
  lastPulled: 0,
  error: null,
  choice: null,

  setState: (patch) => set(patch),
  markSyncing: () => set({ phase: 'syncing', error: null }),
  markSynced: (lastPushed, lastPulled, at) =>
    set({ phase: 'idle', lastSyncedAt: at, lastPushed, lastPulled, error: null, choice: null }),
  markError: (error) => set({ phase: 'error', error }),
  askChoice: (choice) => set({ phase: 'choice', choice, error: null }),
  cancelChoice: () => set({ phase: 'idle', choice: null, error: null }),
}));
