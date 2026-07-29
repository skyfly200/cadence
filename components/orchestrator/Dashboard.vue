<template>
  <div class="space-y-2 sm:space-y-3">
    <!-- Triage alert -->
    <div v-if="triageTasks.length > 0"
      class="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 sm:py-2">
      <div class="flex items-center gap-1.5">
        <AlertCircle class="size-3.5 text-amber-600 shrink-0" />
        <span class="text-xs font-medium">{{ triageTasks.length }} task{{ triageTasks.length !== 1 ? 's' : '' }} need triage</span>
      </div>
      <Button size="sm" variant="outline" class="h-7 sm:h-6 text-[10px] px-2" @click="store.setActiveTab('triage')">Review</Button>
    </div>

    <!-- Google Calendar sync bar -->
    <div v-if="gcal.connected"
      class="flex items-center justify-between gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-1.5">
      <div class="flex items-center gap-1.5">
        <CalendarClock class="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span class="text-[11px] font-medium">
          Google Calendar
          <span v-if="gcal.lastSyncAt" class="text-muted-foreground ml-1">· synced {{ syncTime }}</span>
        </span>
      </div>
      <Button size="sm" variant="outline" class="h-6 text-[10px] px-2 border-sky-500/30" :disabled="syncing" @click="handleSync">
        <RefreshCw :class="cn('size-3', syncing && 'animate-spin')" /> Sync
      </Button>
    </div>

    <div class="grid gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-3">
      <div class="md:col-span-1 lg:col-span-2 min-w-0">
        <Card class="p-2 sm:p-2.5 md:p-3 overflow-hidden">
          <div class="flex items-center justify-between mb-1.5 sm:mb-2">
            <div class="flex items-center gap-2">
              <h3 class="text-xs sm:text-sm font-semibold">Today's Plan</h3>
              <span class="text-[10px] text-muted-foreground hidden sm:inline">{{ todayTasks.length }} scheduled · {{ completedToday.length }} done</span>
            </div>
            <Button size="sm" variant="outline" class="h-7 sm:h-6 text-[10px] px-2" @click="openCreate()">
              <Plus class="size-3" /> Add
            </Button>
          </div>

          <div class="mb-1.5 sm:mb-2">
            <div class="flex items-center justify-between text-[10px] mb-0.5">
              <span class="text-muted-foreground">Focus budget</span>
              <span :class="cn('font-medium tabular-nums', overBudget && 'text-rose-600')">
                {{ formatDuration(totalEstimated) }} / {{ formatDuration(maxFocus) }}
              </span>
            </div>
            <Progress :value="budgetPct" :bar-class="overBudget ? 'bg-rose-500' : undefined" class="h-1.5" />
          </div>

          <!-- Today list -->
          <div v-if="todayTasks.length === 0" class="py-6 sm:py-8 text-center">
            <Clock class="size-5 mx-auto text-muted-foreground/40 mb-1" />
            <p class="text-[11px] text-muted-foreground">Nothing scheduled. Drag from backlog or add above.</p>
          </div>
          <div v-else class="space-y-0.5 max-h-[240px] xs:max-h-[280px] sm:max-h-[300px] md:max-h-[40vh] lg:max-h-[50vh] overflow-y-auto">
            <div v-for="(t, idx) in liveTasks" :key="t.id"
              draggable="true"
              :class="cn(
                'flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1.5 md:py-1 rounded-md border border-border/50 bg-background hover:bg-muted/30 transition-all group cursor-grab active:cursor-grabbing',
                dragIndex === idx && 'opacity-40',
              )"
              @dragstart="onDragStart(idx)"
              @dragover.prevent="onDragOver(idx)"
              @dragend="onDragEnd">
              <GripVertical class="size-3 text-muted-foreground/50 shrink-0" />
              <Checkbox :checked="t.status === 'completed'" :aria-label="`Complete ${t.title}`"
                @change="(v) => v && store.completeTask(t.id)" />
              <span :class="cn('flex-1 min-w-0 text-xs font-medium truncate', t.status === 'completed' && 'line-through text-muted-foreground')">{{ t.title }}</span>
              <span :class="cn('text-[9px] rounded px-1 py-px font-medium shrink-0 hidden sm:inline-block', catColor(t.category))">{{ t.category }}</span>
              <span class="text-[10px] text-muted-foreground tabular-nums shrink-0 hidden xs:inline">{{ formatDuration(t.estimatedMinutes) }}</span>
              <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button v-if="t.status !== 'completed'" size="icon" variant="ghost" class="size-6" aria-label="Start timer" title="Start timer" @click="store.startTimer(t.id, 'pomodoro')"><Play class="size-3" /></Button>
                <Button size="icon" variant="ghost" class="size-6" aria-label="Schedule" title="Schedule on timeline" @click="store.setActiveTab('timeline')"><CalendarClock class="size-3" /></Button>
                <Button size="icon" variant="ghost" class="size-6" aria-label="Edit" @click="openEdit(t)"><Pencil class="size-3" /></Button>
                <Button size="icon" variant="ghost" class="size-6 text-destructive hover:text-destructive" aria-label="Delete" @click="store.deleteTask(t.id)"><Trash2 class="size-3" /></Button>
              </div>
            </div>
          </div>
        </Card>

        <!-- Completed -->
        <Card v-if="completedToday.length > 0" class="p-2 sm:p-2.5 md:p-3 mt-2">
          <div class="flex items-center gap-1.5 mb-1 sm:mb-1.5">
            <CheckCircle2 class="size-3 text-emerald-600" />
            <h3 class="text-xs sm:text-sm font-semibold">Completed</h3>
            <Badge variant="outline" class="text-[9px] px-1">{{ completedToday.length }}</Badge>
          </div>
          <div>
            <div v-for="t in completedToday" :key="t.id"
              class="group flex items-center justify-between text-[11px] py-1 md:py-0.5 border-b border-border/40 last:border-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <Checkbox checked :aria-label="`Undo complete ${t.title}`" @change="store.uncompleteTask(t.id)" />
                <span class="line-through text-muted-foreground truncate text-xs sm:text-[11px]">{{ t.title }}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span :class="cn('text-[9px] rounded px-1 py-px', catColor(t.category))">{{ t.category }}</span>
                <span v-if="t.actualMinutes > 0" class="text-[9px] text-emerald-600 tabular-nums">{{ formatDuration(t.actualMinutes) }}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div class="space-y-2 md:col-span-1 min-w-0">
        <CapacityPanel />
        <TimerPanel />
        <GamificationPanel />
      </div>
    </div>

    <TaskFormDialog :open="createOpen" :edit-task="editTask" default-status="today" @update:open="createOpen = $event" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Plus, Clock, Play, CalendarClock, CheckCircle2, AlertCircle, Pencil, Trash2, GripVertical, RefreshCw } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { cn } from '~/lib/utils';
