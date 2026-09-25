import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck2, ChevronRight, Dumbbell, Flame, Quote, Sparkles, TrendingUp } from 'lucide-react';
import { useHabitsStore } from '@/store/habitsStore';
import { useWorkoutsStore } from '@/store/workoutsStore';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { useSettingsStore } from '@/store/settingsStore';
import { QUOTES } from '@/lib/constants';
import { formatDayLong, greetingByHour, lastNDayKeys, todayKey, nextNDaysFromToday } from '@/lib/dates';
import { logsMap, isScheduledOn } from '@/lib/streak';
import { ProgressRing } from '@/components/ProgressRing';
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
      {/* Приветствие */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-violet-500/15 via-blue-500/10 to-transparent p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 blur-2xl"
        />
        <p className="text-sm font-medium capitalize text-muted-foreground">
          {greetingByHour(new Date().getHours())}, {formatDayLong(new Date())}
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          Твой день. Твой&nbsp;ритм. <span className="bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent">Твой прогресс.</span>
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <ProgressRing size={52} stroke={5} progress={pctToday / 100} color="#8B5CF6" glow>
              <span className="text-[10px] font-bold">{Math.round(pctToday)}%</span>
            </ProgressRing>
            <div>
              <p className="text-sm font-semibold leading-tight">Привычки</p>
              <p className="text-[11px] text-muted-foreground">
                {doneToday} из {scheduledToday.length} сегодня
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-border/50 bg-background/60 px-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
              <Dumbbell className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Тренировки</p>
              <p className="text-[11px] text-muted-foreground">
                {workoutsToday.length > 0 ? `${workoutsToday.length} сегодня` : 'нет сегодня'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-border/50 bg-background/60 px-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
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
      </div>

      {/* График привычек 30 дней */}
      <ChartCard
        title="Привычки · 30 дней"
        subtitle="Доля выполненных от запланированных"
        action={
          <button onClick={() => onNavigate?.('habits')} className="flex items-center gap-0.5 text-xs font-medium text-primary">
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
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={5} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }}
                formatter={(v) => [`${v}%`, 'Выполнено']}
              />
              <Area type="monotone" dataKey="pct" stroke="#8B5CF6" strokeWidth={2} fill="url(#gHabits)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Тренировки за месяц */}
      <ChartCard
        title="Тренировки · этот месяц"
        subtitle="Тренировок по дням"
        action={
          <button onClick={() => onNavigate?.('workouts')} className="flex items-center gap-0.5 text-xs font-medium text-primary">
            Подробнее <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        {workoutChart.every((d) => d.count === 0) ? (
          <EmptyChart text="В этом месяце тренировок пока нет" />
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={workoutChart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={20} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }}
                cursor={{ fill: 'rgba(139,92,246,0.06)' }}
              />
              <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Топ-3 серии */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-bold">Топ серий</h3>
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
                  <span className="flex items-center gap-1 text-sm font-bold text-warning">
                    <Flame className="h-3.5 w-3.5" /> {streaks[h.id]?.current ?? 0}
                  </span>
                  {i === 0 && <span className="text-lg">🥇</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* План на завтра */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">План на завтра</h3>
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
                      it.completed ? 'border-transparent bg-gradient-to-br from-violet-500 to-blue-500' : 'border-border',
                    )}
                  >
                    {it.completed && <span className="text-[8px] text-white">✓</span>}
                  </span>
                  <span className={cn('truncate', it.completed && 'text-muted-foreground line-through')}>{it.text}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => onNavigate?.('dayplan')}
            className="mt-3 flex items-center gap-0.5 text-xs font-medium text-primary"
          >
            Открыть план <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Цитата дня */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.07] to-transparent p-4">
        <div className="flex items-start gap-3">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
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