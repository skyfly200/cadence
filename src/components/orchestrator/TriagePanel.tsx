'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Lightbulb, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, EISENHOWER_LABELS } from '@/lib/types';
import { formatDuration } from '@/lib/time-utils';
import { useState, useMemo } from 'react';

export function TriagePanel() {
  const tasks = useAppStore((s) => s.tasks);
  const resolveTriageItem = useAppStore((s) => s.resolveTriageItem);
  const setCapacity = useAppStore((s) => s.setCapacity);
  const awardPoints = useAppStore((s) => s.awardPoints);
  const capacity = useAppStore((s) => s.capacity);
  const { toast } = useToast();
  const [resolved, setResolved] = useState(0);

  const triageTasks = useMemo(() => tasks.filter((t) => t.status === 'triage_review'), [tasks]);

  const handleResolve = async (taskId: string, action: 'schedule_today' | 'incubator' | 'delete', title: string) => {
    await resolveTriageItem(taskId, action);
    setResolved((r) => r + 1);
    const labels = { schedule_today: 'scheduled for today', incubator: 'sent to incubator', delete: 'deleted' };
    toast({ title: `Task ${labels[action]}`, description: title });
  };

  const completeTriage = async () => {
    await setCapacity({ triageCompleted: true, triageStreak: (capacity?.triageStreak ?? 0) + 1 });
    await awardPoints('triage_streak', 15, 'Completed morning triage ritual');
    toast({ title: 'Triage complete', description: '+15 points · streak extended' });
  };

  if (triageTasks.length === 0 && resolved === 0) {
    return (
      <Card className="p-6 text-center">
        <CalendarClock className="size-8 mx-auto text-emerald-500 mb-2" />
        <h3 className="text-sm font-semibold">No rollover triage</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Unfinished tasks move here at midnight for explicit review — never auto-rolled.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Morning Triage Queue</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {triageTasks.length} task{triageTasks.length !== 1 ? 's' : ''} rolled over from yesterday. Decide what stays, what incubates, what goes.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {triageTasks.map((task) => {
          const catColor = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Admin;
          const eisen = EISENHOWER_LABELS[task.eisenhowerCategory];
          return (
            <Card key={task.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-sm font-medium">{task.title}</h4>
                {task.rolledOverCount > 0 && (
                  <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-500/40 bg-amber-500/10 shrink-0">
                    ×{task.rolledOverCount} rollover
                  </Badge>
                )}
              </div>
              {task.notes && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.notes}</p>}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <Badge variant="outline" className={cn('text-[10px]', catColor)}>{task.category}</Badge>
                <Badge variant="outline" className="text-[10px]">{formatDuration(task.estimatedMinutes)}</Badge>
                <Badge variant="outline" className="text-[10px]">{eisen.short}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => handleResolve(task.id, 'schedule_today', task.title)}>
                  <CalendarClock className="size-3" /> Today
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleResolve(task.id, 'incubator', task.title)}>
                  <Lightbulb className="size-3" /> Incubate
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => handleResolve(task.id, 'delete', task.title)}>
                  <Trash2 className="size-3" /> Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {triageTasks.length > 0 && (
        <Button onClick={() => void completeTriage()} className="w-full">
          Mark triage complete (+15 pts · streak++)
        </Button>
      )}
    </div>
  );
}
