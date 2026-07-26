'use client';

import { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Plus, Clock, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { TaskCard } from './TaskCard';
import { TaskFormDialog } from './TaskFormDialog';
import { TimerPanel } from './TimerPanel';
import { CapacityPanel } from './CapacityPanel';
import { GamificationPanel } from './GamificationPanel';
import { VoiceInput } from './VoiceInput';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, type Task } from '@/lib/types';
import { formatDuration } from '@/lib/time-utils';

function DraggableTodayTask({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `task:${task.id}` });
  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-30')} {...attributes} {...listeners}>
      <TaskCard task={task} onEdit={onEdit} draggable />
    </div>
  );
}

export function Dashboard() {
  const tasks = useAppStore((s) => s.tasks);
  const capacity = useAppStore((s) => s.capacity);
  const startTimer = useAppStore((s) => s.startTimer);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const todayTasks = useMemo(() => tasks.filter((t) => t.status === 'today'), [tasks]);
  const completedToday = useMemo(() => tasks.filter(
    (t) => t.status === 'completed' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()
  ), [tasks]);
  const triageTasks = useMemo(() => tasks.filter((t) => t.status === 'triage_review'), [tasks]);

  const totalEstimated = todayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const totalActual = completedToday.reduce((s, t) => s + t.actualMinutes, 0);
  const maxFocus = capacity?.maxAllowedFocusMinutes ?? 270;
  const budgetPct = Math.min(100, Math.round((totalEstimated / maxFocus) * 100));
  const overBudget = totalEstimated > maxFocus;

  return (
    <div className="space-y-4">
      {/* Voice capture */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-1">Quick Capture</h3>
            <p className="text-xs text-muted-foreground">Type a task or tap the mic and speak — e.g. &ldquo;Add design new poster to Incubator list&rdquo;</p>
          </div>
          <div className="flex-1 min-w-0">
            <VoiceInput />
          </div>
        </div>
      </Card>

      {/* Triage alert */}
      {triageTasks.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">{triageTasks.length} task{triageTasks.length !== 1 ? 's' : ''} need triage</p>
                <p className="text-xs text-muted-foreground">Rolled over from previous days — review before planning today.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setActiveTab('triage')}>Review now</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today list (main, spans 2) */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Today&apos;s Plan</h3>
                <p className="text-xs text-muted-foreground">
                  {todayTasks.length} scheduled · {completedToday.length} done · {formatDuration(totalEstimated)} planned
                </p>
              </div>
              <Button size="sm" onClick={() => { setEditTask(null); setCreateOpen(true); }}>
                <Plus className="size-3" /> Add task
              </Button>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Focus budget</span>
                <span className={cn('font-medium', overBudget && 'text-rose-600')}>
                  {formatDuration(totalEstimated)} / {formatDuration(maxFocus)}
                </span>
              </div>
              <Progress value={budgetPct} className={cn('h-2', overBudget && '[&>div]:bg-rose-500')} />
              {overBudget && (
                <p className="mt-1 text-[11px] text-rose-600">
                  Over by {formatDuration(totalEstimated - maxFocus)} — move low-priority items back to backlog.
                </p>
              )}
            </div>

            {todayTasks.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="size-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Drag tasks from the Backlog onto the Timeline.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {todayTasks.map((t) => (
                  <DraggableTodayTask key={t.id} task={t} onEdit={(t) => { setEditTask(t); setCreateOpen(true); }} />
                ))}
              </div>
            )}
          </Card>

          {completedToday.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <h3 className="text-sm font-semibold">Completed Today</h3>
                <Badge variant="outline" className="text-[10px]">{completedToday.length}</Badge>
              </div>
              <div className="space-y-1">
                {completedToday.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                    <span className="line-through text-muted-foreground">{t.title}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={cn('text-[10px]', CATEGORY_COLORS[t.category])}>{t.category}</Badge>
                      {t.actualMinutes > 0 && (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400">{formatDuration(t.actualMinutes)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar: capacity, timer, score */}
        <div className="space-y-3">
          <CapacityPanel />
          <TimerPanel />
          <GamificationPanel />
        </div>
      </div>

      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editTask={editTask}
        defaultStatus="today"
      />
    </div>
  );
}
