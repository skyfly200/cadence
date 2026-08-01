<template>
  <Card class="p-0 overflow-hidden flex flex-col h-full">
    <div class="flex items-center justify-between px-2 sm:px-2.5 py-1.5 border-b shrink-0">
      <div class="flex items-center gap-1.5">
        <Calendar class="size-3.5" />
        <h3 class="text-[11px] sm:text-xs font-semibold">Timeline</h3>
        <span class="text-[9px] text-muted-foreground hidden sm:inline">drag tasks onto a slot · anchors locked</span>
      </div>
      <span class="text-[9px] text-muted-foreground tabular-nums">
        {{ scheduledCount }} scheduled · {{ anchorCount }} anchors
      </span>
    </div>

    <!-- Schedule tray: drag an unscheduled Today task onto a time slot -->
    <div v-if="unscheduledTasks.length > 0" class="border-b bg-muted/20 px-2 py-1.5 shrink-0">
      <div class="flex items-center gap-1 mb-1">
        <GripVertical class="size-3 text-muted-foreground" />
        <span class="text-[9px] text-muted-foreground">Drag a task onto a time slot to schedule it</span>
      </div>
      <div class="flex gap-1.5 overflow-x-auto pb-0.5">
        <div v-for="t in unscheduledTasks" :key="t.id" draggable="true"
          :class="cn(
            'shrink-0 flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] bg-background cursor-grab active:cursor-grabbing hover:shadow-sm transition-all',
            draggingTaskId === t.id && 'opacity-40',
          )"
          @dragstart="onTaskDragStart(t.id)"
          @dragend="draggingTaskId = null">
          <GripVertical class="size-2.5 text-muted-foreground/50 shrink-0" />
          <span class="font-medium truncate max-w-[100px] sm:max-w-[140px]">{{ t.title }}</span>
          <span :class="cn('rounded px-1 py-px shrink-0', catColor(t.category))">{{ formatDuration(t.estimatedMinutes) }}</span>
        </div>
      </div>
    </div>

    <div ref="scrollRef" class="flex-1 overflow-y-auto" style="max-height: calc(100dvh - 160px)">
      <div class="grid" :style="{
        gridTemplateColumns: `${labelColWidth} 1fr`,
        gridTemplateRows: `repeat(${VISIBLE_SLOTS}, ${rowHeight}px)`,
        height: `${gridHeight}px`,
      }">
        <!-- Hour labels -->
        <div class="relative col-start-1 row-start-1" :style="{ gridRow: `1 / span ${VISIBLE_SLOTS}` }">
          <div v-for="h in visibleLabels" :key="h.visibleRow"
            class="absolute right-1 sm:right-2 text-[9px] sm:text-[10px] text-muted-foreground font-medium tabular-nums"
            :style="{ top: `${(h.visibleRow - 1) * rowHeight - 7}px` }">
            {{ h.label }}
          </div>
        </div>

        <!-- Grid column -->
        <div class="relative col-start-2 row-start-1 border-l grid"
          :style="{ gridRow: `1 / span ${VISIBLE_SLOTS}`, gridTemplateRows: `repeat(${VISIBLE_SLOTS}, ${rowHeight}px)` }">
          <!-- Drop zones -->
          <div v-for="slot in slots" :key="`slot-${slot}`"
            :class="cn('border-t border-border/40 transition-colors', overSlot === slot && 'bg-primary/15')"
            :style="{ gridRow: slot - VISIBLE_ROW_OFFSET + 1 }"
            @dragover.prevent="overSlot = slot"
            @dragleave="overSlot === slot && (overSlot = null)"
            @drop="onDrop(slot)" />

          <!-- Blocks -->
          <div v-for="b in renderableBlocks" :key="b.id"
            :draggable="!b.isAnchor && !b.isExternalEvent"
            :class="cn(
              'group relative m-0.5 rounded-md border p-1 sm:p-1.5 text-[10px] sm:text-[11px] shadow-sm overflow-hidden',
              blockColor(b),
              b.isAnchor || b.isExternalEvent ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:shadow-md',
              draggingId === b.id && 'opacity-30',
            )"
            :style="{ gridRow: `${blockRow(b)} / span ${blockSpan(b)}` }"
            @dragstart="onDragStart(b)"
            @dragend="draggingId = null">
            <div class="flex items-start justify-between gap-1 h-full">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                  <Lock v-if="b.isAnchor || b.isExternalEvent" class="size-2 sm:size-2.5 shrink-0" />
                  <span class="font-medium truncate text-[10px] sm:text-[11px]">{{ b.title }}</span>
                </div>
                <div class="text-[9px] sm:text-[10px] opacity-80">{{ formatRange(b.startTime, b.endTime) }}</div>
              </div>
              <button v-if="!b.isAnchor && !b.isExternalEvent" type="button"
                class="opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0 transition-opacity p-0.5"
                aria-label="Remove block"
                @pointerdown.stop @click.stop="store.deleteTimeBlock(b.id)">
                <Trash2 class="size-3" />
              </button>
            </div>
          </div>

          <!-- Current time indicator -->
          <div v-if="nowVisible" class="absolute left-0 right-0 border-t-2 border-rose-500 pointer-events-none z-20" :style="{ top: `${nowTopPx}px` }">
            <span class="absolute -left-1 -top-1.5 size-2.5 rounded-full bg-rose-500 shadow" />
            <span class="absolute right-1 -top-3 text-[9px] font-semibold text-rose-600 bg-background px-1 rounded shadow-sm">{{ formatTime(now) }}</span>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Trash2, Lock, Calendar, GripVertical } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { ANCHOR_COLORS, CATEGORY_COLORS, EXTERNAL_EVENT_COLORS, type TimeBlock, type Task } from '~/lib/types';
