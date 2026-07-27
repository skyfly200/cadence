'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Trophy, Target, TrendingUp, Flame, Calendar, Anchor } from 'lucide-react';
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

  const byCategory: Record<string, { count: number; minutes: number }> = {};
  for (const t of completed) {
    if (!byCategory[t.category]) byCategory[t.category] = { count: 0, minutes: 0 };
    byCategory[t.category].count++;
    byCategory[t.category].minutes += t.actualMinutes;
  }
  const catEntries = Object.entries(byCategory).sort((a, b) => b[1].minutes - a[1].minutes);
  const maxCatMin = Math.max(1, ...catEntries.map(([, v]) => v.minutes));

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { icon: Trophy, color: 'text-amber-500', value: String(todayScore), label: 'Score' },
          { icon: Target, color: 'text-purple-500', value: `${realismPct}%`, label: 'Realism' },
          { icon: TrendingUp, color: 'text-emerald-500', value: String(completed.length), label: 'Completed' },
          { icon: Flame, color: 'text-orange-500', value: formatDuration(totalFocusMin), label: 'Focus' },
        ].map(({ icon: Icon, color, value, label }) => (
          <Card key={label} className="p-2.5 flex items-center gap-2">
            <Icon className={cn('size-4 shrink-0', color)} />
            <div className="min-w-0">
              <div className="text-lg font-bold tabular-nums leading-none">{value}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* 7-day bar chart */}
        <Card className="p-2.5">
          <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
            <Calendar className="size-3" /> Last 7 days
          </h3>
          <div className="flex items-end justify-between gap-1.5 h-28">
            {completedByDay.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-medium tabular-nums">{d.count}</span>
                <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                  <div
                    className="w-full max-w-[1.25rem] rounded-t bg-primary/70"
                    style={{ height: `${(d.count / maxCompleted) * 100}%`, minHeight: d.count > 0 ? '4px' : '1px' }}
                  />
                </div>
                <span className="text-[8px] text-muted-foreground">{d.date.toLocaleDateString('en', { weekday: 'short' })}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Category breakdown */}
        <Card className="p-2.5">
          <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
            <Anchor className="size-3" /> Focus by category
          </h3>
          {catEntries.length === 0 ? (
            <p className="text-[10px] text-muted-foreground py-4 text-center">No data yet.</p>
          ) : (
            <div className="space-y-1.5">
              {catEntries.map(([cat, v]) => (
                <div key={cat} className="flex items-center gap-2 text-[10px]">
                  <span className="w-14 truncate font-medium">{cat}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${(v.minutes / maxCatMin) * 100}%` }} />
                  </div>
                  <span className="tabular-nums text-muted-foreground w-16 text-right">{v.count} · {formatDuration(v.minutes)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Scoring events table */}
      {gamification.length > 0 && (
        <Card className="p-2.5">
          <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
            <Trophy className="size-3 text-amber-500" /> Scoring events
          </h3>
          <div className="max-h-40 overflow-y-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[9px] text-muted-foreground uppercase tracking-wide">
                  <th className="px-1.5 py-0.5">Type</th>
                  <th className="px-1.5 py-0.5">Note</th>
                  <th className="px-1.5 py-0.5 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {gamification.map((g) => (
                  <tr key={g.id} className="border-b border-border/30 last:border-0">
                    <td className="px-1.5 py-1 text-[10px] capitalize text-muted-foreground">{g.type.replace('_', ' ')}</td>
                    <td className="px-1.5 py-1 text-[10px] truncate max-w-[200px] text-muted-foreground">{g.note ?? '—'}</td>
                    <td className={cn('px-1.5 py-1 text-[10px] font-semibold tabular-nums text-right', g.points > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                      {g.points > 0 ? '+' : ''}{g.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
