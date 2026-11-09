import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  CheckCircle2,
  Dumbbell,
  Table2,
  Target,
  CalendarDays,
} from 'lucide-react';

export type SectionId = 'dashboard' | 'habits' | 'workouts' | 'sheets' | 'dayplan' | 'calendar';

export interface NavItem {
  id: SectionId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Дашборд', shortLabel: 'Главная', icon: LayoutDashboard },
  { id: 'habits', label: 'Привычки', shortLabel: 'Привычки', icon: CheckCircle2 },
  { id: 'workouts', label: 'Тренировки', shortLabel: 'Тренировки', icon: Dumbbell },
  { id: 'sheets', label: 'Таблицы', shortLabel: 'Таблицы', icon: Table2 },
  { id: 'dayplan', label: 'План на завтра', shortLabel: 'План', icon: Target },
  { id: 'calendar', label: 'Календарь', shortLabel: 'Календарь', icon: CalendarDays },
];

export function sectionTitle(id: SectionId): string {
  return NAV_ITEMS.find((n) => n.id === id)?.label ?? 'Momentum';
}