import { SLOT_MINUTES, timeToGridRow, durationToRows, formatTime, formatRange, formatDuration, blockDurationMinutes } from '~/lib/time-utils';
import { cn } from '~/lib/utils';
import { useToast } from '~/composables/useToast';

const TIMELINE_START_HOUR = 5;
const VISIBLE_HOURS = 19;
const VISIBLE_ROW_OFFSET = TIMELINE_START_HOUR * 2;
const VISIBLE_SLOTS = VISIBLE_HOURS * 2;

const store = useAppStore();
const { toast } = useToast();
const scrollRef = ref<HTMLElement | null>(null);
const rowHeight = ref(28);
const now = ref(new Date());
const overSlot = ref<number | null>(null);
const draggingId = ref<string | null>(null);      // a timeline block being moved
const draggingTaskId = ref<string | null>(null);  // a task chip being scheduled

const catColor = (c: string) => CATEGORY_COLORS[c] ?? CATEGORY_COLORS.Admin;

// Today's tasks that don't yet have a block on the timeline — the schedule tray.
const scheduledTaskIds = computed(() =>
  new Set(store.todayBlocks.filter((b) => b.taskId).map((b) => b.taskId)));
const unscheduledTasks = computed(() =>
  store.todayTasks.filter((t) => !scheduledTaskIds.value.has(t.id)));

let clockInterval: ReturnType<typeof setInterval> | null = null;

function updateRowHeight() {
  const w = window.innerWidth;
  rowHeight.value = w < 480 ? 24 : w < 768 ? 26 : w < 1280 ? 28 : 30;
}

onMounted(() => {
  updateRowHeight();
  window.addEventListener('resize', updateRowHeight);
  now.value = new Date();
  clockInterval = setInterval(() => { now.value = new Date(); }, 15_000);
  // Generate anchors if today's are missing
  if (store.settings) void store.generateAnchors();
  setTimeout(() => {
    const absRow = timeToGridRow(new Date());
    const px = (absRow - VISIBLE_ROW_OFFSET - 1) * rowHeight.value;
    scrollRef.value?.scrollTo({ top: Math.max(0, px - 120), behavior: 'smooth' });
  }, 150);
});
onUnmounted(() => {
  window.removeEventListener('resize', updateRowHeight);
  if (clockInterval) clearInterval(clockInterval);
});

// Fix: only render today's blocks.
const dayBlocks = computed(() => store.todayBlocks);
const scheduledCount = computed(() => dayBlocks.value.filter((b) => !b.isAnchor).length);
const anchorCount = computed(() => dayBlocks.value.filter((b) => b.isAnchor).length);

const renderableBlocks = computed(() => dayBlocks.value.filter((b) => {
  const vr = timeToGridRow(new Date(b.startTime)) - VISIBLE_ROW_OFFSET;
  return vr >= 1 && vr <= VISIBLE_SLOTS;
}));

