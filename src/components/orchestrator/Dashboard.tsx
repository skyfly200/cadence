'use client';

import { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Plus, Clock, Play, CheckCircle2, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { TaskFormDialog } from './TaskFormDialog';
import { TimerPanel } from './TimerPanel';
import { CapacityPanel } from './CapacityPanel';
import { GamificationPanel } from './GamificationPanel';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, EISENHOWER_LABELS, type Task } from '@/lib/types';
import { formatDuration } from '@/lib/time-utils';

function CompletedRow({ task }: { task: Task }) {
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  return (
    <div className="group flex items-center justify-between text-[11px] py-1 md:py-0.5 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Checkbox
          checked
          onCheckedChange={() => void uncompleteTask(task.id)}
          className="size-3.5 sm:size-4 shrink-0"
          aria-label={`Undo complete ${task.title}`}
        />
        <span className="line-through text-muted-foreground truncate text-xs sm:text-[11px]">{task.title}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={cn('text-[9px] rounded px-1 py-px', CATEGORY_COLORS[task.category])}>{task.category}</span>
        {task.actualMinutes > 0 && <span className="text-[9px] text-emerald-600 tabular-nums">{formatDuration(task.actualMinutes)}</span>}
      </div>
    </div>
  );
}

function DraggableTodayTask({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `task:${task.id}` });
  const completeTask = useAppStore((s) => s.completeTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const startTimer = useAppStore((s) => s.startTimer);
  const catColor = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Admin;

  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-30', 'flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1.5 md:py-1 rounded-md border border-border/50 bg-background hover:bg-muted/30 transition-colors group')} {...attributes} {...listeners}>
      <Checkbox
        checked={task.status === 'completed'}
        onCheckedChange={(v) => v ? void completeTask(task.id) : void uncompleteTask(task.id)}
        className="size-3.5 sm:size-4 shrink-0"
        aria-label={`Complete ${task.title}`}
      />
      <span className={cn('flex-1 min-w-0 text-xs font-medium truncate', task.status === 'completed' && 'line-through text-muted-foreground')}>
        {task.title}
      </span>
      <span className={cn('text-[9px] rounded px-1 py-px font-medium shrink-0 hidden sm:inline-block', catColor)}>{task.category}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 hidden xs:inline">{formatDuration(task.estimatedMinutes)}</span>
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {task.status !== 'completed' && (
          <Button size="icon" variant="ghost" className="size-6 sm:size-6" onClick={() => void startTimer(task.id, 'pomodoro')} aria-label="Start"><Play className="size-3" /></Button>
        )}
        <Button size="icon" variant="ghost" className="size-6 sm:size-6" onClick={() => onEdit(task)} aria-label="Edit"><Pencil className="size-3" /></Button>
        <Button size="icon" variant="ghost" className="size-6 sm:size-6 text-destructive hover:text-destructive" onClick={() => void deleteTask(task.id)} aria-label="Delete"><Trash2 className="size-3" /></Button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const tasks = useAppStore((s) => s.tasks);
  const capacity = useAppStore((s) => s.capacity);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const todayTasks = useMemo(() => tasks.filter((t) => t.status === 'today'), [tasks]);
  const completedToday = useMemo(() => tasks.filter(
    (t) => t.status === 'completed' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()
  ), [tasks]);
  const triageTasks = useMemo(() => tasks.filter((t) => t.status === 'triage_review'), [tasks]);

  const totalEstimated = todayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const maxFocus = capacity?.maxAllowedFocusMinutes ?? 270;
  const budgetPct = Math.min(100, Math.round((totalEstimated / maxFocus) * 100));
  const overBudget = totalEstimated > maxFocus;

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Triage alert — compact banner */}
      {triageTasks.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 sm:py-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5 text-amber-600 shrink-0" />
            <span className="text-xs font-medium">{triageTasks.length} task{triageTasks.length !== 1 ? 's' : ''} need triage</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 sm:h-6 text-[10px] sm:text-[10px] px-2 sm:px-2" onClick={() => setActiveTab('triage')}>Review</Button>
        </div>
      )}

      <div className="grid gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-3">
        {/* Today list */}
        <div className="md:col-span-2 lg:col-span-2">
          <Card className="p-2 sm:p-2.5 md:p-3">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-semibold">Today&apos;s Plan</h3>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">{todayTasks.length} scheduled · {completedToday.length} done</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 sm:h-6 text-[10px] px-2 sm:px-2" onClick={() => { setEditTask(null); setCreateOpen(true); }}>
                <Plus className="size-3" /> Add
              </Button>
            </div>

            <div className="mb-1.5 sm:mb-2">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground">Focus budget</span>
                <span className={cn('font-medium tabular-nums', overBudget && 'text-rose-600')}>
                  {formatDuration(totalEstimated)} / {formatDuration(maxFocus)}
                </span>
              </div>
              <Progress value={budgetPct} className={cn('h-1.5', overBudget && '[&>div]:bg-rose-500')} />
            </div>

            {todayTasks.length === 0 ? (
              <div className="py-6 sm:py-8 text-center">
                <Clock className="size-5 mx-auto text-muted-foreground/40 mb-1" />
                <p className="text-[11px] text-muted-foreground">Nothing scheduled. Drag from backlog or add above.</p>
              </div>
            ) : (
              <div className="space-y-0.5 max-h-[240px] xs:max-h-[280px] sm:max-h-[300px] md:max-h-[40vh] lg:max-h-[50vh] overflow-y-auto">
                {todayTasks.map((t) => (
                  <DraggableTodayTask key={t.id} task={t} onEdit={(t) => { setEditTask(t); setCreateOpen(true); }} />
                ))}
              </div>
            )}
          </Card>

          {/* Completed — single-line rows with undo */}
          {completedToday.length > 0 && (
            <Card className="p-2 sm:p-2.5 md:p-3 mt-2">
              <div className="flex items-center gap-1.5 mb-1 sm:mb-1.5">
                <CheckCircle2 className="size-3 text-emerald-600" />
                <h3 className="text-xs sm:text-sm font-semibold">Completed</h3>
                <Badge variant="outline" className="text-[9px] px-1">{completedToday.length}</Badge>
              </div>
              <div className="space-y-0">
                {completedToday.map((t) => (
                  <CompletedRow key={t.id} task={t} />
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-2 md:col-span-1">
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
