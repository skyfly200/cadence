'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Anchor, Flame, TrendingUp, Calendar } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatDuration } from '@/lib/time-utils';
import { cn } from '@/lib/utils';

export function StatsView() {
  const tasks = useAppStore((s) => s.tasks);
  const gamification = useAppStore((s) => s.gamification);
  const todayScore = useAppStore((s) => s.todayScore);

  const completed = useMemo(() => tasks.filter((t) => t.status === 'completed' && t.completedAt), [tasks]);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const completedByDay = last7Days.map((d) => {
    const count = completed.filter((t) => t.completedAt && new Date(t.completedAt).toDateString() === d.toDateString()).length;
    return { date: d, count };
  });
  const maxCompleted = Math.max(1, ...completedByDay.map((x) => x.count));

  // Realism score: tasks completed today where actual is within ±20% of estimated
  const completedToday = completed.filter(
    (t) => t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()
  );
  const realistic = completedToday.filter((t) => {
    if (t.estimatedMinutes === 0) return false;
    const ratio = t.actualMinutes / t.estimatedMinutes;
    return ratio >= 0.8 && ratio <= 1.2;
  });
  const realismPct = completedToday.length > 0 ? Math.round((realistic.length / completedToday.length) * 100) : 0;

  const totalFocusMin = tasks.reduce((s, t) => s + t.actualMinutes, 0);

  // Category breakdown
  const byCategory: Record<string, { count: number; minutes: number }> = {};
  for (const t of completed) {
    if (!byCategory[t.category]) byCategory[t.category] = { count: 0, minutes: 0 };
    byCategory[t.category].count++;
    byCategory[t.category].minutes += t.actualMinutes;
  }
  const catEntries = Object.entries(byCategory).sort((a, b) => b[1].minutes - a[1].minutes);
  const maxCatMin = Math.max(1, ...catEntries.map(([, v]) => v.minutes));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Trophy className="size-5 text-amber-500" />
            <span className="text-2xl font-bold tabular-nums">{todayScore}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Today&apos;s score</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Target className="size-5 text-purple-500" />
            <span className="text-2xl font-bold tabular-nums">{realismPct}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Realism (±20% of estimate)</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <TrendingUp className="size-5 text-emerald-500" />
            <span className="text-2xl font-bold tabular-nums">{completed.length}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total completed</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Flame className="size-5 text-orange-500" />
            <span className="text-2xl font-bold tabular-nums">{formatDuration(totalFocusMin)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total focus logged</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar className="size-4" /> Completions — last 7 days
          </h3>
          <div className="flex items-end justify-between gap-2 h-40">
            {completedByDay.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
                  <div
                    className="w-full max-w-[2rem] rounded-t bg-primary/80 transition-all hover:bg-primary"
                    style={{ height: `${(d.count / maxCompleted) * 100}%`, minHeight: d.count > 0 ? '8px' : '2px' }}
                    title={`${d.count} completed`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {d.date.toLocaleDateString('en', { weekday: 'short' })}
                </span>
                <span className="text-[10px] font-medium tabular-nums">{d.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Anchor className="size-4" /> Focus by category
          </h3>
          {catEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No completed tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {catEntries.map(([cat, v]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{cat}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {v.count} tasks · {formatDuration(v.minutes)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${(v.minutes / maxCatMin) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" /> Scoring events (today)
        </h3>
        {gamification.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No scoring events yet. Complete tasks, finish triage, and respect anchors to earn points.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {gamification.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] capitalize">{g.type.replace('_', ' ')}</Badge>
                  <span className="text-muted-foreground truncate">{g.note ?? '—'}</span>
                </div>
                <span className={cn('font-semibold tabular-nums', g.points > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                  {g.points > 0 ? '+' : ''}{g.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
