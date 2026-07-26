'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Pencil, Trash2, Clock, Play, AlertCircle, ArrowUpRight,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  CATEGORY_COLORS, EISENHOWER_LABELS, type Task,
} from '@/lib/types';
import { formatDuration } from '@/lib/time-utils';

interface Props {
  task: Task;
  compact?: boolean;
  draggable?: boolean;
  showActions?: boolean;
  onEdit?: (t: Task) => void;
}

export function TaskCard({ task, compact = false, draggable = false, showActions = true, onEdit }: Props) {
  const completeTask = useAppStore((s) => s.completeTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const startTimer = useAppStore((s) => s.startTimer);

  const catColor = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Admin;
  const eisen = EISENHOWER_LABELS[task.eisenhowerCategory];

  const handleComplete = () => void completeTask(task.id);
  const handleDelete = () => void deleteTask(task.id);
  const handleStartTimer = () => void startTimer(task.id, 'pomodoro');

  return (
    <Card
      className={cn(
        'group relative p-3 transition-all hover:shadow-md',
        draggable && 'cursor-grab active:cursor-grabbing',
        task.status === 'completed' && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={task.status === 'completed'}
          onCheckedChange={(v) => v && handleComplete()}
          className="mt-0.5"
          aria-label={`Complete ${task.title}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm font-medium leading-tight',
              task.status === 'completed' && 'line-through',
            )}>
              {task.title}
            </p>
            {task.rolledOverCount > 0 && (
              <span title={`Rolled over ${task.rolledOverCount}×`} className="shrink-0">
                <Badge variant="outline" className="text-[10px] gap-1 text-amber-700 border-amber-500/40 bg-amber-500/10">
                  <AlertCircle className="size-2.5" /> ×{task.rolledOverCount}
                </Badge>
              </span>
            )}
          </div>
          {!compact && task.notes && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.notes}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('text-[10px] font-medium', catColor)}>
              {task.category}
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Clock className="size-2.5" /> {formatDuration(task.estimatedMinutes)}
            </Badge>
            {task.actualMinutes > 0 && (
              <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-500/30 bg-emerald-500/10">
                {formatDuration(task.actualMinutes)} done
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]" title={`${eisen.label}: ${eisen.urgent ? 'urgent' : 'not urgent'} / ${eisen.important ? 'important' : 'not important'}`}>
              {eisen.short}
            </Badge>
          </div>
        </div>
      </div>

      {showActions && (
        <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {task.status !== 'completed' && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleStartTimer}>
              <Play className="size-3" /> Start
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="ghost" className="h-7" onClick={() => onEdit(task)} aria-label="Edit">
              <Pencil className="size-3" />
            </Button>
          )}
          {task.status !== 'today' && task.status !== 'completed' && (
            <Button
              size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => void updateTask(task.id, { status: 'today' })}
              title="Move to today"
            >
              <ArrowUpRight className="size-3" /> Today
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={handleDelete} aria-label="Delete">
            <Trash2 className="size-3" />
          </Button>
        </div>
      )}
    </Card>
  );
}