function blockRow(b: TimeBlock) { return timeToGridRow(new Date(b.startTime)) - VISIBLE_ROW_OFFSET; }
function blockSpan(b: TimeBlock) { return durationToRows(blockDurationMinutes(b.startTime, b.endTime)); }
function blockColor(b: TimeBlock): string {
  if (b.isExternalEvent) return EXTERNAL_EVENT_COLORS[b.colorTag ?? 'external'] ?? EXTERNAL_EVENT_COLORS.external;
  if (b.isAnchor && b.anchorType) return ANCHOR_COLORS[b.anchorType] ?? 'bg-muted border-border text-foreground';
  return CATEGORY_COLORS[b.colorTag ?? ''] ?? 'bg-primary/10 border-primary/30 text-foreground';
}

const hourLabels = computed(() => {
  const labels: { visibleRow: number; label: string }[] = [];
  for (let h = TIMELINE_START_HOUR; h < TIMELINE_START_HOUR + VISIBLE_HOURS; h++) {
    const hour = h % 24;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const absRow = hour * 2 + 1;
    labels.push({ visibleRow: absRow - VISIBLE_ROW_OFFSET, label: `${display} ${ampm}` });
  }
  return labels;
});
const visibleLabels = computed(() => {
  if (typeof window === 'undefined') return hourLabels.value;
  return window.innerWidth >= 768 ? hourLabels.value.filter((_, i) => i % 2 === 0) : hourLabels.value;
});
const slots = computed(() => {
  const arr: number[] = [];
  for (let i = TIMELINE_START_HOUR * 2; i < (TIMELINE_START_HOUR + VISIBLE_HOURS) * 2; i++) arr.push(i);
  return arr;
});

const nowMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes());
const nowTopPx = computed(() => ((nowMinutes.value - TIMELINE_START_HOUR * 60) / SLOT_MINUTES) * rowHeight.value);
const nowVisible = computed(() => nowTopPx.value >= 0 && nowTopPx.value <= VISIBLE_SLOTS * rowHeight.value);
const gridHeight = computed(() => VISIBLE_SLOTS * rowHeight.value);
const labelColWidth = computed(() => (typeof window !== 'undefined' && window.innerWidth < 480 ? '2.75rem' : '3.5rem'));

function onDragStart(b: TimeBlock) {
  if (b.isAnchor || b.isExternalEvent) return;
  draggingTaskId.value = null;
  draggingId.value = b.id;
}

function onTaskDragStart(taskId: string) {
  draggingId.value = null;
  draggingTaskId.value = taskId;
}

function anchorCollision(start: Date, end: Date, exceptBlockId: string | null): boolean {
  return store.timeBlocks.some((b) =>
    b.isAnchor && b.id !== exceptBlockId && start < new Date(b.endTime) && new Date(b.startTime) < end);
}

async function onDrop(slotIndex: number) {
  overSlot.value = null;
  const taskId = draggingTaskId.value;
  const blockId = draggingId.value;
  draggingTaskId.value = null;
  draggingId.value = null;

  const startMinutes = slotIndex * SLOT_MINUTES;
  const startDate = new Date();
  startDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

  // Scheduling a task from the tray onto the timeline.
  if (taskId) {
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const endDate = new Date(startDate.getTime() + Math.max(15, task.estimatedMinutes) * 60000);
    if (anchorCollision(startDate, endDate, null)) {
      toast({ title: 'Anchor collision', description: 'Cannot place a task over a health anchor.', variant: 'destructive' });
      return;
    }
    await store.moveTaskToTimeline(taskId, startDate.toISOString(), endDate.toISOString());
    toast({ title: 'Scheduled', description: `${task.title} · ${formatRange(startDate, endDate)}` });
    return;
  }

  // Moving an existing task block.
  if (blockId) {
    const block = store.timeBlocks.find((b) => b.id === blockId);
    if (!block || block.isAnchor) return;
    const dur = blockDurationMinutes(block.startTime, block.endTime);
    const endDate = new Date(startDate.getTime() + dur * 60000);
    if (anchorCollision(startDate, endDate, blockId)) {
      toast({ title: 'Anchor collision', description: 'Cannot overlap an immovable anchor block.', variant: 'destructive' });
      return;
    }
    await store.updateTimeBlock(blockId, { startTime: startDate.toISOString(), endTime: endDate.toISOString() });
  }
}
</script>
