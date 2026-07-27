'use client';

import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, Anchor, Flame, CheckCircle2, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const TYPE_META: Record<string, { icon: typeof Target; color: string; label: string }> = {
  realism: { icon: Target, color: 'text-purple-600 dark:text-purple-400', label: 'Realism' },
  anchor_discipline: { icon: Anchor, color: 'text-cyan-600 dark:text-cyan-400', label: 'Anchor' },
  triage_streak: { icon: Flame, color: 'text-orange-600 dark:text-orange-400', label: 'Triage' },
  completion: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', label: 'Done' },
  focus_session: { icon: Clock, color: 'text-teal-600 dark:text-teal-400', label: 'Focus' },
};

export function GamificationPanel() {
  const todayScore = useAppStore((s) => s.todayScore);
  const gamification = useAppStore((s) => s.gamification);
  const tasks = useAppStore((s) => s.tasks);

  const nextTier = Math.ceil((todayScore + 1) / 50) * 50;
  const tierPct = ((todayScore % 50) / 50) * 100;

  const completedToday = tasks.filter(
    (t) => t.status === 'completed' && t.completedAt &&
      new Date(t.completedAt).toDateString() === new Date().toDateString()
  );

  return (
    <Card className="p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Trophy className="size-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold">Score</span>
        </div>
        <span className="text-xs font-bold tabular-nums">{todayScore}</span>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-muted-foreground">Tier</span>
            <span className="font-medium tabular-nums">{todayScore}/{nextTier}</span>
          </div>
          <Progress value={tierPct} className="h-1.5" />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded bg-muted/40 px-2 py-1.5 text-center">
            <div className="text-base font-bold tabular-nums">{completedToday.length}</div>
            <div className="text-[9px] text-muted-foreground">done today</div>
          </div>
          <div className="rounded bg-muted/40 px-2 py-1.5 text-center">
            <div className="text-base font-bold tabular-nums">{gamification.length}</div>
            <div className="text-[9px] text-muted-foreground">events</div>
          </div>
        </div>

        {gamification.length > 0 && (
          <div className="max-h-28 overflow-y-auto space-y-0 -mr-1 pr-1">
            {gamification.slice(0, 6).map((g) => {
              const meta = TYPE_META[g.type] ?? TYPE_META.completion;
              const Icon = meta.icon;
              return (
                <div key={g.id} className="flex items-center gap-1.5 text-[10px] py-0.5 border-b border-border/30 last:border-0">
                  <Icon className={cn('size-2.5 shrink-0', meta.color)} />
                  <span className="flex-1 truncate text-muted-foreground">{g.note ?? meta.label}</span>
                  <span className="font-medium tabular-nums">+{g.points}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
