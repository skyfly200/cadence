<template>
  <div class="space-y-2">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <component :is="isBacklog ? Inbox : Lightbulb" class="size-3.5 sm:size-4" />
        <span class="text-xs sm:text-sm font-semibold text-foreground">{{ title }}</span>
        <span class="text-[10px] tabular-nums">({{ filtered.length }})</span>
      </div>
      <div class="relative flex-1 min-w-[100px] sm:min-w-[120px] max-w-xs">
        <Search class="absolute left-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
        <Input v-model="query" placeholder="Search…" class="h-7 sm:h-6 pl-6 text-[11px] bg-muted/50 border-border/50" />
      </div>
      <div v-if="isBacklog" class="inline-flex rounded-md border border-border/50 overflow-hidden">
        <button :class="cn('size-7 sm:size-6 flex items-center justify-center', view === 'matrix' ? 'bg-muted' : 'hover:bg-muted/50')" aria-label="Matrix view" @click="view = 'matrix'"><Grid2x2 class="size-3" /></button>
        <button :class="cn('size-7 sm:size-6 flex items-center justify-center', view === 'list' ? 'bg-muted' : 'hover:bg-muted/50')" aria-label="List view" @click="view = 'list'"><ListIcon class="size-3" /></button>
      </div>
      <Button size="sm" variant="outline" class="h-7 sm:h-6 text-[11px] px-2 gap-1" @click="importOpen = true">
        <FileText class="size-3" /> <span class="hidden xs:inline">Import</span>
      </Button>
      <Button size="sm" variant="outline" class="h-7 sm:h-6 text-[11px] px-2 gap-1" @click="openCreate()">
        <Plus class="size-3" /> Add
      </Button>
    </div>

    <!-- Content -->
    <div v-if="filtered.length === 0" class="py-6 sm:py-8 text-center text-xs text-muted-foreground">
      {{ query ? 'No matches' : 'Empty — add tasks above or capture via voice' }}
    </div>

    <!-- Eisenhower matrix -->
    <div v-else-if="isBacklog && view === 'matrix'">
      <div class="grid grid-cols-1 gap-1.5 md:hidden">
        <QuadrantCard v-for="q in quadrantsMobile" :key="q.cat" :label="q.label" :cat="q.cat" :tasks="grouped[q.cat]"
          :hovered="hoveredCat === q.cat" @drop-task="onQuadrantDrop" @dragover-cat="hoveredCat = $event"
          @edit="openEdit" @drag-start="onTaskDragStart" @drag-end="onDragEnd" />
      </div>
      <div class="hidden md:grid grid-cols-[auto_1fr_1fr] grid-rows-[auto_1fr_1fr] gap-1.5 lg:gap-2 items-start">
        <div />
        <div class="text-[10px] font-semibold text-muted-foreground text-center pb-0.5">⚡ Urgent</div>
        <div class="text-[10px] font-semibold text-muted-foreground text-center pb-0.5">🌙 Not Urgent</div>
        <div class="flex items-center justify-center"><span class="text-[10px] font-semibold text-muted-foreground -rotate-90 whitespace-nowrap">★ Important</span></div>
        <QuadrantCard cat="do_first" :tasks="grouped.do_first" :hovered="hoveredCat === 'do_first'" @drop-task="onQuadrantDrop" @dragover-cat="hoveredCat = $event" @edit="openEdit" @drag-start="onTaskDragStart" @drag-end="onDragEnd" />
        <QuadrantCard cat="schedule" :tasks="grouped.schedule" :hovered="hoveredCat === 'schedule'" @drop-task="onQuadrantDrop" @dragover-cat="hoveredCat = $event" @edit="openEdit" @drag-start="onTaskDragStart" @drag-end="onDragEnd" />
        <div class="flex items-center justify-center"><span class="text-[10px] font-semibold text-muted-foreground -rotate-90 whitespace-nowrap">☆ Less Impt.</span></div>
        <QuadrantCard cat="delegate" :tasks="grouped.delegate" :hovered="hoveredCat === 'delegate'" @drop-task="onQuadrantDrop" @dragover-cat="hoveredCat = $event" @edit="openEdit" @drag-start="onTaskDragStart" @drag-end="onDragEnd" />
        <QuadrantCard cat="eliminate" :tasks="grouped.eliminate" :hovered="hoveredCat === 'eliminate'" @drop-task="onQuadrantDrop" @dragover-cat="hoveredCat = $event" @edit="openEdit" @drag-start="onTaskDragStart" @drag-end="onDragEnd" />
      </div>
    </div>

    <!-- List view (reorderable) -->
    <Card v-else class="overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wide">
              <th class="px-1.5 py-0.5 w-6"></th>
              <th class="px-1.5 py-0.5">Task</th>
              <th class="px-1.5 py-0.5 hidden xs:table-cell">Cat</th>
              <th class="px-1.5 py-0.5 hidden sm:table-cell">Est</th>
              <th class="px-1.5 py-0.5 text-right w-20"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(t, idx) in liveList" :key="t.id" draggable="true"
              :class="cn('group border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing', dragIndex === idx && 'opacity-40')"
              @dragstart="onListDragStart(idx)" @dragover.prevent="onListDragOver(idx)" @dragend="onListDragEnd">
              <td class="px-1.5 py-1 w-6"><GripVertical class="size-3 text-muted-foreground/50" /></td>
              <td class="px-1.5 py-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <Checkbox :checked="t.status === 'completed'" :aria-label="`Complete ${t.title}`" @change="(v) => v ? store.completeTask(t.id) : store.uncompleteTask(t.id)" />
                  <span :class="cn('block text-xs font-medium truncate max-w-[150px] xs:max-w-[220px] sm:max-w-[320px] md:max-w-[480px]', t.status === 'completed' && 'line-through text-muted-foreground')">{{ t.title }}</span>
                </div>
              </td>
              <td class="px-1.5 py-1 text-[10px] whitespace-nowrap hidden xs:table-cell">
                <span :class="cn('inline-block rounded px-1 py-px font-medium', catColor(t.category))">{{ t.category }}</span>
              </td>
              <td class="px-1.5 py-1 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap hidden sm:table-cell">{{ formatDuration(t.estimatedMinutes) }}</td>
              <td class="px-1.5 py-1">
                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button v-if="t.status !== 'completed'" size="icon" variant="ghost" class="size-6" aria-label="Do today" title="Do today" @click="store.updateTask(t.id, { status: 'today' })"><CalendarClock class="size-3" /></Button>
                  <Button size="icon" variant="ghost" class="size-6" aria-label="Edit" @click="openEdit(t)"><Pencil class="size-3" /></Button>
                  <Button size="icon" variant="ghost" class="size-6 text-destructive hover:text-destructive" aria-label="Delete" @click="store.deleteTask(t.id)"><Trash2 class="size-3" /></Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <TaskFormDialog :open="createOpen" :edit-task="editTask" :default-status="variant" @update:open="createOpen = $event" />
    <NotesImporter :open="importOpen" :default-status="variant" @update:open="importOpen = $event" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Inbox, Lightbulb, Plus, Search, Grid2x2, List as ListIcon, Pencil, Trash2, CalendarClock, GripVertical, FileText } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { cn } from '~/lib/utils';
