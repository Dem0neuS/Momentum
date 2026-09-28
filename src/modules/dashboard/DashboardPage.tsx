import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, CalendarCheck2, CheckCircle2, ChevronRight, Dumbbell, Flame, Quote, Sparkles, TrendingUp } from 'lucide-react';
import { useHabitsStore } from '@/store/habitsStore';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { useSettingsStore } from '@/store/settingsStore';
import { QUOTES } from '@/lib/constants';
import { formatDayLong, greetingByHour, lastNDayKeys, todayKey, nextNDaysFromToday } from '@/lib/dates';
import { logsMap, isScheduledOn } from '@/lib/streak';
import { ProgressRing } from '@/components/ProgressRing';
import { InstallBanner } from '@/components/InstallBanner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SectionId } from '@/components/navigation';

export function DashboardPage({ onNavigate }: { onNavigate?: (s: SectionId) => void }) {
  const habits = useHabitsStore((s) => s.habits);
  const logs = useHabitsStore((s) => s.logs);
  const streaks = useHabitsStore((s) => s.streaks);
  const workouts = useWorkoutsStore((s) => s.workouts);
  const plans = useDayPlanStore((s) => s.plans);
  const items = useDayPlanStore((s) => s.items);

  const today = todayKey();
  const logMap = useMemo(() => logsMap(logs), [logs]);

  const quote = useMemo(() => {
    const day = parseInt(today.slice(-2), 10) || 1;
    return QUOTES[day % QUOTES.length];
  }, [today]);

  // Сводка сегодня
  const activeHabits = habits.filter((h) => !h.archived);
  const scheduledToday = activeHabits.filter((h) => isScheduledOn(h, new Date(today + 'T12:00:00')));
  const doneToday = scheduledToday.filter((h) => logMap.get(`${h.id}:${today}`)?.status === 'done').length;

  const workoutsToday = workouts.filter((w) => w.date === today);
  const todayPlan = plans.find((p) => p.date === today);
  const todayItems = todayPlan ? items.filter((i) => i.planId === todayPlan.id) : [];
  const todayDone = todayItems.filter((i) => i.completed).length;

  // 30 дней привычек
  const habitChart = useMemo(() => {
    const keys = lastNDayKeys(30);
    return keys.map((k) => {
      const scheduled = activeHabits.filter((h) => isScheduledOn(h, new Date(k + 'T12:00:00')));
      const done = scheduled.filter((h) => logMap.get(`${h.id}:${k}`)?.status === 'done').length;
      const pct = scheduled.length > 0 ? Math.round((done / scheduled.length) * 100) : null;
      return { date: k.slice(5), pct, done, total: scheduled.length };
    });
  }, [activeHabits, logMap]);

  // Тренировки за месяц
  const workoutChart = useMemo(() => {
    const month = today.slice(0, 7);
    const byDay = new Map<string, { count: number; completed: number }>();
    for (const w of workouts) {
      if (!w.date.startsWith(month)) continue;
      const cur = byDay.get(w.date) ?? { count: 0, completed: 0 };
      cur.count += 1;
      if (w.completed) cur.completed += 1;
      byDay.set(w.date, cur);
    }
    return nextNDaysFromToday(30)
      .filter((k) => k.startsWith(month))
      .map((k) => ({ date: k.slice(5), ...(byDay.get(k) ?? { count: 0, completed: 0 }) }));
  }, [workouts, today]);

  // Топ-3 серии
  const topStreaks = useMemo(() => {
    return activeHabits
      .filter((h) => (streaks[h.id]?.current ?? 0) > 0)
      .sort((a, b) => (streaks[b.id]?.current ?? 0) - (streaks[a.id]?.current ?? 0))
      .slice(0, 3);
  }, [activeHabits, streaks]);

  // План на завтра
  const tomorrowPlan = useMemo(() => {
    const tomorrow = nextNDaysFromToday(1)[0];
    const p = plans.find((x) => x.date === tomorrow);
    if (!p) return { key: tomorrow, items: [] as typeof items };
    const list = items.filter((i) => i.planId === p.id);
    return { key: tomorrow, items: list.slice(0, 3) };
  }, [plans, items]);

  const pctToday = scheduledToday.length > 0 ? (doneToday / scheduledToday.length) * 100 : 0;
  const year = new Date().getFullYear();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <InstallBanner />
      {/* Приветствие и быстрые действия */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-hero p-4 shadow-card sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-2xl"
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-primary-ink">
              Сегодня
            </span>
            <p className="text-sm font-medium capitalize text-muted-foreground">
              {greetingByHour(new Date().getHours())}, {formatDayLong(new Date())}
            </p>
          </div>
          <h1 className="mt-3 max-w-xl text-xl font-bold leading-tight sm:text-2xl">
            Твой день. Твой&nbsp;ритм. <span className="gradient-text">Твой прогресс.</span>
          </h1>
        </div>

        <div className="relative mt-5 grid gap-2.5 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-primary/15 bg-surface/80 p-3 shadow-card">
            <ProgressRing
              size={52}
              stroke={5}
              progress={pctToday / 100}
              gradient
              trackColor="var(--surface-2)"
              glow
              label="Прогресс привычек на сегодня"
            >
              <span className="text-[10px] font-bold">{Math.round(pctToday)}%</span>
            </ProgressRing>
            <div>
              <p className="text-sm font-semibold leading-tight">Привычки</p>
              <p className="text-[11px] text-muted-foreground">
                {doneToday} из {scheduledToday.length} сегодня
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-surface/80 p-3 shadow-card">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-cardio-soft text-cardio-ink">
              <Dumbbell className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Тренировки</p>
              <p className="text-[11px] text-muted-foreground">
                {workoutsToday.length > 0 ? `${workoutsToday.length} сегодня` : 'нет сегодня'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-surface/80 p-3 shadow-card">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-skip-soft text-skip-ink">
              <CalendarCheck2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">План</p>
              <p className="text-[11px] text-muted-foreground">
                {todayItems.length > 0 ? `${todayDone}/${todayItems.length} выполнено` : 'нет плана'}
              </p>
            </div>
          </div>
        </div>

        {onNavigate && (
          <div className="relative mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="gradient" onClick={() => onNavigate('habits')}>
              <CheckCircle2 className="h-4 w-4" />
              Отметить привычки
              <ArrowUpRight className="ml-auto h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('workouts')}>
              <Dumbbell className="h-4 w-4" />
              К тренировкам
              <ArrowUpRight className="ml-auto h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </section>

      {/* График привычек 30 дней */}
      <ChartCard
        title="Привычки · 30 дней"
        subtitle="Доля выполненных от запланированных"
        action={
          <button onClick={() => onNavigate?.('habits')} className="flex min-h-tap items-center gap-0.5 text-xs font-medium text-primary-ink">
            Подробнее <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        {habitChart.length === 0 || habitChart.every((d) => d.pct === null) ? (
          <EmptyChart text="Нет данных за 30 дней — отметьте привычки" />
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={habitChart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gHabits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-500)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--flow-500)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} interval={5} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  borderRadius: 'var(--r-md)',
                  border: 'var(--border-card)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 'var(--fs-caption)',
                  boxShadow: 'var(--shadow-pop)',
                }}
                formatter={(v) => [`${v}%`, 'Выполнено']}
              />
              <Area type="monotone" dataKey="pct" stroke="var(--chart-series-1)" strokeWidth={2} fill="url(#gHabits)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Тренировки за месяц */}
      <ChartCard
        title="Тренировки · этот месяц"
        subtitle="Тренировок по дням"
        action={
          <button onClick={() => onNavigate?.('workouts')} className="flex min-h-tap items-center gap-0.5 text-xs font-medium text-primary-ink">
            Подробнее <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        {workoutChart.every((d) => d.count === 0) ? (
          <EmptyChart text="В этом месяце тренировок пока нет" />
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={workoutChart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickLine={false} axisLine={false} width={20} />
              <Tooltip
                contentStyle={{
                  borderRadius: 'var(--r-md)',
                  border: 'var(--border-card)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 'var(--fs-caption)',
                  boxShadow: 'var(--shadow-pop)',
                }}
                cursor={{ fill: 'var(--cell-selected)' }}
              />
              <Bar dataKey="count" fill="var(--chart-series-2)" radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Топ-3 серии */}
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-warning-ink" />
            <h2 className="text-sm font-bold">Топ серий</h2>
          </div>
          {topStreaks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Отметьте первую привычку — серия начнёт расти.</p>
          ) : (
            <div className="space-y-2">
              {topStreaks.map((h, i) => (
                <div key={h.id} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm" style={{ backgroundColor: `${h.color}1f` }}>
                    {h.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{h.name}</p>
                    <RainbowBar color={h.color} ratio={(streaks[h.id]?.current ?? 0) / Math.max((streaks[h.id]?.best ?? 1), 1)} />
                  </div>
                  <span className="flex items-center gap-1 text-sm font-bold text-warning-ink">
                    <Flame className="h-3.5 w-3.5" /> {streaks[h.id]?.current ?? 0}
                  </span>
                  {i === 0 && <span className="text-lg">🥇</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* План на завтра */}
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-ink" />
            <h2 className="text-sm font-bold">План на завтра</h2>
          </div>
          {tomorrowPlan.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Завтра пунктов нет — составьте план.</p>
          ) : (
            <div className="space-y-1.5">
              {tomorrowPlan.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 text-[13px]">
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      it.completed ? 'border-transparent bg-brand' : 'border-border',
                    )}
                  >
                    {it.completed && <span className="text-[8px] text-on-brand">✓</span>}
                  </span>
                  <span className={cn('truncate', it.completed && 'text-muted-foreground line-through')}>{it.text}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => onNavigate?.('dayplan')}
            className="mt-3 flex min-h-tap items-center gap-0.5 text-xs font-medium text-primary-ink"
          >
            Открыть план <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Цитата дня */}
      <div className="rounded-lg border border-border/70 bg-card p-4 shadow-card">
        <div className="flex items-start gap-3">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" />
          <div>
            <p className="text-sm italic leading-relaxed text-foreground/90">«{quote}»</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <TrendingUp className="mr-1 inline h-3 w-3" /> Момент {year}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
      <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function RainbowBar({ color, ratio }: { color: string; ratio: number }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.round(ratio * 100))}%`, backgroundColor: color }}
      />
    </div>
  );
}