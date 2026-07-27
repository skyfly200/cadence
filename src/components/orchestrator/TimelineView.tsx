'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Trash2, Lock, Calendar, Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  ANCHOR_COLORS, CATEGORY_COLORS, type TimeBlock, type Task,
} from '@/lib/types';
import {
  SLOT_MINUTES, SLOTS_PER_DAY, timeToGridRow, durationToRows,
  formatTime, formatRange, formatDuration, blockDurationMinutes,
} from '@/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const TIMELINE_START_HOUR = 5; // show 5am onwards
const VISIBLE_HOURS = 19; // through midnight
const VISIBLE_ROW_OFFSET = TIMELINE_START_HOUR * 2; // 10 slots before visible range
const VISIBLE_SLOTS = VISIBLE_HOURS * 2; // 38 visible 30-min slots

// Responsive row height — use CSS variable for client-side detection
function useRowHeight() {
  const [rowHeight, setRowHeight] = useState(28);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480) setRowHeight(24);
      else if (w < 768) setRowHeight(26);
      else if (w < 1280) setRowHeight(28);
      else setRowHeight(30);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return rowHeight;
}

function toVisibleRow(absoluteRow: number): number {
  return absoluteRow - VISIBLE_ROW_OFFSET;
}

function BlockColor(block: TimeBlock): string {
  if (block.isAnchor && block.anchorType) {
    return ANCHOR_COLORS[block.anchorType] ?? 'bg-muted border-border text-foreground';
  }
  return CATEGORY_COLORS[block.colorTag ?? ''] ?? 'bg-primary/10 border-primary/30 text-foreground';
}

interface DraggableBlockProps {
  block: TimeBlock;
  rowHeight: number;
}