import { CATEGORY_COLORS, type Task } from '~/lib/types';
import { formatDuration } from '~/lib/time-utils';

const store = useAppStore();
const createOpen = ref(false);
const editTask = ref<Task | null>(null);
const syncing = ref(false);

const todayTasks = computed(() => store.todayTasks);
const completedToday = computed(() => store.completedToday);
const triageTasks = computed(() => store.triageTasks);
const gcal = computed(() => store.googleCalendar);
const capacity = computed(() => store.capacity);

const catColor = (c: string) => CATEGORY_COLORS[c] ?? CATEGORY_COLORS.Admin;

const totalEstimated = computed(() => todayTasks.value.reduce((s, t) => s + t.estimatedMinutes, 0));
const maxFocus = computed(() => capacity.value?.maxAllowedFocusMinutes ?? 270);
const budgetPct = computed(() => Math.min(100, Math.round((totalEstimated.value / maxFocus.value) * 100)));
const overBudget = computed(() => totalEstimated.value > maxFocus.value);
const syncTime = computed(() => gcal.value.lastSyncAt
  ? new Date(gcal.value.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

onMounted(() => store.loadGoogleCalendarStatus());

// Drag reorder (native)
const liveTasks = ref<Task[]>([]);
watch(todayTasks, (v) => { liveTasks.value = [...v]; }, { immediate: true });
const dragIndex = ref<number | null>(null);
function onDragStart(idx: number) { dragIndex.value = idx; }
function onDragOver(idx: number) {
  if (dragIndex.value === null || dragIndex.value === idx) return;
  const arr = [...liveTasks.value];
  const [moved] = arr.splice(dragIndex.value, 1);
  arr.splice(idx, 0, moved);
  liveTasks.value = arr;
  dragIndex.value = idx;
}
function onDragEnd() {
  dragIndex.value = null;
  store.reorderTasks(liveTasks.value.map((t) => t.id));
}

function openCreate() { editTask.value = null; createOpen.value = true; }
function openEdit(t: Task) { editTask.value = t; createOpen.value = true; }

async function handleSync() {
  syncing.value = true;
  await store.syncGoogleCalendar();
  syncing.value = false;
}
</script>
