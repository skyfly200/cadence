<template>
  <Card class="p-0 overflow-hidden flex flex-col h-full">
    <!-- Header + date nav -->
    <div class="flex items-center justify-between px-2 sm:px-2.5 py-1.5 border-b shrink-0 gap-2">
      <div class="flex items-center gap-1.5 min-w-0">
        <Calendar class="size-3.5 shrink-0" />
        <h3 class="text-[11px] sm:text-xs font-semibold shrink-0">Timeline</h3>
        <span class="text-[9px] text-muted-foreground hidden md:inline">15-min grid · drag to schedule</span>
      </div>
      <div class="flex items-center gap-1">
        <Button size="icon" variant="ghost" class="size-6" aria-label="Previous day" @click="shiftDay(-1)"><ChevronLeft class="size-3.5" /></Button>
        <button class="text-[11px] font-medium min-w-[7.5rem] text-center tabular-nums hover:underline" @click="goToday">
          {{ dateLabel }}
        </button>
        <Button size="icon" variant="ghost" class="size-6" aria-label="Next day" @click="shiftDay(1)"><ChevronRight class="size-3.5" /></Button>
      </div>
    </div>

    <!-- Schedule tray -->
    <div v-if="unscheduledTasks.length > 0" class="border-b bg-muted/20 px-2 py-1.5 shrink-0">
      <div class="flex items-center gap-1 mb-1">
        <GripVertical class="size-3 text-muted-foreground" />
        <span class="text-[9px] text-muted-foreground">Drag a task onto a time slot to schedule it{{ isToday ? '' : ` on ${dateLabel}` }}</span>
      </div>
      <div class="flex gap-1.5 overflow-x-auto pb-0.5">
        <div v-for="t in unscheduledTasks" :key="t.id" draggable="true"
          :class="cn('shrink-0 flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] bg-background cursor-grab active:cursor-grabbing hover:shadow-sm transition-all',
            draggingTaskId === t.id && 'opacity-40')"
          @dragstart="onTaskDragStart(t.id)" @dragend="clearDrag">
          <GripVertical class="size-2.5 text-muted-foreground/50 shrink-0" />
          <span class="font-medium truncate max-w-[100px] sm:max-w-[140px]">{{ t.title }}</span>
          <span :class="cn('rounded px-1 py-px shrink-0', catColor(t.category))">{{ formatDuration(t.estimatedMinutes) }}</span>
        </div>
      </div>
    </div>

    <!-- Grid -->
    <div ref="scrollRef" class="flex-1 overflow-y-auto" style="max-height: calc(100dvh - 190px)">
      <div class="flex" :style="{ height: `${totalHeight}px` }">
        <!-- Hour labels -->
        <div class="relative shrink-0" :style="{ width: labelColWidth }">
          <div v-for="hl in hourLabels" :key="hl.hour"
            class="absolute right-1 sm:right-2 text-[9px] sm:text-[10px] text-muted-foreground font-medium tabular-nums"
            :style="{ top: `${hl.y - 6}px` }">
            {{ hl.label }}
          </div>
        </div>

        <!-- Track -->
        <div ref="gridEl" class="relative flex-1 border-l"
          @dragover="onDragOver" @drop="onDrop" @dragleave="overSlot = null">
          <!-- Hour gridlines -->
          <div v-for="hl in hourLabels" :key="`line-${hl.hour}`"
            class="absolute left-0 right-0 border-t border-border/50" :style="{ top: `${hl.y}px` }" />
          <!-- Half-hour lighter lines -->
          <div v-for="hy in halfHourYs" :key="`half-${hy}`"
            class="absolute left-0 right-0 border-t border-border/20" :style="{ top: `${hy}px` }" />

          <!-- Drop highlight band (15-min) -->
          <div v-if="overSlot !== null"
            class="absolute left-0 right-0 bg-primary/15 border-y border-primary/40 pointer-events-none"
            :style="{ top: `${overSlot * rowHeight}px`, height: `${rowHeight}px` }" />

          <!-- Blocks -->
          <div v-for="b in viewedBlocks" :key="b.id"
            draggable="true"
            :class="cn(
              'group absolute left-0.5 right-0.5 rounded-md border px-1 sm:px-1.5 shadow-sm overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md hover:z-10',
              isShort(b) ? 'py-0 flex items-center gap-1' : 'py-0.5',
              blockColor(b),
              draggingId === b.id && 'opacity-30',
              b.isAnchor && b.completed && 'opacity-60',
              b.isExternalEvent && 'cursor-not-allowed',
            )"
            :style="{ top: `${blockTop(b)}px`, height: `${blockHeight(b)}px` }"
            @dragstart="onBlockDragStart(b, $event)" @dragend="clearDrag">
            <template v-if="isShort(b)">
              <Lock v-if="b.isExternalEvent" class="size-2 shrink-0" />
              <span :class="cn('font-medium truncate text-[9px] flex-1', b.isAnchor && b.completed && 'line-through')">{{ b.title }}</span>
              <span class="text-[8px] opacity-70 tabular-nums shrink-0">{{ formatTime(b.startTime) }}</span>
              <button v-if="b.isAnchor" type="button"
                :class="cn('shrink-0 rounded-full border flex items-center justify-center size-3.5', b.completed ? 'bg-current/20 border-current' : 'border-current/40')"
                :aria-label="`Honor ${b.title}`" @pointerdown.stop @click.stop="store.toggleAnchorDone(b.id)">
                <Check v-if="b.completed" class="size-2" />
              </button>
            </template>
            <template v-else>
              <div class="flex items-start justify-between gap-1 h-full">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1">
                    <Lock v-if="b.isExternalEvent" class="size-2 sm:size-2.5 shrink-0" />
                    <span :class="cn('font-medium truncate text-[10px] sm:text-[11px]', b.isAnchor && b.completed && 'line-through')">{{ b.title }}</span>
                  </div>
                  <div class="text-[9px] sm:text-[10px] opacity-80">{{ formatRange(b.startTime, b.endTime) }}</div>
                </div>
                <div class="flex items-center gap-0.5 shrink-0">
                  <button v-if="b.isAnchor" type="button"
                    :class="cn('rounded-full border flex items-center justify-center size-4', b.completed ? 'bg-current/20 border-current' : 'border-current/40 hover:border-current')"
                    :aria-label="b.completed ? `Un-mark ${b.title}` : `Mark ${b.title} done`"
                    :title="b.completed ? 'Honored — tap to undo' : 'Mark as honored'"
                    @pointerdown.stop @click.stop="store.toggleAnchorDone(b.id)">
                    <Check v-if="b.completed" class="size-2.5" />
                  </button>
                  <button v-if="!b.isAnchor && !b.isExternalEvent" type="button"
                    class="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-0.5"
                    aria-label="Remove block" @pointerdown.stop @click.stop="store.deleteTimeBlock(b.id)">
                    <Trash2 class="size-3" />
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- Current-time indicator (only on today) -->
          <div v-if="isToday && nowVisible" class="absolute left-0 right-0 border-t-2 border-rose-500 pointer-events-none z-20" :style="{ top: `${nowY}px` }">
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
import { Trash2, Lock, Calendar, GripVertical, Check, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { ANCHOR_COLORS, CATEGORY_COLORS, EXTERNAL_EVENT_COLORS, type TimeBlock } from '~/lib/types';
import { formatTime, formatRange, formatDuration, blockDurationMinutes, isSameDay, format } from '~/lib/time-utils';
import { cn } from '~/lib/utils';
import { useToast } from '~/composables/useToast';

const START_HOUR = 5;
const END_HOUR = 24;
const VISIBLE_MIN = (END_HOUR - START_HOUR) * 60; // 1140
const SLOT = 15;                                   // minutes per grid slot
const SLOTS = VISIBLE_MIN / SLOT;                  // 76

const store = useAppStore();
const { toast } = useToast();

const scrollRef = ref<HTMLElement | null>(null);
const gridEl = ref<HTMLElement | null>(null);
const rowHeight = ref(14); // px per 15-min slot
const now = ref(new Date());
const selectedDate = ref(startOfDay(new Date()));
const overSlot = ref<number | null>(null);
const draggingId = ref<string | null>(null);
const draggingTaskId = ref<string | null>(null);

let clockInterval: ReturnType<typeof setInterval> | null = null;

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function updateRowHeight() {
  const w = window.innerWidth;
  rowHeight.value = w < 480 ? 12 : w < 768 ? 13 : w < 1280 ? 14 : 15;
}

onMounted(() => {
  updateRowHeight();
  window.addEventListener('resize', updateRowHeight);
  now.value = new Date();
  clockInterval = setInterval(() => { now.value = new Date(); }, 15_000);
  if (store.settings) void store.generateAnchors(selectedDate.value);
  syncViewedDay();
  setTimeout(scrollToNow, 150);
});

/** Pull Google Calendar events for whichever day is on screen. */
function syncViewedDay() {
  if (store.googleCalendar.connected) {
    void store.syncGoogleCalendar(format(selectedDate.value, 'yyyy-MM-dd'));
  }
}
onUnmounted(() => {
  window.removeEventListener('resize', updateRowHeight);
  if (clockInterval) clearInterval(clockInterval);
});

function scrollToNow() {
  const y = minutesFromStart(new Date()) / SLOT * rowHeight.value;
  scrollRef.value?.scrollTo({ top: Math.max(0, y - 120), behavior: 'smooth' });
}

// ── Date navigation ──────────────────────────────────────
const isToday = computed(() => isSameDay(selectedDate.value, new Date()));
const dateLabel = computed(() => {
  if (isToday.value) return 'Today';
  const t = startOfDay(new Date());
  const diff = Math.round((selectedDate.value.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return format(selectedDate.value, 'EEE, MMM d');
});
function shiftDay(n: number) {
  const d = new Date(selectedDate.value);
  d.setDate(d.getDate() + n);
  selectedDate.value = startOfDay(d);
  if (store.settings) void store.generateAnchors(selectedDate.value);
  syncViewedDay();
}
function goToday() {
  selectedDate.value = startOfDay(new Date());
  syncViewedDay();
}

// ── Blocks & tasks for the viewed day ────────────────────
const catColor = (c: string) => CATEGORY_COLORS[c] ?? CATEGORY_COLORS.Admin;
const viewedBlocks = computed(() =>
  store.timeBlocks.filter((b) => isSameDay(new Date(b.startTime), selectedDate.value)));
const scheduledTaskIds = computed(() => new Set(viewedBlocks.value.filter((b) => b.taskId).map((b) => b.taskId)));
const unscheduledTasks = computed(() => store.todayTasks.filter((t) => !scheduledTaskIds.value.has(t.id)));

function minutesFromStart(d: Date) { return d.getHours() * 60 + d.getMinutes() - START_HOUR * 60; }
function blockTop(b: TimeBlock) { return Math.max(0, minutesFromStart(new Date(b.startTime)) / SLOT * rowHeight.value); }
function blockHeight(b: TimeBlock) {
  const dur = blockDurationMinutes(b.startTime, b.endTime);
  return Math.max(rowHeight.value, dur / SLOT * rowHeight.value);
}
function isShort(b: TimeBlock) { return blockDurationMinutes(b.startTime, b.endTime) <= 20; }
function blockColor(b: TimeBlock): string {
  if (b.colorTag === 'travel') return 'bg-zinc-400/15 border-zinc-400/40 text-zinc-700 dark:text-zinc-300';
  if (b.colorTag === 'trip') return 'bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300';
  if (b.isExternalEvent) return EXTERNAL_EVENT_COLORS[b.colorTag ?? 'external'] ?? EXTERNAL_EVENT_COLORS.external;
  if (b.isAnchor && b.anchorType) return ANCHOR_COLORS[b.anchorType] ?? 'bg-muted border-border text-foreground';
  return CATEGORY_COLORS[b.colorTag ?? ''] ?? 'bg-primary/10 border-primary/30 text-foreground';
}

const totalHeight = computed(() => SLOTS * rowHeight.value);
const hourLabels = computed(() => {
  const arr: { hour: number; y: number; label: string }[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const hour = h % 24;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    arr.push({ hour: h, y: (h - START_HOUR) * 4 * rowHeight.value, label: `${display} ${ampm}` });
  }
  return arr;
});
const halfHourYs = computed(() => {
  const arr: number[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) arr.push(((h - START_HOUR) * 4 + 2) * rowHeight.value);
  return arr;
});
const labelColWidth = computed(() => (typeof window !== 'undefined' && window.innerWidth < 480 ? '2.75rem' : '3.5rem'));

const nowY = computed(() => minutesFromStart(now.value) / SLOT * rowHeight.value);
const nowVisible = computed(() => nowY.value >= 0 && nowY.value <= totalHeight.value);

// ── Drag & drop ──────────────────────────────────────────
function onBlockDragStart(b: TimeBlock, e: DragEvent) {
  if (b.isExternalEvent) { e.preventDefault(); return; }
  draggingTaskId.value = null;
  draggingId.value = b.id;
}
function onTaskDragStart(taskId: string) { draggingId.value = null; draggingTaskId.value = taskId; }
function clearDrag() { draggingId.value = null; draggingTaskId.value = null; overSlot.value = null; }

function slotFromEvent(e: DragEvent): number | null {
  const rect = gridEl.value?.getBoundingClientRect();
  if (!rect) return null;
  const y = e.clientY - rect.top;
  return Math.max(0, Math.min(SLOTS - 1, Math.floor(y / rowHeight.value)));
}
function onDragOver(e: DragEvent) {
  if (!draggingId.value && !draggingTaskId.value) return;
  e.preventDefault();
  overSlot.value = slotFromEvent(e);
}

function anchorCollision(start: Date, end: Date, exceptId: string | null): boolean {
  return viewedBlocks.value.some((b) =>
    b.isAnchor && b.id !== exceptId && start < new Date(b.endTime) && new Date(b.startTime) < end);
}
function slotStart(slot: number): Date {
  const start = new Date(selectedDate.value);
  start.setMinutes(START_HOUR * 60 + slot * SLOT, 0, 0);
  return start;
}

async function onDrop(e: DragEvent) {
  const slot = slotFromEvent(e);
  const taskId = draggingTaskId.value;
  const blockId = draggingId.value;
  clearDrag();
  if (slot === null) return;
  const start = slotStart(slot);

  if (taskId) {
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const end = new Date(start.getTime() + Math.max(SLOT, task.estimatedMinutes) * 60000);
    if (anchorCollision(start, end, null)) {
      toast({ title: 'Anchor collision', description: 'Cannot place a task over a health anchor.', variant: 'destructive' });
      return;
    }
    await store.moveTaskToTimeline(taskId, start.toISOString(), end.toISOString());
    toast({ title: 'Scheduled', description: `${task.title} · ${formatRange(start, end)}` });
    return;
  }

  if (blockId) {
    const b = store.timeBlocks.find((x) => x.id === blockId);
    if (!b) return;
    const dur = blockDurationMinutes(b.startTime, b.endTime);
    const end = new Date(start.getTime() + dur * 60000);
    // Task blocks can't overlap anchors; anchors themselves shift freely.
    if (!b.isAnchor && anchorCollision(start, end, blockId)) {
      toast({ title: 'Anchor collision', description: 'Cannot overlap an immovable anchor block.', variant: 'destructive' });
      return;
    }
    await store.updateTimeBlock(blockId, { startTime: start.toISOString(), endTime: end.toISOString() });
  }
}
</script>
