import { useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import { SplashScreen, SPLASH_DURATION } from '@/components/SplashScreen';
import { SettingsDialog } from '@/components/SettingsDialog';
import { useUpdateToast } from '@/components/UpdateAppCard';
import { initApp } from '@/lib/boot';
import { useHistoryStore } from '@/store/historyStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useHabitsStore } from '@/store/habitsStore';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { useKeydown, useNow } from '@/lib/hooks';
import { todayKey } from '@/lib/dates';
import { rememberSection, sectionFromLocation } from '@/lib/deepLink';
import type { SectionId } from '@/components/navigation';
import { DashboardPage } from '@/pages/Dashboard';
import { HabitsPage } from '@/pages/Habits';
import { WorkoutsPage } from '@/pages/Workouts';
import { SheetsPage } from '@/pages/Sheets';
import { DayPlanPage } from '@/pages/DayPlan';

function isEditableTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export default function App() {
  // Ярлыки из манифеста (манифест → shortcuts) открывают нужный раздел сразу.
  const [section, setSection] = useState<SectionId>(() => sectionFromLocation(window.location.search) ?? 'dashboard');
  const [splash, setSplash] = useState(true);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const remindAt = useMemo(() => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    return d;
  }, []);
  const remindedRef = useMemo(() => ({ current: false }), []);

  // Первичная инициализация + сплэш
  useEffect(() => {
    let alive = true;
    (async () => {
      await initApp();
      if (!alive) return;
      setReady(true);
      // если день ещё не начат — проверить смену дня после загрузки
      useHabitsStore.getState().recheckStreaksOnDayChange();
    })();
    const timer = setTimeout(
      () => alive && setSplash(false),
      SPLASH_DURATION,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // Смена дня → пересчёт серий + уведомление
  const now = useNow(15_000);
  const nowKey = todayKey();
  const dayRef = useMemo(() => ({ current: nowKey }), [nowKey]);
  useEffect(() => {
    if (!ready) return;
    if (dayRef.current !== nowKey) {
      dayRef.current = nowKey;
      remindedRef.current = false;
      useHabitsStore.getState().recheckStreaksOnDayChange();
    }
    // Вечернее напоминание о плане
    const eveningReminder = useSettingsStore.getState().settings.eveningReminder;
    if (eveningReminder && !remindedRef.current && now >= remindAt) {
      remindedRef.current = true;
      const today = todayKey();
      const st = useDayPlanStore.getState();
      const plan = st.plans.find((p) => p.date === today);
      const remaining = plan ? st.items.filter((i) => i.planId === plan.id && !i.completed).length : 0;
      toast('Вечернее напоминание', {
        description: remaining > 0 ? `В плане осталось ${remaining} пункт(ов) — успеете?` : 'День почти закончился. Составьте план на завтра.',
      });
    }
    void now;
  }, [now, nowKey, ready, remindAt]);

  // Раздел в адресной строке ↔ состояние навигации
  useEffect(() => {
    rememberSection(section);
    const onPop = () => setSection(sectionFromLocation(window.location.search) ?? 'dashboard');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [section]);

  // Ctrl/Cmd+Z — глобальный undo (кроме полей ввода)
  useKeydown((e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я')) {
      if (isEditableTarget(e)) return;
      e.preventDefault();
      const undone = useHistoryStore.getState().undo();
      if (undone) toast.info('Действие отменено');
      else toast('Отменять нечего');
    }
  }, []);

  // Тост «Обновление готово» с кнопкой «Обновить» (только десктопная версия).
  useUpdateToast();

  const content = getSectionView(section, (s) => setSection(s));

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-background text-foreground">
        {splash && <SplashScreen />}

        <Sidebar active={section} onNavigate={setSection} />

        <div className="md:pl-60">
          <Header section={section} onOpenSettings={() => setSettingsOpen(true)} />
          <main className="mx-auto w-full max-w-5xl px-4 py-5">
            {/* Без AnimatePresence/exit — мгновенная смена раздела, только входная
                анимация. Так навигация не блокируется застрявшим exit-кадром
                (актуально для мобильных PWA с частым сворачиванием вкладки). */}
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {content}
            </motion.div>
          </main>
        </div>

        <BottomNav active={section} onNavigate={setSection} />

        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </MotionConfig>
  );
}

function getSectionView(section: SectionId, navigate: (s: SectionId) => void): React.ReactNode {
  switch (section) {
    case 'dashboard':
      return <DashboardPage onNavigate={navigate} />;
    case 'habits':
      return <HabitsPage />;
    case 'workouts':
      return <WorkoutsPage />;
    case 'sheets':
      return <SheetsPage />;
    case 'dayplan':
      return <DayPlanPage />;
    default:
      return null;
  }
}