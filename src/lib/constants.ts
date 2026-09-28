import type { AppSettings, WorkoutType } from './types';

export const BRAND = {
  name: 'Momentum',
  slogan: 'Твой день. Твой ритм. Твой прогресс.',
  navy: '#0A0C12',
  violet: '#6C4DF6',
  blue: '#4A8CFF',
  gradient: 'linear-gradient(135deg, #7C5CFF 0%, #4A8CFF 100%)',
};

export const STATUS_COLORS = {
  success: '#2FD07E',
  warning: '#F2B44C',
  error: '#FF5D6C',
  skip: '#F2B44C',
};

/** Палитра для выбора цвета привычек и категорий */
export const COLOR_PALETTE = [
  '#6C4DF6', // фиолетовый
  '#4A8CFF', // синий
  '#2FD07E', // зелёный
  '#F2B44C', // янтарный
  '#FF5D6C', // красный
  '#EC4899', // розовый
  '#14B8A6', // бирюзовый
  '#F97316', // оранжевый
  '#38BDF8', // голубой
  '#84CC16', // лайм
  '#A78BFA', // индиго
  '#7A8398', // серо-голубой
];

/** Алиас палитры для таблиц и стилей */
export const COLORS = COLOR_PALETTE;

export const SKIP_REASONS = [
  { value: 'Болезнь', icon: '🤒' },
  { value: 'Отпуск', icon: '🏖️' },
  { value: 'Нет условий', icon: '🚫' },
  { value: 'Семейные обстоятельства', icon: '👨‍👩‍👧' },
  { value: 'Свой вариант', icon: '✍️' },
];

export const EMOJI_PALETTE = [
  '💧', '💪', '📖', '😴', '🏃', '🧘', '🥗', '✍️', '🧠', '💼', '🎯', '📱',
  '🦷', '🌅', '🚿', '🚶', '🧹', '💊', '🍎', '☀️', '🌙', '📈', '💰', '❤️',
  '🎸', '🎨', '🌱', '🔥', '⏰', '☕', '🫀', '🦵', '⚡', '🧊', '🍵', '🙏',
];

export const WORKOUT_TYPE_META: Record<
  WorkoutType,
  { label: string; color: string; ink: string; soft: string; emoji: string }
> = {
  strength: {
    label: 'Силовая',
    color: 'var(--strength)',
    ink: 'var(--strength-ink)',
    soft: 'var(--strength-soft)',
    emoji: '🏋️',
  },
  cardio: {
    label: 'Кардио',
    color: 'var(--cardio)',
    ink: 'var(--cardio-ink)',
    soft: 'var(--cardio-soft)',
    emoji: '🏃',
  },
  stretch: {
    label: 'Растяжка',
    color: 'var(--done)',
    ink: 'var(--done-ink)',
    soft: 'var(--done-soft)',
    emoji: '🧘',
  },
  other: {
    label: 'Другое',
    color: 'var(--miss)',
    ink: 'var(--text-muted)',
    soft: 'var(--surface-2)',
    emoji: '🏅',
  },
};

export const DEFAULT_CATEGORIES = [
  { name: 'Здоровье', icon: '🩺', color: '#2FD07E' },
  { name: 'Спорт', icon: '💪', color: '#4A8CFF' },
  { name: 'Работа', icon: '💼', color: '#6C4DF6' },
  { name: 'Учёба', icon: '📚', color: '#F2B44C' },
  { name: 'Дом', icon: '🏠', color: '#14B8A6' },
  { name: 'Развитие', icon: '🌱', color: '#EC4899' },
  { name: 'Финансы', icon: '💰', color: '#06B6D4' },
  { name: 'Отношения', icon: '💞', color: '#F97316' },
];

export const DEFAULT_SUBCATEGORIES = [
  { category: 'Здоровье', name: 'Питание', icon: '🥗' },
  { category: 'Здоровье', name: 'Сон', icon: '😴' },
  { category: 'Спорт', name: 'Силовые', icon: '🏋️' },
  { category: 'Спорт', name: 'Кардио', icon: '🏃' },
];

export const STARTER_HABITS = [
  {
    name: 'Пить воду',
    icon: '💧',
    color: '#4A8CFF',
    category: 'Здоровье',
    subcategory: 'Питание',
    targetCount: 8,
    counterUnit: 'стаканов',
  },
  {
    name: 'Тренировка',
    icon: '💪',
    color: '#6C4DF6',
    category: 'Спорт',
    subcategory: 'Силовые',
    targetCount: 0,
    counterUnit: '',
  },
  {
    name: 'Читать книгу',
    icon: '📖',
    color: '#EC4899',
    category: 'Развитие',
    subcategory: null,
    targetCount: 20,
    counterUnit: 'минут',
  },
  {
    name: 'Готовиться ко сну до 23:00',
    icon: '😴',
    color: '#2FD07E',
    category: 'Здоровье',
    subcategory: 'Сон',
    targetCount: 0,
    counterUnit: '',
  },
];

export const QUOTES: string[] = [
  'Ты не поднимаешься до уровня своих целей — ты падаешь до уровня своих систем. — Джеймс Клир',
  'Сила приходит не от побед. Сила растёт от борьбы. — Арнольд Шварценеггер',
  'Что легко делать, то легко не делать. — Джим Рон',
  'Не сравнивай себя с другими. Сравни с тем, кем ты был вчера. — Джордан Петерсон',
  'Привычка — это канат: мы плетём его каждый день, и в конце концов его не порвать. — Гораций Манн',
  'Успех — это сумма малых усилий, повторяемых день за днём. — Роберт Кольер',
  'Мотивация заставляет начать. Привычка заставляет продолжать. — Джим Рюн',
  'Лучший способ предсказать будущее — создать его. — Питер Друкер',
  'Секрет твоего будущего скрыт в твоём ежедневном распорядке. — Джон Максвелл',
  'Делай сегодня то, что другие не хотят, — завтра будешь жить так, как другие не могут.',
  'Ты не должен быть великим, чтобы начать, но должен начать, чтобы стать великим. — Зиг Зиглар',
  'Прогресс — это когда вчерашнее «сложно» становится сегодняшним «привычно».',
  'Каждый день — новая возможность изменить свою жизнь. Не упусти её.',
  'Не жди идеального момента: забирай этот момент и делай его идеальным.',
  'Год от года мы становимся тем, что делаем каждый день. — Уилл Дюрант',
  'Дисциплина — это выбор между тем, что хочется сейчас, и тем, что хочется больше всего.',
  'Маленькие шаги каждый день — вот секрет больших результатов.',
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  skipPolicy: { maxConsecutiveSkips: 1, maxSkipsPerMonth: 10 },
  undoTimeoutMs: 5000,
  undoHistoryLimit: 20,
  blockSettings: {
    mainLabel: 'Главные задачи',
    mediumLabel: 'Средние задачи',
    smallLabel: 'Маленькое дело',
    mainDefaultCount: 3,
    mediumDefaultCount: 2,
    smallDefaultCount: 1,
  },
  eveningReminder: true,
  collapsedCategories: {},
  onboarded: false,
  profileName: '',
};

export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAY_LONG = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
];