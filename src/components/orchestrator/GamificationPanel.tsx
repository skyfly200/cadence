'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, Anchor, Flame, CheckCircle2, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const TYPE_META: Record<string, { icon: typeof Target; color: string; label: string }> = {
  realism: { icon: Target, color: 'text-purple-600 dark:text-purple-400', label: 'Realism' },
  anchor_discipline: { icon: Anchor, color: 'text-cyan-600 dark:text-cyan-400', label: 'Anchor Discipline' },
  triage_streak: { icon: Flame, color: 'text-orange-600 dark:text-orange-400', label: 'Triage Streak' },
  completion: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', label: 'Completion' },
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
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-amber-500" />
          <h3 className="text-sm font-semibold">Process Score</h3>
        </div>
        <Badge variant="outline" className="text-xs">{todayScore} pts</Badge>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Tier progress</span>
            <span className="font-medium">{todayScore} / {nextTier}</span>
          </div>
          <Progress value={tierPct} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/50 p-2 text-center">
            <div className="text-xl font-bold tabular-nums">{completedToday.length}</div>
            <div className="text-[10px] text-muted-foreground">completed today</div>
          </div>
          <div className="rounded-md bg-muted/50 p-2 text-center">
            <div className="text-xl font-bold tabular-nums">{gamification.length}</div>
            <div className="text-[10px] text-muted-foreground">scoring events</div>
          </div>
        </div>

        {gamification.length > 0 && (
          <div className="max-h-40 overflow-y-auto space-y-1 -mr-2 pr-2">
            {gamification.slice(0, 8).map((g) => {
              const meta = TYPE_META[g.type] ?? TYPE_META.completion;
              const Icon = meta.icon;
              return (
                <div key={g.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                  <Icon className={cn('size-3.5 shrink-0', meta.color)} />
                  <span className="flex-1 truncate">{g.note ?? meta.label}</span>
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
