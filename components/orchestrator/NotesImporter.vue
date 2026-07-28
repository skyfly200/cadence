<template>
  <Dialog :open="open" content-class="sm:max-w-2xl max-h-[90vh] overflow-y-auto" @update:open="handleClose">
    <div class="space-y-3">
      <div>
        <h2 class="flex items-center gap-2 text-sm font-semibold"><FileText class="size-4" /> Import from Notes</h2>
        <p class="text-[11px] text-muted-foreground mt-0.5">Paste your unstructured todo list — we'll parse it into tasks with AI-powered estimates and categorization.</p>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold flex items-center gap-1.5">
            <span class="size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">1</span>
            Paste your list
          </label>
          <span class="text-[10px] text-muted-foreground">Supports: bullets, numbers, checkboxes, plain text</span>
        </div>
        <textarea v-model="rawText" :disabled="status === 'parsing' || status === 'importing'"
          class="w-full min-h-[120px] lg:min-h-[160px] rounded-md border bg-background px-3 py-2 text-xs font-mono resize-y placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          :placeholder="placeholderText" />
        <div class="flex items-center gap-2">
          <Button size="sm" class="gap-1.5" :disabled="!rawText.trim() || status === 'parsing' || status === 'importing'" @click="handleParse">
            <Loader2 v-if="status === 'parsing'" class="size-3 animate-spin" /><Sparkles v-else class="size-3" />
            {{ status === 'parsing' ? 'Parsing…' : 'Parse with AI' }}
          </Button>
          <span v-if="rawText.trim() && status === 'idle'" class="text-[10px] text-muted-foreground">{{ lineCount }} lines detected</span>
        </div>
      </div>

      <div v-if="parsed.length > 0" class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold flex items-center gap-1.5">
            <span class="size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">2</span>
            Review ({{ selectedCount }}/{{ parsed.length }})
          </label>
          <div class="flex items-center gap-2">
            <Badge variant="outline" class="text-[9px]">{{ formatDuration(totalMinutes) }} total</Badge>
            <Badge v-if="duplicateCount > 0" variant="outline" class="text-[8px] px-1 py-0 border-amber-500/40 text-amber-600">
              {{ duplicateCount }} duplicate{{ duplicateCount !== 1 ? 's' : '' }} filtered
            </Badge>
            <Button size="sm" variant="ghost" class="h-6 text-[10px] px-2" @click="selectAll(selectedCount !== parsed.length)">
              {{ selectedCount === parsed.length ? 'Deselect all' : 'Select all' }}
            </Button>
          </div>
        </div>

        <Card class="overflow-hidden">
          <div class="max-h-[320px] overflow-y-auto divide-y divide-border/50">
            <div v-for="(item, idx) in parsed" :key="idx"
              :class="cn('flex items-start gap-2 px-2 py-1.5 hover:bg-muted/30 transition-colors', !item.selected && 'opacity-40')">
              <Checkbox :checked="item.selected" class="size-3.5 mt-0.5 shrink-0" @change="toggleItem(idx)" />
              <Badge v-if="item.isDuplicate" variant="outline" class="text-[8px] px-1 py-0 border-amber-500/40 text-amber-600 mt-0.5 shrink-0">Duplicate</Badge>
              <div class="flex-1 min-w-0 space-y-0.5">
                <Input :model-value="item.title" class="h-6 text-xs px-1.5" @update:model-value="(v) => item.title = v" />
                <div class="flex items-center gap-1.5 flex-wrap">
                  <select v-model="item.category" class="h-5 text-[10px] rounded border bg-background px-1 outline-none">
                    <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
                  </select>
                  <select v-model="item.eisenhowerCategory" class="h-5 text-[10px] rounded border bg-background px-1 outline-none">
                    <option v-for="e in EISENHOWER" :key="e" :value="e">{{ EISENHOWER_LABELS[e].label }}</option>
                  </select>
                  <Input type="number" :min="1" :max="1440" :model-value="item.estimatedMinutes" class="h-5 w-16 text-[10px] px-1"
                    @update:model-value="(v) => item.estimatedMinutes = Number(v) || 30" />
                  <span class="text-[9px] text-muted-foreground">min</span>
                  <Badge variant="outline" :class="cn('text-[9px] px-1 py-0', catColor(item.category))">{{ item.category }}</Badge>
                </div>
                <p v-if="item.notes" class="text-[10px] text-muted-foreground truncate">{{ item.notes }}</p>
              </div>
              <Button size="icon" variant="ghost" class="size-5 shrink-0 text-muted-foreground hover:text-destructive" @click="removeItem(idx)">
                <X class="size-3" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div v-if="parsed.length > 0" class="flex items-center justify-between pt-1">
        <div class="text-[11px] text-muted-foreground">
          <span v-if="selectedCount > 0" class="font-medium text-foreground">{{ selectedCount }} tasks</span> → {{ defaultStatus }}
        </div>
        <Button class="gap-1.5" :disabled="selectedCount === 0 || status === 'importing'" @click="handleImport">
          <Loader2 v-if="status === 'importing'" class="size-3.5 animate-spin" />
          <CheckCircle2 v-else-if="status === 'done'" class="size-3.5" />
          <Plus v-else class="size-3.5" />
          {{ status === 'importing' ? 'Importing…' : status === 'done' ? 'Done!' : `Import ${selectedCount} tasks` }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { FileText, Loader2, Sparkles, Plus, CheckCircle2, X } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { cn } from '~/lib/utils';
import { CATEGORY_COLORS, EISENHOWER_LABELS, type TaskStatus, type EisenhowerCategory, type TaskCategory } from '~/lib/types';
import { formatDuration } from '~/lib/time-utils';

interface ParsedTaskItem {
  title: string; notes: string | null; estimatedMinutes: number;
  category: TaskCategory; eisenhowerCategory: EisenhowerCategory; priority: number;
  selected: boolean; isDuplicate?: boolean;
}

const props = withDefaults(defineProps<{ open: boolean; defaultStatus?: TaskStatus }>(), { defaultStatus: 'backlog' });
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>();

const store = useAppStore();
const { toast } = useToast();

const CATEGORIES: TaskCategory[] = ['Creative', 'Admin', 'Maintenance', 'Health', 'Learning', 'Social'];
const EISENHOWER: EisenhowerCategory[] = ['do_first', 'schedule', 'delegate', 'eliminate'];

const rawText = ref('');
const parsed = ref<ParsedTaskItem[]>([]);
const status = ref<'idle' | 'parsing' | 'importing' | 'done'>('idle');

const placeholderText = 'Buy groceries\n☐ Call dentist for appointment\n- [ ] Review pull requests\n* Design new landing page\n3. Schedule team standup\nStudy chapter 5 for exam\nMeditate 15 minutes';

const catColor = (c: string) => CATEGORY_COLORS[c] ?? CATEGORY_COLORS.Admin;
const lineCount = computed(() => rawText.value.split(/\n/).filter((l) => l.trim()).length);
const selectedCount = computed(() => parsed.value.filter((t) => t.selected).length);
const duplicateCount = computed(() => parsed.value.filter((t) => t.isDuplicate).length);
const totalMinutes = computed(() => parsed.value.filter((t) => t.selected).reduce((s, t) => s + t.estimatedMinutes, 0));

async function handleParse() {
  const text = rawText.value.trim();
  if (!text) return;
  status.value = 'parsing';
  try {
    const res = await fetch('/api/ai/parse-todos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, defaultStatus: props.defaultStatus }),
    });
    const data = await res.json();
    const items: ParsedTaskItem[] = (Array.isArray(data) ? data : []).map((t: Record<string, unknown>) => ({
      title: String(t.title ?? '').slice(0, 200) || 'Untitled',
      notes: t.notes ? String(t.notes) : null,
      estimatedMinutes: Math.max(1, Math.round(Number(t.estimatedMinutes) || 30)),
      category: (CATEGORIES as readonly string[]).includes(String(t.category)) ? String(t.category) as TaskCategory : 'Admin',
      eisenhowerCategory: (EISENHOWER as readonly string[]).includes(String(t.eisenhowerCategory)) ? String(t.eisenhowerCategory) as EisenhowerCategory : 'schedule',
      priority: Math.max(1, Math.min(5, Math.round(Number(t.priority) || 3))),
      selected: true,
    }));
    const existingTitles = new Set(store.tasks.map((t) => t.title.toLowerCase().trim()));
    for (const item of items) {
      if (existingTitles.has(item.title.toLowerCase().trim())) { item.isDuplicate = true; item.selected = false; }
    }
    parsed.value = items;
    status.value = 'idle';
  } catch (err) {
    console.error('parse failed', err);
    status.value = 'idle';
    toast({ title: 'Parse failed', description: 'Could not parse the text. Check the format and try again.', variant: 'destructive' });
  }
}

function toggleItem(idx: number) { parsed.value[idx].selected = !parsed.value[idx].selected; }
function removeItem(idx: number) { parsed.value.splice(idx, 1); }
function selectAll(v: boolean) { parsed.value.forEach((t) => (t.selected = v)); }

async function handleImport() {
  const selected = parsed.value.filter((t) => t.selected && t.title.trim());
  if (selected.length === 0) return;
  status.value = 'importing';
  let imported = 0;
  for (const item of selected) {
    const t = await store.createTask({
      title: item.title, notes: item.notes, status: props.defaultStatus,
      category: item.category, eisenhowerCategory: item.eisenhowerCategory,
      estimatedMinutes: item.estimatedMinutes, priority: item.priority,
    });
    if (t) imported++;
  }
  status.value = 'done';
  toast({ title: `Imported ${imported} task${imported !== 1 ? 's' : ''}`, description: `${selected.length - imported} skipped` });
  setTimeout(() => {
    rawText.value = ''; parsed.value = []; status.value = 'idle';
    emit('update:open', false);
  }, 1500);
}

function handleClose() {
  if (status.value === 'parsing' || status.value === 'importing') return;
  rawText.value = ''; parsed.value = []; status.value = 'idle';
  emit('update:open', false);
}
</script>
