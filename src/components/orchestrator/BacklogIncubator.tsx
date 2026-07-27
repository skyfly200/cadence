'use client';

import { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Inbox, Lightbulb, Plus, Search, Grid2x2, List as ListIcon,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { TaskCard } from './TaskCard';
import { TaskFormDialog } from './TaskFormDialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { EISENHOWER_LABELS, type Task, type EisenhowerCategory } from '@/lib/types';

function DraggableTaskCard({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn('transition-opacity', isDragging && 'opacity-30')}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onEdit={onEdit} draggable compact showActions />
    </div>
  );
}

function EisenhowerMatrix({ tasks, onEdit }: { tasks: Task[]; onEdit: (t: Task) => void }) {
  const quadrants: EisenhowerCategory[] = ['do_first', 'schedule', 'delegate', 'eliminate'];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {quadrants.map((q) => {
        const items = tasks.filter((t) => t.eisenhowerCategory === q);
        const meta = EISENHOWER_LABELS[q];
        return (
          <Card key={q} className="p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-[11px] font-semibold">{meta.label}</h4>
              <Badge variant="outline" className="text-[9px] px-1.5">{items.length}</Badge>
            </div>
            <div className="space-y-1">
              {items.map((t) => (
                <DraggableTaskCard key={t.id} task={t} onEdit={onEdit} />
              ))}
              {items.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic py-3 text-center">No tasks</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

interface Props {
  variant: 'backlog' | 'incubator';
}

export function BacklogIncubator({ variant }: Props) {
  const allTasks = useAppStore((s) => s.tasks);
  const [view, setView] = useState<'matrix' | 'list'>(variant === 'backlog' ? 'matrix' : 'list');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const tasks = useMemo(() => allTasks.filter((t) => t.status === variant), [allTasks, variant]);
  const filtered = useMemo(() => tasks.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.notes?.toLowerCase().includes(query.toLowerCase())
  ), [tasks, query]);

  const isBacklog = variant === 'backlog';
  const Icon = isBacklog ? Inbox : Lightbulb;
  const title = isBacklog ? 'Backlog' : 'Idea Incubator';
  const desc = isBacklog
    ? 'Active tasks waiting to be scheduled. Drag onto the timeline or sort by Eisenhower quadrant.'
    : 'Someday/maybe holding zone for creative sparks and future projects — kept out of daily planning.';

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              'rounded-md p-2',
              isBacklog ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300' : 'bg-purple-500/10 text-purple-600 dark:text-purple-300'
            )}>
              <Icon className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{desc}</p>
            </div>
          </div>
          <Button size="sm" onClick={() => { setEditTask(null); setCreateOpen(true); }}>
            <Plus className="size-3" /> Add
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}…`}
              className="h-8 pl-7 text-sm"
            />
          </div>
          {isBacklog && (
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as 'matrix' | 'list')} size="sm">
              <ToggleGroupItem value="matrix" aria-label="Matrix view"><Grid2x2 className="size-3.5" /></ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view"><ListIcon className="size-3.5" /></ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Icon className="size-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {query ? 'No matching tasks.' : `No tasks in your ${title.toLowerCase()} yet.`}
          </p>
        </Card>
      ) : isBacklog && view === 'matrix' ? (
        <EisenhowerMatrix tasks={filtered} onEdit={(t) => { setEditTask(t); setCreateOpen(true); }} />
      ) : (
        <div className="space-y-1">
          {filtered.map((t) => (
            <DraggableTaskCard key={t.id} task={t} onEdit={(t) => { setEditTask(t); setCreateOpen(true); }} />
          ))}
        </div>
      )}

      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editTask={editTask}
        defaultStatus={variant}
      />
    </div>
  );
}