import { CATEGORY_COLORS, EISENHOWER_LABELS, type Task, type EisenhowerCategory } from '~/lib/types';
import { formatDuration } from '~/lib/time-utils';
import QuadrantCard from './QuadrantCard.vue';

const props = defineProps<{ variant: 'backlog' | 'incubator' }>();
const store = useAppStore();
const { toast } = useToast();

const view = ref<'matrix' | 'list'>(props.variant === 'backlog' ? 'matrix' : 'list');
const query = ref('');
const createOpen = ref(false);
const importOpen = ref(false);
const editTask = ref<Task | null>(null);

const isBacklog = computed(() => props.variant === 'backlog');
const title = computed(() => (isBacklog.value ? 'Backlog' : 'Idea Incubator'));
const catColor = (c: string) => CATEGORY_COLORS[c] ?? CATEGORY_COLORS.Admin;

const tasks = computed(() => store.tasks.filter((t) => t.status === props.variant));
const filtered = computed(() => tasks.value.filter((t) =>
  t.title.toLowerCase().includes(query.value.toLowerCase()) || t.notes?.toLowerCase().includes(query.value.toLowerCase())));

const grouped = computed(() => {
  const map: Record<EisenhowerCategory, Task[]> = { do_first: [], schedule: [], delegate: [], eliminate: [] };
  for (const t of filtered.value) map[t.eisenhowerCategory].push(t);
  return map;
});

const quadrantsMobile = [
  { cat: 'do_first' as EisenhowerCategory, label: 'Do First ⚡★' },
  { cat: 'schedule' as EisenhowerCategory, label: 'Schedule 🌙★' },
  { cat: 'delegate' as EisenhowerCategory, label: 'Delegate ⚡☆' },
  { cat: 'eliminate' as EisenhowerCategory, label: 'Eliminate 🌙☆' },
];

// Matrix drag
const draggingTaskId = ref<string | null>(null);
const hoveredCat = ref<EisenhowerCategory | null>(null);
function onTaskDragStart(id: string) { draggingTaskId.value = id; }
function onDragEnd() { draggingTaskId.value = null; hoveredCat.value = null; }
async function onQuadrantDrop(cat: EisenhowerCategory) {
  const id = draggingTaskId.value;
  hoveredCat.value = null;
  draggingTaskId.value = null;
  if (!id) return;
  const task = store.tasks.find((t) => t.id === id);
  if (!task || task.eisenhowerCategory === cat) return;
  await store.updateTask(id, { eisenhowerCategory: cat });
  toast({ title: 'Moved', description: `${task.title} → ${EISENHOWER_LABELS[cat].label}` });
}

// List reorder
const liveList = ref<Task[]>([]);
watch(filtered, (v) => { liveList.value = [...v]; }, { immediate: true });
const dragIndex = ref<number | null>(null);
function onListDragStart(idx: number) { dragIndex.value = idx; }
function onListDragOver(idx: number) {
  if (dragIndex.value === null || dragIndex.value === idx) return;
  const arr = [...liveList.value];
  const [moved] = arr.splice(dragIndex.value, 1);
  arr.splice(idx, 0, moved);
  liveList.value = arr;
  dragIndex.value = idx;
}
function onListDragEnd() {
  dragIndex.value = null;
  store.reorderTasks(liveList.value.map((t) => t.id));
}

function openCreate() { editTask.value = null; createOpen.value = true; }
function openEdit(t: Task) { editTask.value = t; createOpen.value = true; }
</script>
