import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettingsStore } from '@/store/settingsStore';
import type { ThemeMode } from '@/lib/types';
import { Button } from './ui/button';

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const next: ThemeMode = isDark ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      title={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      aria-label="Переключить тему"
    >
      <motion.span
        key={isDark ? 'dark' : 'light'}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="inline-flex"
      >
        {isDark ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
      </motion.span>
    </Button>
  );
}

export function cycleTheme(current: ThemeMode): ThemeMode {
  const order: ThemeMode[] = ['system', 'light', 'dark'];
  return order[(order.indexOf(current) + 1) % order.length];
}