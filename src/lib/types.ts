export type ID = string;

// ---------- Категории ----------
export interface Category {
  id: ID;
  name: string;
  icon: string; // эмодзи или имя lucide-иконки
  color: string; // hex
  order: number;
}

export interface Subcategory {
  id: ID;
  categoryId: ID;
  name: string;
  icon: string;
  color: string;
  order: number;
}

// ---------- Привычки ----------
export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'days'; days: number[] } // ISO-дни недели: 1 = Пн … 7 = Вс
  | { type: 'timesPerWeek'; times: number };

export interface Habit {
  id: ID;
  name: string;
  icon: string;
  color: string; // hex
  categoryId: ID | null;
  subcategoryId: ID | null;
  frequency: HabitFrequency;
  targetCount: number; // 0 — без цели-счётчика
  counterUnit: string; // напр. «стаканов»
  allowSkips: boolean;
  createdAt: string; // ISO-дата yyyy-MM-dd
  archived: boolean;
}

export type HabitStatus = 'done' | 'skipped' | 'none';

export interface HabitLog {
  id: ID;
  habitId: ID;
  date: string; // yyyy-MM-dd
  value: number;
  completed: boolean;
  status: HabitStatus;
  skipReason?: string;
  updatedAt: string; // ISO
}

export interface StreakInfo {
  habitId: ID;
  current: number;
  best: number;
  totalDone: number;
  lastResetAt: string | null;
}

// ---------- Тренировки ----------
export type WorkoutType = 'strength' | 'cardio' | 'stretch' | 'other';
export const WORKOUT_TYPES: WorkoutType[] = ['strength', 'cardio', 'stretch', 'other'];

export interface Workout {
  id: ID;
  name: string;
  date: string; // yyyy-MM-dd
  type: WorkoutType;
  notes: string;
  completed: boolean;
}

export interface Exercise {
  id: ID;
  workoutId: ID;
  name: string;
  sets: number;
  reps: number;
  weight: number; // кг
  /** Дополнительные метрики для кардио (сохраняются в IndexedDB). */
  incline?: number; // градусы
  speed?: number; // км/ч
  distance?: number; // км
  duration?: number; // минуты
  restTime?: number; // секунды между подходами
  note: string;
  order: number;
}

export type TemplateExercise = Omit<Exercise, 'id' | 'workoutId'>;

export interface WorkoutTemplate {
  id: ID;
  name: string;
  /** Тип тренировки сохраняется, чтобы кардио-поля не скрывались после применения шаблона. */
  type?: WorkoutType;
  exercises: TemplateExercise[];
}

// ---------- Таблицы ----------
export interface Sheet {
  id: ID;
  name: string;
  colCount: number;
  rowCount: number;
  widths: number[]; // ширина колонок в px
}

export type CellAlign = 'left' | 'center' | 'right';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  align?: CellAlign;
  bg?: string;
  color?: string;
}

export interface Cell {
  id: ID;
  sheetId: ID;
  row: number;
  col: number;
  raw: string; // текст или формула (начинается с '=')
  style?: CellStyle | null;
}

export type CellValue = string | number | boolean | null;

// ---------- План 3-2-1 ----------
export interface DayPlan {
  id: ID;
  date: string; // yyyy-MM-dd
  notes: string;
}

export type BlockType = 'main' | 'medium' | 'small';

export interface DayPlanItem {
  id: ID;
  planId: ID;
  blockType: BlockType;
  text: string;
  completed: boolean;
  time?: string;
  duration?: number; // минуты
  order: number;
  note?: string;
  linkedHabitId?: ID | null;
  linkedWorkoutId?: ID | null;
}

export interface BlockSettings {
  mainLabel: string;
  mediumLabel: string;
  smallLabel: string;
  mainDefaultCount: number;
  mediumDefaultCount: number;
  smallDefaultCount: number;
}

// ---------- Настройки ----------
export interface SkipPolicy {
  maxConsecutiveSkips: number;
  maxSkipsPerMonth: number; // 0 — без лимита
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  skipPolicy: SkipPolicy;
  undoTimeoutMs: number;
  undoHistoryLimit: number;
  blockSettings: BlockSettings;
  eveningReminder: boolean;
  collapsedCategories: Record<string, boolean>;
  onboarded: boolean;
}

// ---------- Undo-история (память сессии) ----------
export interface UndoAction {
  id: ID;
  type: string;
  label: string;
  timestamp: number;
  undo: () => void;
}

// ---------- Экспорт ----------
export interface AllData {
  version: 1;
  exportedAt: string;
  categories: Category[];
  subcategories: Subcategory[];
  habits: Habit[];
  habitLogs: HabitLog[];
  streaks: StreakInfo[];
  workouts: Workout[];
  exercises: Exercise[];
  workoutTemplates: WorkoutTemplate[];
  sheets: Sheet[];
  cells: Cell[];
  dayPlans: DayPlan[];
  dayPlanItems: DayPlanItem[];
  settings: AppSettings;
}