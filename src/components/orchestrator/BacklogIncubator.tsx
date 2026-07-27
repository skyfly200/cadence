'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, useDndContext,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
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

const CATEGORIES: EisenhowerCategory[] = ['do_first', 'schedule', 'delegate', 'eliminate'];

/* ═══════════════════════════════════════════════════════════════
   Floating drag overlay — shows what you're dragging
   ═══════════════════════════════════════════════════════════════ */
function DragOverlayCard({ task }: { task: Task }) {
  const catColor = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Admin;
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background shadow-lg px-2 py-1.5 max-w-[280px] opacity-90 rotate-2 scale-105">
      <GripVertical className="size-3 text-muted-foreground shrink-0" />
      <span className="text-xs font-medium truncate">{task.title}</span>
      <span className={cn('inline-block rounded px-1 py-px font-medium shrink-0 text-[10px]', catColor)}>{task.category}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{formatDuration(task.estimatedMinutes)}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shared compact table row — list view (buttons hover-only)
   ═══════════════════════════════════════════════════════════════ */
function TaskRow({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const completeTask = useAppStore((s) => s.completeTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
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
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

/* ═══════════════════════════════════════════════════════════════
   Draggable wrapper for list view (timeline drops)
   ═══════════════════════════════════════════════════════════════ */
function DraggableListRow({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `task:${task.id}` });
  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-30')} {...attributes} {...listeners}>
      <table className="w-full"><tbody><TaskRow task={task} onEdit={onEdit} /></tbody></table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Table header for list view
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   Matrix quadrant row — draggable item + insertion droppable
   ═══════════════════════════════════════════════════════════════ */
function MatrixRow({
  task, index, category, onEdit,
  isDraggingItem, showInsertBefore, showInsertAfter,
}: {
  task: Task; index: number; category: EisenhowerCategory;
  onEdit: (t: Task) => void;
  isDraggingItem: boolean;
  showInsertBefore: boolean;
  showInsertAfter: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `task:${task.id}`,
    data: { task, category, index },
  });
  const catColor = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Admin;

  return (
    <>
      {/* Insertion line above this row */}
      {showInsertBefore && (
        <tr>
          <td colSpan={5} className="px-0 py-0">
            <div className="h-0.5 bg-primary rounded-full mx-1" />
          </td>
        </tr>
      )}
      <tr
        ref={setNodeRef}
        className={cn(
          'group border-b border-border/50 last:border-0 hover:bg-muted/30 transition-all duration-200 cursor-grab active:cursor-grabbing',
          isDraggingItem && 'opacity-30 scale-[0.97] -translate-y-0.5',
        )}
        {...attributes}
        {...listeners}
      >
        <td className="px-1.5 py-1.5 w-6">
          <GripVertical className="size-3 text-muted-foreground/60 mx-auto" />
        </td>
        <td className="px-1.5 py-1.5 min-w-0">
          <span className="block text-xs font-medium truncate max-w-[200px] sm:max-w-[320px]">{task.title}</span>
        </td>
        <td className="px-1.5 py-1.5 text-[10px] whitespace-nowrap">
          <span className={cn('inline-block rounded px-1 py-px font-medium', catColor)}>{task.category}</span>
        </td>
        <td className="px-1.5 py-1.5 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
          {formatDuration(task.estimatedMinutes)}
        </td>
        <td className="px-1.5 py-1.5">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
      {/* Insertion line below last row (no more rows) */}
      {showInsertAfter && (
        <tr>
          <td colSpan={5} className="px-0 py-0">
            <div className="h-0.5 bg-primary rounded-full mx-1" />
          </td>
        </tr>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Quadrant card — droppable zone containing matrix rows
   ═══════════════════════════════════════════════════════════════ */
function QuadrantTable({
  tasks, onEdit, category,
  hoveredCategory, insertIndex,
}: {
  tasks: Task[]; onEdit: (t: Task) => void; category: EisenhowerCategory;
  hoveredCategory: EisenhowerCategory | null;
  insertIndex: number | null;
}) {
  const meta = EISENHOWER_LABELS[category];
  const { isOver, setNodeRef } = useDroppable({ id: `quadrant:${category}` });
  const active = useDndContext();
  const activeId = active.active ? String(active.active.id) : null;

  const isHovered = hoveredCategory === category;

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'p-2 transition-all duration-200',
        isHovered && 'ring-2 ring-primary/40 bg-primary/[0.03] shadow-sm',
        isOver && !isHovered && 'ring-2 ring-primary/30 bg-primary/[0.02]',
      )}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[11px] font-semibold">{meta.label}</span>
        <span className="text-[9px] text-muted-foreground tabular-nums">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div className={cn(
          'py-3 text-center transition-colors duration-200',
          isHovered && 'bg-primary/10 rounded-md',
        )}>
          <p className={cn('text-[10px] italic', isHovered ? 'text-primary' : 'text-muted-foreground')}>
            {isHovered ? 'Drop here' : 'No tasks'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody>
              {tasks.map((t, idx) => (
                <MatrixRow
                  key={t.id}
                  task={t}
                  index={idx}
                  category={category}
                  onEdit={onEdit}
                  isDraggingItem={activeId === `task:${t.id}`}
                  showInsertBefore={isHovered && insertIndex === idx}
                  showInsertAfter={isHovered && insertIndex === tasks.length && idx === tasks.length - 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Eisenhower Matrix — full DnD with overlay + insertion
   ═══════════════════════════════════════════════════════════════ */
function EisenhowerMatrix({ tasks, onEdit }: { tasks: Task[]; onEdit: (t: Task) => void }) {
  const updateTask = useAppStore((s) => s.updateTask);
  const { toast } = useToast();

  // Build grouped lookup
  const grouped = useMemo(() => {
    const map: Record<EisenhowerCategory, Task[]> = { do_first: [], schedule: [], delegate: [], eliminate: [] };
    for (const t of tasks) map[t.eisenhowerCategory].push(t);
    return map;
  }, [tasks]);

  // Track drag state
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<EisenhowerCategory | null>(null);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  // Temporarily reordered state during drag — synced back after drop
  const [liveTasks, setLiveTasks] = useState<Task[]>(tasks);

  useEffect(() => {
    setLiveTasks(tasks);
  }, [tasks]);

  // Compute live grouped from liveTasks
  const liveGrouped = useMemo(() => {
    const map: Record<EisenhowerCategory, Task[]> = { do_first: [], schedule: [], delegate: [], eliminate: [] };
    for (const t of liveTasks) map[t.eisenhowerCategory].push(t);
    return map;
  }, [liveTasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith('task:')) {
      const t = tasks.find((x) => x.id === id.slice(5));
      setActiveTask(t ?? null);
    }
  }, [tasks]);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || !activeTask) {
      setHoveredCategory(null);
      setInsertIndex(null);
      return;
    }

    // Determine which quadrant we're over
    let targetCategory: EisenhowerCategory | null = null;
    let targetIndex: number | null = null;

    if (overId.startsWith('quadrant:')) {
      targetCategory = overId.slice(9) as EisenhowerCategory;
      targetIndex = liveGrouped[targetCategory].length; // append at end
    } else if (overId.startsWith('task:')) {
      const overTaskId = overId.slice(5);
      for (const cat of CATEGORIES) {
        const idx = liveGrouped[cat].findIndex((t) => t.id === overTaskId);
        if (idx !== -1) {
          targetCategory = cat;
          const overRect = e.over?.rect;
          const activeRect = e.active?.rect?.current.translated;
          if (overRect && activeRect) {
            const activeCenterY = activeRect.top + activeRect.height / 2;
            const overCenterY = overRect.top + overRect.height / 2;
            targetIndex = activeCenterY < overCenterY ? idx : idx + 1;
          } else {
            targetIndex = idx + 1;
          }
          break;
        }
      }
    }

    setHoveredCategory(targetCategory);
    setInsertIndex(targetIndex);

    // Live reorder preview — move the dragged task in liveTasks
    if (targetCategory && targetIndex !== null && activeTask) {
      setLiveTasks((prev) => {
        // Remove from current position
        const filtered = prev.filter((t) => t.id !== activeTask.id);
        // Insert at target position
        const newCatList = filtered.filter((t) => t.eisenhowerCategory === targetCategory);
        const otherTasks = filtered.filter((t) => t.eisenhowerCategory !== targetCategory);
        const clampedIdx = Math.min(targetIndex, newCatList.length);
        newCatList.splice(clampedIdx, 0, { ...activeTask, eisenhowerCategory: targetCategory });
        return [...otherTasks, ...newCatList];
      });
    }
  }, [activeTask, liveGrouped]);

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    setHoveredCategory(null);
    setInsertIndex(null);

    if (!over || !activeTask) {
      setLiveTasks(tasks); // reset
      return;
    }

    const overId = String(over.id);
    let newCategory: EisenhowerCategory | null = null;

    if (overId.startsWith('quadrant:')) {
      newCategory = overId.slice(9) as EisenhowerCategory;
    } else if (overId.startsWith('task:')) {
      const overTaskId = overId.slice(5);
      for (const cat of CATEGORIES) {
        if (liveGrouped[cat].some((t) => t.id === overTaskId)) {
          newCategory = cat;
          break;
        }
      }
    }

    if (!newCategory) {
      setLiveTasks(tasks);
      return;
    }

    if (activeTask.eisenhowerCategory === newCategory) {
      setLiveTasks(tasks); // same quadrant, no change needed
      return;
    }

    const newLabel = EISENHOWER_LABELS[newCategory].label;
    await updateTask(activeTask.id, { eisenhowerCategory: newCategory });
    toast({ title: 'Moved', description: `${activeTask.title} → ${newLabel}` });
  }, [activeTask, tasks, liveGrouped, updateTask, toast]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-[auto_1fr_1fr] grid-rows-[auto_1fr_1fr] gap-1.5 items-start">
        {/* Column headers */}
        <div />
        <div className="text-[10px] font-semibold text-muted-foreground text-center pb-0.5">⚡ Urgent</div>
        <div className="text-[10px] font-semibold text-muted-foreground text-center pb-0.5">🌙 Not Urgent</div>

        {/* Row 1 — Important */}
        <div className="flex items-center justify-center">
          <span className="text-[10px] font-semibold text-muted-foreground -rotate-90 whitespace-nowrap origin-center">★ Important</span>
        </div>
        <QuadrantTable
          tasks={liveGrouped.do_first} onEdit={onEdit} category="do_first"
          hoveredCategory={hoveredCategory} insertIndex={insertIndex}
        />
        <QuadrantTable
          tasks={liveGrouped.schedule} onEdit={onEdit} category="schedule"
          hoveredCategory={hoveredCategory} insertIndex={insertIndex}
        />

        {/* Row 2 — Less Important */}
        <div className="flex items-center justify-center">
          <span className="text-[10px] font-semibold text-muted-foreground -rotate-90 whitespace-nowrap origin-center">☆ Less Impt.</span>
        </div>
        <QuadrantTable
          tasks={liveGrouped.delegate} onEdit={onEdit} category="delegate"
          hoveredCategory={hoveredCategory} insertIndex={insertIndex}
        />
        <QuadrantTable
          tasks={liveGrouped.eliminate} onEdit={onEdit} category="eliminate"
          hoveredCategory={hoveredCategory} insertIndex={insertIndex}
        />
      </div>

      {/* Floating overlay */}
      <DragOverlay dropAnimation={{ duration: 200 }}>
        {activeTask ? <DragOverlayCard task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════ */
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
