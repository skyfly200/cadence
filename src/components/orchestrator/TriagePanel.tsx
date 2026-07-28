'use client';

import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Lightbulb, Trash2, CheckCircle2 } from 'lucide-react';
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
    const labels = { schedule_today: '→ today', incubator: '→ incubator', delete: 'deleted' };
    toast({ title: `${title} ${labels[action]}` });
  };

  const completeTriage = async () => {
    await setCapacity({ triageCompleted: true, triageStreak: (capacity?.triageStreak ?? 0) + 1 });
    await awardPoints('triage_streak', 15, 'Completed morning triage ritual');
    toast({ title: 'Triage complete', description: '+15 pts · streak++' });
  };

  if (triageTasks.length === 0 && resolved === 0) {
    return (
      <div className="py-6 sm:py-8 text-center text-xs text-muted-foreground">
        <CheckCircle2 className="size-4 mx-auto mb-1 text-emerald-500" />
        No rollover triage — unfinished tasks move here at midnight for review.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-semibold">{triageTasks.length} task{triageTasks.length !== 1 ? 's' : ''} to triage</span>
        {triageTasks.length > 0 && (
          <Button size="sm" variant="outline" className="h-7 sm:h-6 text-[10px] px-2" onClick={() => void completeTriage()}>
            Complete triage (+15 pts)
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[320px] sm:min-w-[500px]">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wide">
                <th className="px-2 sm:px-3 py-1">Task</th>
                <th className="px-2 py-1 hidden sm:table-cell">Cat</th>
                <th className="px-2 py-1 hidden sm:table-cell">Est</th>
                <th className="px-2 py-1 hidden md:table-cell">Eis</th>
                <th className="px-2 py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {triageTasks.map((task) => {
                const catColor = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Admin;
                const eisen = EISENHOWER_LABELS[task.eisenhowerCategory];
                return (
                  <tr key={task.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 min-w-0">
                      <div className="text-xs font-medium truncate max-w-[200px] sm:max-w-[280px]">{task.title}</div>
                      {task.notes && <div className="text-[10px] text-muted-foreground truncate hidden sm:block">{task.notes}</div>}
                    </td>
                    <td className="px-2 py-1.5 sm:py-2 hidden sm:table-cell">
                      <span className={cn('text-[9px] rounded px-1 py-px font-medium', catColor)}>{task.category}</span>
                    </td>
                    <td className="px-2 py-1.5 sm:py-2 text-[10px] text-muted-foreground tabular-nums hidden sm:table-cell">{formatDuration(task.estimatedMinutes)}</td>
                    <td className="px-2 py-1.5 sm:py-2 hidden md:table-cell">
                      <span className="inline-block rounded border border-border/60 px-1 py-px text-[9px] text-muted-foreground">{eisen.short}</span>
                    </td>
                    <td className="px-2 py-1.5 sm:py-2">
                      <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                        <Button size="sm" variant="default" className="h-6 sm:h-5 text-[9px] sm:text-[9px] px-1.5 sm:px-1.5 gap-0.5" onClick={() => handleResolve(task.id, 'schedule_today', task.title)}>
                          <CalendarClock className="size-2.5 sm:size-2.5" /> <span className="hidden xs:inline">Today</span>
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 sm:h-5 text-[9px] sm:text-[9px] px-1.5 sm:px-1.5 gap-0.5" onClick={() => handleResolve(task.id, 'incubator', task.title)}>
                          <Lightbulb className="size-2.5 sm:size-2.5" /> <span className="hidden xs:inline">Incubate</span>
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 sm:h-5 text-[9px] sm:text-[9px] px-1.5 sm:px-1.5 text-destructive hover:text-destructive gap-0.5" onClick={() => handleResolve(task.id, 'delete', task.title)}>
                          <Trash2 className="size-2.5 sm:size-2.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
