<template>
  <Dialog :open="open" content-class="sm:max-w-md" @update:open="$emit('update:open', $event)" @keydown="handleKeydown">
    <div class="space-y-3">
      <div>
        <h2 class="text-sm font-semibold">{{ editTask ? 'Edit Task' : 'New Task' }}</h2>
      </div>

      <div class="space-y-2.5">
        <Input v-model="title" placeholder="What needs to be done?" class="text-sm h-9" />

        <div class="flex gap-2">
          <select v-model="category" class="flex-1 h-8 text-xs rounded-md border bg-background px-2 outline-none">
            <option v-for="c in TASK_CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="status" class="flex-1 h-8 text-xs rounded-md border bg-background px-2 outline-none">
            <option value="backlog">Backlog</option>
            <option value="today">Today</option>
            <option value="incubator">Incubator</option>
          </select>
        </div>

        <div class="flex items-center gap-1.5">
          <FolderOpen class="size-3 text-muted-foreground shrink-0" />
          <select v-model="projectId" class="flex-1 h-8 text-xs rounded-md border bg-background px-2 outline-none" @change="onProjectChange">
            <option :value="null">No project</option>
            <option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            <option value="__new__">＋ New project…</option>
          </select>
        </div>

        <div>
          <Label class="text-[11px] text-muted-foreground mb-1">Eisenhower</Label>
          <div class="grid grid-cols-4 gap-1">
            <button v-for="e in EISENHOWER" :key="e.value" type="button"
              :class="[
                'rounded-md px-1.5 py-1.5 text-[11px] font-medium text-center transition-colors leading-tight',
                eisenhower === e.value ? e.color + ' ring-1 ring-current/20' : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              ]"
              @click="eisenhower = e.value">
              {{ e.label }}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <Clock class="size-3 text-muted-foreground shrink-0" />
          <Input type="number" :min="5" :step="5" :model-value="estimatedMinutes" class="w-14 h-7 text-xs"
            @update:model-value="(v) => estimatedMinutes = Math.max(5, Number(v) || 5)" />
          <span class="text-[11px] text-muted-foreground">min</span>
          <button v-for="d in PRESET_DURATIONS" :key="d" type="button"
            :class="[
              'h-6 px-1.5 text-[11px] rounded transition-colors',
              estimatedMinutes === d ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted',
            ]"
            @click="estimatedMinutes = d">
            {{ formatDuration(d) }}
          </button>
          <button type="button" :disabled="estimating"
            class="h-6 px-1.5 text-[11px] rounded bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors ml-auto disabled:opacity-50"
            @click="runAiEstimate">
            <Loader2 v-if="estimating" class="size-3 animate-spin inline" />
            <Sparkles v-else class="size-3 inline -mt-0.5" />
            <span class="ml-1">AI</span>
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <Label class="text-[11px] text-muted-foreground shrink-0">Priority</Label>
          <div class="flex gap-1">
            <button v-for="p in [1,2,3,4,5]" :key="p" type="button"
              :class="[
                'size-6 text-[11px] rounded border transition-colors',
                priority === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted',
              ]"
              @click="priority = p">{{ p }}</button>
          </div>
        </div>

        <button v-if="!showNotes" type="button"
          class="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          @click="showNotes = true">
          <ChevronDown class="size-3" /> Add notes
        </button>
        <div v-else class="space-y-1">
          <div class="flex items-center justify-between">
            <Label class="text-[11px] text-muted-foreground">Notes</Label>
            <button type="button" class="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1" @click="showNotes = false">
              <ChevronUp class="size-3" /> Hide
            </button>
          </div>
          <Textarea v-model="notes" :rows="2" placeholder="Context, sub-steps, links…" class="text-xs" />
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" class="text-xs h-8" @click="$emit('update:open', false)">Cancel</Button>
        <Button size="sm" class="text-xs h-8" @click="save">{{ editTask ? 'Save changes' : 'Create' }} ⌘↵</Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Sparkles, Clock, Loader2, ChevronDown, ChevronUp, FolderOpen } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { TASK_CATEGORIES, PRESET_DURATIONS, type Task, type EisenhowerCategory, type TaskStatus } from '~/lib/types';
import { formatDuration } from '~/lib/time-utils';

const props = withDefaults(defineProps<{
  open: boolean;
  editTask?: Task | null;
  defaultStatus?: TaskStatus;
}>(), { defaultStatus: 'backlog' });
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>();

const store = useAppStore();
const { toast } = useToast();

const EISENHOWER: { value: EisenhowerCategory; label: string; color: string }[] = [
  { value: 'do_first', label: '⚡ Do First', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  { value: 'schedule', label: '📅 Schedule', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'delegate', label: '👥 Delegate', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { value: 'eliminate', label: '🗑 Eliminate', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
];

const title = ref('');
const notes = ref('');
const category = ref<string>('Admin');
const status = ref<TaskStatus>(props.defaultStatus);
const eisenhower = ref<EisenhowerCategory>('schedule');
const estimatedMinutes = ref(30);
const priority = ref(2);
const projectId = ref<string | null>(null);
const estimating = ref(false);
const showNotes = ref(false);

async function onProjectChange() {
  if (projectId.value === '__new__') {
    const name = window.prompt('New project name');
    const p = name ? await store.createProject(name) : null;
    projectId.value = p ? p.id : null;
  }
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) return;
  if (props.editTask) {
    const t = props.editTask;
    title.value = t.title;
    notes.value = t.notes ?? '';
    category.value = t.category;
    status.value = t.status;
    eisenhower.value = t.eisenhowerCategory;
    estimatedMinutes.value = t.estimatedMinutes;
    priority.value = t.priority;
    projectId.value = t.projectId ?? null;
    showNotes.value = !!t.notes;
  } else {
    title.value = ''; notes.value = ''; category.value = 'Admin';
    status.value = props.defaultStatus; eisenhower.value = 'schedule';
    estimatedMinutes.value = 30; priority.value = 2; projectId.value = null; showNotes.value = false;
  }
});

async function runAiEstimate() {
  if (!title.value.trim()) { toast({ title: 'Enter a title first', variant: 'destructive' }); return; }
  estimating.value = true;
  try {
    const r = await fetch('/api/ai/estimate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.value, notes: notes.value, category: category.value }),
    });
    const data = await r.json();
    if (data.estimatedMinutes) {
      estimatedMinutes.value = data.estimatedMinutes;
      toast({
        title: `Estimated ${formatDuration(data.estimatedMinutes)}`,
        description: `Confidence ${Math.round((data.confidence ?? 0) * 100)}%${data.reasoning ? ` · ${data.reasoning}` : ''}`,
      });
    }
  } catch {
    toast({ title: 'Estimate failed', variant: 'destructive' });
  } finally {
    estimating.value = false;
  }
}

async function save() {
  if (!title.value.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
  const payload = {
    title: title.value.trim(), notes: notes.value.trim() || undefined,
    category: category.value, status: status.value, eisenhowerCategory: eisenhower.value,
    estimatedMinutes: estimatedMinutes.value, priority: priority.value,
    projectId: projectId.value === '__new__' ? null : projectId.value,
  };
  if (props.editTask) {
    await store.updateTask(props.editTask.id, payload);
    toast({ title: 'Task updated' });
  } else {
    const t = await store.createTask(payload);
    if (t) toast({ title: 'Task created', description: `"${t.title}"` });
  }
  emit('update:open', false);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
}
</script>
