'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent,
} from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Inbox, Lightbulb, Plus, Search, Grid2x2, List as ListIcon,
  Pencil, Trash2, Play, GripVertical,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { TaskFormDialog } from './TaskFormDialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  CATEGORY_COLORS, EISENHOWER_LABELS, type Task, type EisenhowerCategory,
} from '@/lib/types';
import { formatDuration } from '@/lib/time-utils';
import { useToast } from '@/hooks/use-toast';

/* ── Shared compact table row (used by list & matrix views) ── */
function TaskRow({ task, onEdit, draggable = false }: {
  task: Task; onEdit: (t: Task) => void; draggable?: boolean;
}) {
  const completeTask = useAppStore((s) => s.completeTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const startTimer = useAppStore((s) => s.startTimer);

  const catColor = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Admin;

  return (
    <tr className="group border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-1.5 py-1.5 w-6">
        <Checkbox
          checked={task.status === 'completed'}
          onCheckedChange={(v) => v && void completeTask(task.id)}
          className="size-3.5"
          aria-label={`Complete ${task.title}`}
        />
      </td>
      <td className="px-1.5 py-1.5 min-w-0">
        <span className={cn(
          'block text-xs font-medium truncate max-w-[200px] sm:max-w-[320px]',
          task.status === 'completed' && 'line-through text-muted-foreground',
        )}>
          {task.title}
        </span>
      </td>
      <td className="px-1.5 py-1.5 text-[10px] whitespace-nowrap">
        <span className={cn('inline-block rounded px-1 py-px font-medium', catColor)}>{task.category}</span>
      </td>
      <td className="px-1.5 py-1.5 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDuration(task.estimatedMinutes)}
      </td>
      <td className="px-1.5 py-1.5">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
          {draggable && (
            <GripVertical className="size-3 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
          )}
          {task.status !== 'completed' && (
            <Button size="icon" variant="ghost" className="size-5" onClick={() => void startTimer(task.id, 'pomodoro')} aria-label="Start timer">
              <Play className="size-2.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="size-5" onClick={() => onEdit(task)} aria-label="Edit">
            <Pencil className="size-2.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-5 text-destructive hover:text-destructive" onClick={() => void deleteTask(task.id)} aria-label="Delete">
            <Trash2 className="size-2.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

/* ── Draggable task row for matrix ── */
function DraggableTaskRow({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { task },
  });
  return (
    <tr
      ref={setNodeRef}
      className={cn(
        'group border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
      {...attributes}
      {...listeners}
    >
      <td className="px-1.5 py-1.5 w-6">
        <GripVertical className="size-3 text-muted-foreground/60 mx-auto" />
      </td>
      <td className="px-1.5 py-1.5 min-w-0">
        <span className="block text-xs font-medium truncate max-w-[200px] sm:max-w-[320px]">
          {task.title}
        </span>
      </td>
      <td className="px-1.5 py-1.5 text-[10px] whitespace-nowrap">
        <span className={cn('inline-block rounded px-1 py-px font-medium', CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Admin)}>
          {task.category}
        </span>
      </td>
      <td className="px-1.5 py-1.5 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDuration(task.estimatedMinutes)}
      </td>
      <td className="px-1.5 py-1.5">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
          <Button size="icon" variant="ghost" className="size-5" onClick={(e) => { e.stopPropagation(); void useAppStore.getState().startTimer(task.id, 'pomodoro'); }} aria-label="Start timer">
            <Play className="size-2.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-5" onClick={(e) => { e.stopPropagation(); onEdit(task); }} aria-label="Edit">
            <Pencil className="size-2.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-5 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); void useAppStore.getState().deleteTask(task.id); }} aria-label="Delete">
            <Trash2 className="size-2.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

/* ── Draggable wrapper for dnd-kit (used by list view for timeline drops) ── */
function DraggableListRow({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `task:${task.id}` });
  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-30')} {...attributes} {...listeners}>
      <table className="w-full"><tbody><TaskRow task={task} onEdit={onEdit} draggable /></tbody></table>
    </div>
  );
}

/* ── Table header ── */
const TABLE_HEAD = (
  <thead>
    <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wide">
      <th className="px-1.5 py-1 text-left w-6"></th>
      <th className="px-1.5 py-1 text-left">Task</th>
      <th className="px-1.5 py-1 text-left">Cat</th>
      <th className="px-1.5 py-1 text-left">Est</th>
      <th className="px-1.5 py-1 text-right w-24"></th>
    </tr>
  </thead>
);

/* ── Eisenhower quadrant as droppable mini-table ── */
function QuadrantTable({ tasks, onEdit, category }: {
  tasks: Task[]; onEdit: (t: Task) => void; category: EisenhowerCategory;
}) {
  const meta = EISENHOWER_LABELS[category];
  const { isOver, setNodeRef } = useDroppable({ id: `quadrant:${category}` });

  return (
    <Card
      ref={setNodeRef}
      className={cn('p-2 transition-colors', isOver && 'ring-2 ring-primary/50 bg-primary/5')}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[11px] font-semibold">{meta.label}</span>
        <span className="text-[9px] text-muted-foreground tabular-nums">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic py-2 text-center">Drop tasks here</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left"><tbody>
            {tasks.map((t) => (
              <DraggableTaskRow key={t.id} task={t} onEdit={onEdit} />
            ))}
          </tbody></table>
        </div>
      )}
    </Card>
  );
}

/* ── Eisenhower Matrix with axis labels + drag between quadrants ── */
function EisenhowerMatrix({ tasks, onEdit }: { tasks: Task[]; onEdit: (t: Task) => void }) {
  const updateTask = useAppStore((s) => s.updateTask);
  const { toast } = useToast();

  const grouped = useMemo(() => {
    const map: Record<EisenhowerCategory, Task[]> = { do_first: [], schedule: [], delegate: [], eliminate: [] };
    for (const t of tasks) map[t.eisenhowerCategory].push(t);
    return map;
  }, [tasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('quadrant:')) return;

    const activeId = String(active.id);
    if (!activeId.startsWith('task:')) return;

    const newCategory = overId.slice(9) as EisenhowerCategory;
    const taskId = activeId.slice(5);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.eisenhowerCategory === newCategory) return;

    await updateTask(taskId, { eisenhowerCategory: newCategory });
    toast({
      title: 'Moved',
      description: `${task.title} → ${EISENHOWER_LABELS[newCategory].label}`,
    });
  }, [tasks, updateTask, toast]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-[auto_1fr_1fr] grid-rows-[auto_1fr_1fr] gap-1.5 items-start">
        {/* Column headers — Urgent / Not Urgent */}
        <div />
        <div className="text-[10px] font-semibold text-muted-foreground text-center pb-0.5">⚡ Urgent</div>
        <div className="text-[10px] font-semibold text-muted-foreground text-center pb-0.5">🌙 Not Urgent</div>

        {/* Row 1 — Important: Do First | Schedule */}
        <div className="flex items-center justify-center">
          <span className="text-[10px] font-semibold text-muted-foreground -rotate-90 whitespace-nowrap origin-center">★ Important</span>
        </div>
        <QuadrantTable tasks={grouped.do_first} onEdit={onEdit} category="do_first" />
        <QuadrantTable tasks={grouped.schedule} onEdit={onEdit} category="schedule" />

        {/* Row 2 — Not Important: Delegate | Eliminate */}
        <div className="flex items-center justify-center">
          <span className="text-[10px] font-semibold text-muted-foreground -rotate-90 whitespace-nowrap origin-center">☆ Less Impt.</span>
        </div>
        <QuadrantTable tasks={grouped.delegate} onEdit={onEdit} category="delegate" />
        <QuadrantTable tasks={grouped.eliminate} onEdit={onEdit} category="eliminate" />
      </div>
    </DndContext>
  );
}

/* ── Main component ── */
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

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3.5" />
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-[10px] tabular-nums">({filtered.length})</span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search…`}
            className="h-6 pl-6 text-[11px] bg-muted/50 border-border/50"
          />
        </div>
        {isBacklog && (
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as 'matrix' | 'list')} size="sm">
            <ToggleGroupItem value="matrix" aria-label="Matrix view" className="size-6"><Grid2x2 className="size-3" /></ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="size-6"><ListIcon className="size-3" /></ToggleGroupItem>
          </ToggleGroup>
        )}
        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => { setEditTask(null); setCreateOpen(true); }}>
          <Plus className="size-3" /> Add
        </Button>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          {query ? 'No matches' : 'Empty — add tasks above or capture via voice'}
        </div>
      ) : isBacklog && view === 'matrix' ? (
        <EisenhowerMatrix tasks={filtered} onEdit={(t) => { setEditTask(t); setCreateOpen(true); }} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {TABLE_HEAD}
              <tbody>
                {filtered.map((t) => (
                  <TaskRow key={t.id} task={t} onEdit={(t) => { setEditTask(t); setCreateOpen(true); }} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