function DraggableBlock({ block, rowHeight }: DraggableBlockProps) {
  const {
    attributes, listeners, setNodeRef, isDragging,
  } = useDraggable({
    id: `block:${block.id}`,
    disabled: block.isAnchor,
  });
  const deleteTimeBlock = useAppStore((s) => s.deleteTimeBlock);

  const start = new Date(block.startTime);
  const end = new Date(block.endTime);
  const absRow = timeToGridRow(start);
  const visibleStartRow = toVisibleRow(absRow);
  const rowSpan = durationToRows(blockDurationMinutes(block.startTime, block.endTime));

  const colorClass = BlockColor(block);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative m-0.5 rounded-md border p-1 sm:p-1.5 text-[10px] sm:text-[11px] shadow-sm transition-opacity overflow-hidden',
        colorClass,
        isDragging && 'opacity-30',
        block.isAnchor ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:shadow-md',
      )}
      style={{
        gridRow: `${visibleStartRow} / span ${rowSpan}`,
      }}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-1 h-full">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {block.isAnchor && <Lock className="size-2 sm:size-2.5 shrink-0" />}
            <span className="font-medium truncate text-[10px] sm:text-[11px]">{block.title}</span>
          </div>
          <div className="text-[9px] sm:text-[10px] opacity-80">
            {formatRange(start, end)}
          </div>
        </div>
        {!block.isAnchor && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); void deleteTimeBlock(block.id); }}
            className="opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0 transition-opacity p-0.5"
            aria-label="Remove block"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function SlotDropZone({ slotIndex, rowHeight }: { slotIndex: number; rowHeight: number }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot:${slotIndex}`,
  });
  const visibleSlotRow = slotIndex - VISIBLE_ROW_OFFSET + 1;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-t border-border/40 transition-colors',
        isOver && 'bg-primary/15',
      )}
      style={{ gridRow: visibleSlotRow }}
    />
  );
}

export function TimelineView() {
  const timeBlocks = useAppStore((s) => s.timeBlocks);
  const tasks = useAppStore((s) => s.tasks);
  const moveTaskToTimeline = useAppStore((s) => s.moveTaskToTimeline);
  const updateTimeBlock = useAppStore((s) => s.updateTimeBlock);
  const generateAnchors = useAppStore((s) => s.generateAnchors);
  const settings = useAppStore((s) => s.settings);
  const { toast } = useToast();
  const [activeDrag, setActiveDrag] = useState<{ id: string; type: 'block' | 'task'; data?: Task | TimeBlock } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = useRowHeight();

  // Live clock for current-time indicator — updates every 15s
  const [now, setNow] = useState(() => new Date());
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!syncedRef.current) {
      syncedRef.current = true;
      requestAnimationFrame(() => setNow(new Date()));
    }
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const today = useMemo(() => new Date(), []);

  // Generate anchors once settings are loaded
  useEffect(() => {
    if (settings && timeBlocks.filter((b) => b.isAnchor).length === 0) {
      void generateAnchors();
    }
  }, [settings, timeBlocks, generateAnchors]);

  const hourLabels = useMemo(() => {
    const labels: { visibleRow: number; label: string }[] = [];
    for (let h = TIMELINE_START_HOUR; h < TIMELINE_START_HOUR + VISIBLE_HOURS; h++) {
      const hour = h % 24;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const absRow = hour * 2 + 1;
      labels.push({ visibleRow: toVisibleRow(absRow), label: `${display} ${ampm}` });
    }
    return labels;
  }, []);

  // Responsive: show every hour on mobile, every 2 hours on md+
  const visibleLabels = useMemo(() => {
    // Use a state-based approach to avoid SSR issues
    if (typeof window === 'undefined') return hourLabels;
    return window.innerWidth >= 768
      ? hourLabels.filter((_, i) => i % 2 === 0)
      : hourLabels;
  }, [hourLabels]);

  const slots = useMemo(() => {
    const arr: number[] = [];
    for (let i = TIMELINE_START_HOUR * 2; i < (TIMELINE_START_HOUR + VISIBLE_HOURS) * 2; i++) arr.push(i);
    return arr;
  }, []);

  const onDragStart = useCallback((e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith('block:')) {
      const blockId = id.slice(6);
      const b = timeBlocks.find((x) => x.id === blockId);
      setActiveDrag({ id, type: 'block', data: b });
    } else if (id.startsWith('task:')) {
      const taskId = id.slice(5);
      const t = tasks.find((x) => x.id === taskId);
      setActiveDrag({ id, type: 'task', data: t });
    }
  }, [timeBlocks, tasks]);

  const onDragEnd = useCallback(async (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('slot:')) {
      toast({ title: 'Drop onto a timeline slot', variant: 'destructive' });
      return;
    }
    const slotIndex = Number(overId.slice(5));
    const startMinutes = slotIndex * SLOT_MINUTES;
    const startDate = new Date(today);
    startDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

    const activeId = String(active.id);
    if (activeId.startsWith('block:')) {
      const blockId = activeId.slice(6);
      const block = timeBlocks.find((b) => b.id === blockId);
      if (!block || block.isAnchor) return;
      const dur = blockDurationMinutes(block.startTime, block.endTime);
      const endDate = new Date(startDate.getTime() + dur * 60000);
      const collides = timeBlocks.some((b) =>
        b.id !== blockId && b.isAnchor &&
        startDate < new Date(b.endTime) && new Date(b.startTime) < endDate
      );
      if (collides) {
        toast({ title: 'Anchor collision', description: 'Cannot overlap an immovable anchor block.', variant: 'destructive' });
        return;
      }
      await updateTimeBlock(blockId, { startTime: startDate.toISOString(), endTime: endDate.toISOString() });
    } else if (activeId.startsWith('task:')) {
      const taskId = activeId.slice(5);
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const dur = task.estimatedMinutes;
      const endDate = new Date(startDate.getTime() + dur * 60000);
      const collides = timeBlocks.some((b) =>
        b.isAnchor &&
        startDate < new Date(b.endTime) && new Date(b.startTime) < endDate
      );
      if (collides) {
        toast({ title: 'Anchor collision', description: 'Cannot place a task over a health anchor.', variant: 'destructive' });
        return;
      }
      await moveTaskToTimeline(taskId, startDate.toISOString(), endDate.toISOString());
      toast({ title: 'Scheduled', description: `${task.title} · ${formatRange(startDate, endDate)}` });
    }
  }, [timeBlocks, tasks, today, moveTaskToTimeline, updateTimeBlock, toast]);

  // Scroll to current time on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const nowDate = new Date();
      const absRow = timeToGridRow(nowDate);
      const px = (toVisibleRow(absRow) - 1) * rowHeight;
      scrollRef.current?.scrollTo({ top: Math.max(0, px - 120), behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timer);
  }, [rowHeight]);

  // Exact pixel position for the red line
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTopPx = ((nowMinutes - TIMELINE_START_HOUR * 60) / SLOT_MINUTES) * rowHeight;
  const nowVisible = nowTopPx >= 0 && nowTopPx <= VISIBLE_SLOTS * rowHeight;

  const gridHeight = VISIBLE_SLOTS * rowHeight;

  // Responsive column widths
  const labelColWidth = typeof window !== 'undefined' && window.innerWidth < 480 ? '2.75rem' : '3.5rem';

  return (
    <Card className="p-0 overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-2 sm:px-2.5 py-1.5 border-b shrink-0">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          <h3 className="text-[11px] sm:text-xs font-semibold">Timeline</h3>
          <span className="text-[9px] text-muted-foreground hidden sm:inline">drag tasks · anchors locked</span>
        </div>
        <span className="text-[9px] text-muted-foreground tabular-nums">
          <span className="hidden xs:inline">{timeBlocks.filter((b) => !b.isAnchor).length} scheduled · {timeBlocks.filter((b) => b.isAnchor).length} anchors</span>
          <span className="xs:hidden">{timeBlocks.length} blocks</span>
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 160px)' }}>
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid" style={{
            gridTemplateColumns: `${labelColWidth} 1fr`,
            gridTemplateRows: `repeat(${VISIBLE_SLOTS}, ${rowHeight}px)`,
            height: `${gridHeight}px`,
          }}>
            {/* Hour labels column */}
            <div className="relative col-start-1 row-start-1" style={{ gridRow: `1 / span ${VISIBLE_SLOTS}` }}>
              {visibleLabels.map((h) => (
                <div
                  key={h.visibleRow}
                  className="absolute right-1 sm:right-2 text-[9px] sm:text-[10px] text-muted-foreground font-medium tabular-nums"
                  style={{ top: `${(h.visibleRow - 1) * rowHeight - 7}px` }}
                >
                  {h.label}
                </div>
              ))}
            </div>

            {/* Timeline grid column */}
            <div
              className="relative col-start-2 row-start-1 border-l grid"
              style={{
                gridRow: `1 / span ${VISIBLE_SLOTS}`,
                gridTemplateRows: `repeat(${VISIBLE_SLOTS}, ${rowHeight}px)`,
              }}
            >
              {/* Drop zones */}
              {slots.map((slot) => (
                <SlotDropZone key={slot} slotIndex={slot} rowHeight={rowHeight} />
              ))}

              {/* Blocks */}
              {timeBlocks.map((b) => {
                const start = new Date(b.startTime);
                const absRow = timeToGridRow(start);
                const visibleRow = toVisibleRow(absRow);
                if (visibleRow < 1 || visibleRow > VISIBLE_SLOTS) return null;
                return <DraggableBlock key={b.id} block={b} rowHeight={rowHeight} />;
              })}

              {/* Current time indicator */}
              {nowVisible && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-rose-500 pointer-events-none z-20"
                  style={{ top: `${nowTopPx}px` }}
                >
                  <span className="absolute -left-1 -top-1.5 size-2.5 rounded-full bg-rose-500 shadow" />
                  <span className="absolute right-1 -top-3 text-[9px] font-semibold text-rose-600 bg-background px-1 rounded shadow-sm">
                    {formatTime(now)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeDrag?.data ? (
              <div className={cn(
                'rounded-md border px-2 py-1 text-xs shadow-lg bg-background max-w-xs',
              )}>
                {(activeDrag.data as Task | TimeBlock).title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </Card>
  );
}
