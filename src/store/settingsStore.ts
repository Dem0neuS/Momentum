import { create } from 'zustand';
import type { AppSettings, BlockSettings, SkipPolicy, ThemeMode } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import { saveSettings } from '@/db/db';

const THEME_KEY = 'momentum:theme';
const THEME_COLORS: Record<'light' | 'dark', string> = {
  light: '#F5F6FA',
  dark: '#0A0C12',
};

let systemThemeQuery: MediaQueryList | null = null;

function syncThemeColor(theme: ThemeMode): void {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light';
  document.documentElement.dataset.themeResolved = resolved;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
}

function watchSystemTheme(): void {
  if (systemThemeQuery) return;
  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    if (document.documentElement.dataset.theme === 'system') syncThemeColor('system');
  };
  if (systemThemeQuery.addEventListener) {
    systemThemeQuery.addEventListener('change', update);
  } else {
    systemThemeQuery.addListener(update);
  }
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
  syncThemeColor(theme);
  watchSystemTheme();
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* no-op */
  }
}

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: (s?: AppSettings) => void;
  update: (patch: Partial<AppSettings>) => void;
  setTheme: (t: ThemeMode) => void;
  setSkipPolicy: (p: Partial<SkipPolicy>) => void;
  setBlockSettings: (p: Partial<BlockSettings>) => void;
  setCategoryCollapsed: (categoryId: string, collapsed: boolean) => void;
  resetSaved: (s: AppSettings) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: (s) => {
    const settings = s ?? get().settings;
    set({ settings, loaded: true });
    applyTheme(settings.theme);
  },

  update: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    void saveSettings(next);
    if (patch.theme) applyTheme(patch.theme);
  },

  setTheme: (t) => get().update({ theme: t }),

  setSkipPolicy: (p) => {
    get().update({ skipPolicy: { ...get().settings.skipPolicy, ...p } });
  },

  setBlockSettings: (p) => {
    get().update({ blockSettings: { ...get().settings.blockSettings, ...p } });
  },

  setCategoryCollapsed: (categoryId, collapsed) => {
    get().update({
      collapsedCategories: { ...get().settings.collapsedCategories, [categoryId]: collapsed },
    });
  },

  resetSaved: (s) => {
    set({ settings: s });
    void saveSettings(s);
    applyTheme(s.theme);
  },
}));