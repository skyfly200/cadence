<template>
  <div class="space-y-2 sm:space-y-3">
    <!-- Capture -->
    <Card class="p-2 sm:p-3">
      <div class="flex items-center gap-1.5 mb-1.5">
        <NotebookPen class="size-3.5 text-purple-500" />
        <h3 class="text-xs sm:text-sm font-semibold">Brain Dump</h3>
        <span class="text-[10px] text-muted-foreground hidden sm:inline">scratch a thought — find it later by date, context, or content</span>
      </div>
      <div class="space-y-1.5">
        <div class="flex items-center gap-1.5">
          <Tag class="size-3 text-muted-foreground shrink-0" />
          <Input v-model="draftContext" placeholder="context (optional) — e.g. work, idea, errand"
            class="h-7 text-[11px] flex-1" @keydown="onDraftKeydown" />
        </div>
        <Textarea v-model="draftContent" :rows="2" placeholder="Dump a thought, idea, or note…  (⌘↵ to save)"
          class="text-xs min-h-0" @keydown="onDraftKeydown" />
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-muted-foreground">{{ draftContent.trim().length }} chars</span>
          <Button size="sm" class="h-7 text-[11px]" :disabled="!draftContent.trim()" @click="add">
            <Plus class="size-3" /> Add note
          </Button>
        </div>
      </div>
    </Card>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-1.5">
      <div class="relative flex-1 min-w-[130px] max-w-xs">
        <Search class="absolute left-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
        <Input v-model="search" placeholder="Search content or context…" class="h-7 pl-6 text-[11px] bg-muted/50" />
      </div>
      <select v-model="contextFilter" class="h-7 text-[11px] rounded-md border bg-background px-1.5 outline-none">
        <option value="">All contexts</option>
        <option v-for="c in contexts" :key="c" :value="c">{{ c }}</option>
      </select>
      <Input v-model="dateFilter" type="date" class="h-7 text-[11px] w-[9.5rem]" />
      <Button v-if="search || contextFilter || dateFilter" size="sm" variant="ghost" class="h-7 text-[10px] px-2" @click="clearFilters">
        <X class="size-3" /> Clear
      </Button>
      <span class="text-[10px] text-muted-foreground tabular-nums ml-auto">{{ filtered.length }} note{{ filtered.length !== 1 ? 's' : '' }}</span>
    </div>

    <!-- List -->
    <div v-if="grouped.length === 0" class="py-8 text-center text-xs text-muted-foreground">
      <NotebookPen class="size-5 mx-auto mb-1 text-muted-foreground/40" />
      {{ store.brainDump.length === 0 ? 'No notes yet — dump your first thought above.' : 'No notes match those filters.' }}
    </div>

    <div v-else class="space-y-3">
      <div v-for="group in grouped" :key="group.date">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-[11px] font-semibold">{{ formatDayHeader(group.date) }}</span>
          <span class="text-[9px] text-muted-foreground tabular-nums">{{ group.entries.length }}</span>
          <div class="flex-1 h-px bg-border/60" />
        </div>

        <div class="space-y-1.5">
          <Card v-for="e in group.entries" :key="e.id" class="p-2 group">
            <!-- Edit mode -->
            <div v-if="editingId === e.id" class="space-y-1.5">
              <Input v-model="editContext" placeholder="context (optional)" class="h-7 text-[11px]" />
              <Textarea v-model="editContent" :rows="3" class="text-xs min-h-0" />
              <div class="flex justify-end gap-1.5">
                <Button size="sm" variant="ghost" class="h-6 text-[10px] px-2" @click="cancelEdit">Cancel</Button>
                <Button size="sm" class="h-6 text-[10px] px-2" :disabled="!editContent.trim()" @click="saveEdit(e.id)">
                  <Check class="size-3" /> Save
                </Button>
              </div>
            </div>

            <!-- View mode -->
            <div v-else class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 mb-0.5">
                  <span class="text-[9px] text-muted-foreground tabular-nums">{{ formatTime(e.createdAt) }}</span>
                  <button v-if="e.context" type="button"
                    class="text-[9px] rounded px-1 py-px font-medium bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-colors"
                    title="Filter by this context"
                    @click="contextFilter = e.context!">
                    {{ e.context }}
                  </button>
                </div>
                <p class="text-xs whitespace-pre-wrap break-words">{{ e.content }}</p>
              </div>
              <div class="flex items-center gap-0.5 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" class="size-6" aria-label="Edit note" @click="startEdit(e)"><Pencil class="size-3" /></Button>
                <Button size="icon" variant="ghost" class="size-6 text-destructive hover:text-destructive" aria-label="Delete note" @click="store.deleteBrainDump(e.id)"><Trash2 class="size-3" /></Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { NotebookPen, Search, Plus, Pencil, Trash2, X, Tag, Check } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { formatTime, format } from '~/lib/time-utils';
import type { BrainDumpEntry } from '~/lib/types';

const store = useAppStore();
const { toast } = useToast();

// Capture
const draftContent = ref('');
const draftContext = ref('');

function add() {
  const text = draftContent.value.trim();
  if (!text) return;
  store.addBrainDump(text, draftContext.value);
  draftContent.value = '';
  // keep context so a run of related thoughts reuse the same tag
  toast({ title: 'Noted' });
}
function onDraftKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); }
}

// Filters
const search = ref('');
const contextFilter = ref('');
const dateFilter = ref('');
function clearFilters() { search.value = ''; contextFilter.value = ''; dateFilter.value = ''; }

const contexts = computed(() => {
  const set = new Set<string>();
  for (const e of store.brainDump) if (e.context) set.add(e.context);
  return [...set].sort((a, b) => a.localeCompare(b));
});

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim();
  return store.brainDump
    .filter((e) => {
      if (contextFilter.value && e.context !== contextFilter.value) return false;
      if (dateFilter.value && e.date !== dateFilter.value) return false;
      if (q && !e.content.toLowerCase().includes(q) && !(e.context ?? '').toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
});

const grouped = computed(() => {
  const map = new Map<string, BrainDumpEntry[]>();
  for (const e of filtered.value) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, entries]) => ({ date, entries }));
});

function formatDayHeader(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const today = format(new Date(), 'yyyy-MM-dd');
  const yest = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  if (date === today) return 'Today';
  if (date === yest) return 'Yesterday';
  return format(d, 'EEE, MMM d, yyyy');
}

// Edit
const editingId = ref<string | null>(null);
const editContent = ref('');
const editContext = ref('');
function startEdit(e: BrainDumpEntry) {
  editingId.value = e.id;
  editContent.value = e.content;
  editContext.value = e.context ?? '';
}
function cancelEdit() { editingId.value = null; }
function saveEdit(id: string) {
  if (!editContent.value.trim()) return;
  store.updateBrainDump(id, { content: editContent.value.trim(), context: editContext.value.trim() || null });
  editingId.value = null;
}
</script>
