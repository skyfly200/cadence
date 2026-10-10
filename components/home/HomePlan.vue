<template>
  <section class="px-4 pt-4">
    <div class="flex items-center gap-2">
      <h1 class="min-w-0 flex-1 text-xl font-semibold">Plan</h1>
      <button :class="chip" @click="$emit('open-planning')">Planning session</button>
    </div>
    <p class="text-sm text-slate-500 dark:text-slate-400">Tick to finish. Drag to a day, the heap, or into place within a day. Swipe a row to delete it.</p>

    <form class="mt-3 flex gap-2" @submit.prevent="addEntry">
      <input
        v-model="newText" type="text" maxlength="4000" placeholder="Add something"
        class="min-h-[44px] min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white px-3 text-[16px] outline-none dark:border-white/10 dark:bg-dusk-card"
      />
      <button type="submit" class="min-h-[44px] rounded-2xl bg-ember px-5 font-semibold text-white disabled:opacity-50" :disabled="!newText.trim() || adding">Add</button>
    </form>
    <p v-if="addError" class="mt-1 text-sm text-amber-700 dark:text-amber-300">{{ addError }}</p>

    <template v-if="graph.loaded">
      <!-- The Stack: every day, always there; empty days stay slim -->
      <h2 class="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-lavender">Your stack</h2>
      <div class="lg:grid lg:grid-cols-3 lg:gap-x-3 xl:grid-cols-4">
      <div
        v-for="(day, i) in graph.stack" :key="day.key" :data-drop="day.key"
        :class="['mt-2 rounded-xl border border-transparent px-2 transition-colors data-[over]:border-ember data-[over]:bg-amber-50 dark:data-[over]:bg-white/10', day.items.length ? 'py-2' : dragging ? 'py-4' : 'py-1']"
      >
        <p :class="['text-sm', day.items.length ? 'font-semibold' : 'text-slate-400']">{{ label(day, i) }}</p>
        <ul v-if="day.items.length" class="mt-1 space-y-1.5">
          <li
            v-for="it in day.items" :key="it.id" :data-drop="it.time ? undefined : `before:${it.id}`"
            class="flex items-center gap-2 rounded-lg bg-white px-2 py-1 shadow-sm transition-colors data-[over]:ring-2 data-[over]:ring-ember dark:bg-dusk-card"
          >
            <button :class="tick" :aria-label="`Mark ${it.title} done`" title="Done" @click="done(it.id)"><Check class="size-4" /></button>
            <span v-if="it.time" class="grid size-8 shrink-0 place-items-center text-slate-300" title="Has its own time"><Clock class="size-4" /></span>
            <button v-else :class="grip" aria-label="Drag to another day or position" @pointerdown.prevent="drag($event, it.id, it.title)">⠿</button>
            <span class="min-w-0 flex-1 touch-pan-y" @pointerdown="swipe($event, it.id)">
              <span class="block break-words text-[15px]">{{ it.title }}</span>
              <PlanMeta :meta="metaOf(it.id)" />
            </span>
            <span v-if="it.time" class="shrink-0 text-xs text-slate-400">{{ timeLabel(it.time) }}</span>
            <button :class="icon" :aria-label="`Edit ${it.title}`" title="Edit" @click="$emit('edit', it.id)"><Pencil class="size-4" /></button>
            <button :class="[icon, 'text-red-600 dark:text-red-400']" :aria-label="`Delete ${it.title}`" title="Delete" @click="remove(it.id)"><Trash2 class="size-4" /></button>
          </li>
        </ul>
      </div>
      </div>

      <!-- The Heap: captured things not yet placed -->
      <div class="mt-6 flex items-center justify-between gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-lavender">The heap · {{ graph.heap.length }}</h2>
        <div class="flex gap-2">
          <button v-if="graph.heap.length" :class="chip" :disabled="tidying" @click="tidy"><Sparkles class="mr-1 inline size-4" />{{ tidying ? 'Looking…' : 'Tidy' }}</button>
          <button v-if="graph.heap.length && !sorting" :class="chip" @click="startSort">Sort</button>
        </div>
      </div>

      <p v-if="tidyNote" class="mt-2 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">{{ tidyNote }}</p>
      <ul v-if="tidyFirst.length" class="mt-1 text-sm text-slate-600 dark:text-slate-300">
        <li v-for="t in tidyFirst" :key="t">Start with: {{ t }}</li>
      </ul>
      <ul v-if="tidyLinks.length" class="mt-2 space-y-1.5">
        <li v-for="p in tidyLinks" :key="p.from + p.to" class="rounded-lg border border-slate-200 p-2 text-sm dark:border-white/10">
          <p class="break-words">"{{ titleOf(p.from) }}" needs "{{ titleOf(p.to) }}" first?</p>
          <div class="mt-1.5 flex gap-2">
            <button :class="chip" @click="connect(p)">Connect</button>
            <button :class="chip" @click="tidyLinks = tidyLinks.filter((x) => x !== p)">Not this</button>
          </div>
        </li>
      </ul>

      <div v-if="graph.heap.length" class="mt-2 space-y-2">
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input v-model="view.query" type="search" placeholder="Search the heap" aria-label="Search the heap" :class="[field, 'w-full pl-9']" />
        </div>
        <div class="flex flex-wrap gap-2">
          <select v-model="view.sort" aria-label="Sort the heap" :class="field">
            <option v-for="o in HEAP_SORTS" :key="o.value" :value="o.value">Sort: {{ o.label }}</option>
          </select>
          <select v-model="view.status" aria-label="Filter the heap" :class="field">
            <option value="all">All</option><option value="ready">Ready</option><option value="blocked">Blocked</option><option value="backlog">Backlog</option>
          </select>
          <select v-model="view.tag" aria-label="Filter by tag" :class="field">
            <option value="">Any tag</option>
            <option v-for="t in tagChoices" :key="t" :value="t">{{ t }}</option>
          </select>
          <button :class="chip" :aria-expanded="editingTags" @click="editingTags = !editingTags"><Tag class="mr-1 inline size-4" />Tags</button>
        </div>
        <div v-if="editingTags" class="rounded-xl bg-white p-3 shadow-sm dark:bg-dusk-card">
          <p class="text-xs text-slate-500 dark:text-slate-400">Your tags (a name in an item's title tags it automatically).</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span v-for="t in tags" :key="t" class="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm dark:bg-white/10">
              {{ t }}<button class="grid size-6 place-items-center rounded-full hover:bg-black/10" :aria-label="`Remove tag ${t}`" @click="removeTag(t)"><X class="size-3.5" /></button>
            </span>
          </div>
          <form class="mt-2 flex gap-2" @submit.prevent="newTag">
            <input v-model="tagText" type="text" maxlength="24" placeholder="New tag" aria-label="New tag" :class="[field, 'min-w-0 flex-1']" />
            <button type="submit" :class="chip" :disabled="!tagText.trim()">Add</button>
          </form>
        </div>
      </div>

      <!-- Sorting: one at a time, one tap each -->
      <div v-if="sorting && current" class="mt-2 rounded-[1.5rem] bg-white p-5 shadow-sm dark:bg-dusk-card">
        <p class="text-xs text-slate-400">{{ queue.length }} left</p>
        <p class="mt-1 break-words font-serif text-xl">{{ current.title }}</p>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">When?</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button v-for="(d, j) in graph.stack" :key="d.key" :class="chip" @click="sortTo(d.key)">{{ label(d, j, true) }}</button>
        </div>
        <div class="mt-3 flex gap-2">
          <button class="min-h-[44px] flex-1 rounded-2xl bg-stone-100 text-sm font-medium dark:bg-white/10" @click="skip">Skip</button>
          <button class="min-h-[44px] flex-1 rounded-2xl bg-stone-100 text-sm font-medium dark:bg-white/10" @click="sorting = false">Stop sorting</button>
        </div>
      </div>
      <p v-else-if="sorting" class="mt-2 text-[15px] text-slate-500 dark:text-slate-400">All sorted.</p>

      <div data-drop="heap" :class="['mt-2 min-h-[56px] rounded-xl border border-dashed border-transparent p-1 transition-colors data-[over]:border-ember data-[over]:bg-amber-50 dark:data-[over]:bg-white/10', dragging && 'border-slate-300 dark:border-white/20']">
        <ul v-if="shownHeap.length" class="space-y-1.5">
          <li v-for="h in shownHeap" :key="h.id" :class="['flex items-center gap-2 rounded-lg bg-white px-2 py-1 shadow-sm dark:bg-dusk-card', h.backlog && 'opacity-60']">
            <button :class="tick" :aria-label="`Mark ${h.title} done`" title="Done" @click="done(h.id)"><Check class="size-4" /></button>
            <button :class="grip" aria-label="Drag onto a day" @pointerdown.prevent="drag($event, h.id, h.title)">⠿</button>
            <span class="min-w-0 flex-1 touch-pan-y" @pointerdown="swipe($event, h.id)">
              <span class="block break-words text-[15px]">{{ h.title }}</span>
              <PlanMeta :meta="metaOf(h.id)" :backlog="h.backlog" />
            </span>
            <button :class="icon" :aria-label="h.backlog ? `Bring ${h.title} back up` : `Push ${h.title} to the backlog`" :title="h.backlog ? 'Bring back up' : 'Push down (backlog)'" @click="toggleBacklog(h.id, !h.backlog)">
              <ArrowUpFromLine v-if="h.backlog" class="size-4" /><ArrowDownToLine v-else class="size-4" />
            </button>
            <button :class="icon" :aria-label="`Edit ${h.title}`" title="Edit" @click="$emit('edit', h.id)"><Pencil class="size-4" /></button>
            <button :class="[icon, 'text-red-600 dark:text-red-400']" :aria-label="`Delete ${h.title}`" title="Delete" @click="remove(h.id)"><Trash2 class="size-4" /></button>
          </li>
        </ul>
        <p v-else-if="graph.heap.length" class="px-2 py-3 text-[15px] text-slate-500 dark:text-slate-400">Nothing matches.</p>
        <p v-else class="px-2 py-3 text-[15px] text-slate-500 dark:text-slate-400">Heap is empty.</p>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ArrowDownToLine, ArrowUpFromLine, Check, Clock, Pencil, Search, Sparkles, Tag, Trash2, X } from 'lucide-vue-next';
import { aiFetch } from '~/lib/ai-client';
import { useGraphStore } from '~/stores/graph';
import { useAppStore } from '~/stores/app';
import { useRewards } from '~/composables/useRewards';
import { startDrag } from '~/lib/home/drag';
import { startSwipe } from '~/lib/home/swipe';
import { addTag, DEFAULT_HEAP_VIEW, HEAP_SORTS, tagOptions, viewHeap } from '~/lib/home/heap';
import { wouldCreateCycle } from '~/lib/home/edit';
import { getAiOn, getTags, setTags } from '~/lib/home/prefs';
import type { LinkProposal } from '~/lib/home/proposals';
import type { StackDay } from '~/lib/home/derive';

const emit = defineEmits<{ (e: 'said', msg: string): void; (e: 'edit', nodeId: string): void; (e: 'open-planning'): void }>();
const graph = useGraphStore();
const app = useAppStore();
const { reward } = useRewards();

const chip = 'min-h-[44px] rounded-xl bg-stone-100 px-3 text-sm font-medium disabled:opacity-50 dark:bg-white/10';
const field = 'min-h-[44px] rounded-xl border border-stone-200 bg-white px-3 text-[16px] outline-none dark:border-white/10 dark:bg-dusk-card';
const grip = 'grid size-9 shrink-0 touch-none cursor-grab place-items-center text-xl text-slate-400 active:cursor-grabbing';
const tick = 'grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-white/10';
const icon = 'grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-white/10';
const dragging = ref(false);
const sorting = ref(false);
const queue = ref<string[]>([]);

// ── the heap: search, sort, filter, tags ──
const view = reactive({ ...DEFAULT_HEAP_VIEW });
const tags = ref(getTags());
const tagText = ref('');
const editingTags = ref(false);
const tagChoices = computed(() => tagOptions(graph.heap, tags.value));
const shownHeap = computed(() => viewHeap(graph.heap, view));
function newTag() { tags.value = addTag(tags.value, tagText.value); setTags(tags.value); tagText.value = ''; }
function removeTag(t: string) { tags.value = tags.value.filter((x) => x !== t); setTags(tags.value); if (view.tag === t) view.tag = ''; }

const nodeById = computed(() => new Map(graph.nodes.map((n) => [n.id, n] as const)));
const titleOf = (id: string) => nodeById.value.get(id)?.title ?? '';
function metaOf(id: string) {
  const n = nodeById.value.get(id);
  const own = n && n.kind === 'commitment' ? n.durationMinutes : null;
  return { category: n?.category ?? null, minutes: own ?? n?.estimateMinutes ?? null, blockedBy: graph.blockers.get(id) ?? [] };
}

// ── AI help with the heap ──
const tidying = ref(false);
const tidyNote = ref('');
const tidyFirst = ref<string[]>([]);
const tidyLinks = ref<LinkProposal[]>([]);
async function tidy() {
  if (tidying.value) return;
  tidyNote.value = '';
  tidyFirst.value = [];
  tidyLinks.value = [];
  const byName = graph.autoTagHeap();
  const ids = graph.heap.filter((h) => !nodeById.value.get(h.id)?.private).slice(0, 30).map((h) => h.id);
  const nameNote = byName ? `Tagged ${byName} by name. ` : '';
  if (!getAiOn() || !app.signedIn || ids.length === 0) { tidyNote.value = `${nameNote}${getAiOn() ? 'Sign in to let the AI estimate and suggest.' : 'AI is switched off, so only names were matched.'}`.trim(); return; }
  tidying.value = true;
  const r = await aiFetch<{ ok: true; items: { id: string; category: string | null; minutes: number | null; requires: string | null }[]; first: string[] }>('/api/ai/heap', { ids, tags: tags.value }, { accessToken: app.session?.access_token });
  tidying.value = false;
  if (r.status === 'off') { tidyNote.value = `${nameNote}AI is switched off.`; return; }
  if (r.status !== 'ok') { tidyNote.value = `${nameNote}The AI is not available right now.`; return; }
  const { tagged, estimated } = graph.applyHeapAi(r.data.items.map((i) => ({ id: i.id, category: i.category, minutes: i.minutes })));
  tidyFirst.value = r.data.first.map(titleOf).filter(Boolean);
  tidyLinks.value = r.data.items
    .filter((i) => i.requires && !wouldCreateCycle(graph.links, i.id, i.requires) && !graph.links.some((l) => l.type === 'requires' && l.fromId === i.id && l.toId === i.requires))
    .map((i) => ({ type: 'requires', from: i.id, to: i.requires!, confidence: 0.6, evidence: 'Suggested while tidying the heap' }));
  const found = [tagged + byName ? `tagged ${tagged + byName}` : '', estimated ? `estimated ${estimated}` : ''].filter(Boolean).join(' and ');
  tidyNote.value = r.data.items.length === 0 ? `${nameNote}Nothing to suggest yet (new items may still be syncing).`.trim() : found ? `Done: ${found}.` : 'Nothing new to add.';
}
function connect(p: LinkProposal) {
  if (graph.acceptConnection(p)) emit('said', 'Connected.');
  tidyLinks.value = tidyLinks.value.filter((x) => x !== p);
}

const newText = ref('');
const adding = ref(false);
const addError = ref('');
async function addEntry() {
  if (adding.value || !newText.value.trim()) return;
  adding.value = true;
  addError.value = '';
  const r = await graph.capture(newText.value);
  adding.value = false;
  if (!r.ok) { addError.value = r.message; return; }
  newText.value = '';
  emit('said', r.reply);
}

function label(day: StackDay, i: number, short = false) {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return day.date.toLocaleDateString([], short ? { weekday: 'short' } : { weekday: 'long', month: 'short', day: 'numeric' });
}
const timeLabel = (iso: string) => new Date(iso).toLocaleString([], { hour: 'numeric', minute: '2-digit', hour12: graph.timeFormat === '12' });

const current = computed(() => graph.heap.find((h) => h.id === queue.value[0]) ?? null);

function drag(e: PointerEvent, id: string, title: string) {
  dragging.value = true;
  startDrag(e, {
    label: title,
    onDrop: (zone) => {
      if (zone === 'heap') { if (!graph.heap.some((h) => h.id === id)) { graph.park(id); emit('said', 'Back in the heap.'); } }
      else if (zone.startsWith('before:')) {
        const beforeId = zone.slice('before:'.length);
        const day = graph.stack.find((d) => d.items.some((i) => i.id === beforeId));
        if (day) { graph.plan(id, day.key, beforeId); emit('said', 'Moved.'); }
      } else { graph.plan(id, zone); emit('said', 'Added to your stack.'); }
    },
    onEnd: () => { dragging.value = false; },
  });
}

function done(id: string) {
  const n = nodeById.value.get(id);
  graph.finish(id);
  emit('said', reward('done', { slog: n?.kind === 'commitment' && n.slog }));
}
function toggleBacklog(id: string, on: boolean) { graph.setBacklog(id, on); emit('said', on ? 'Pushed down the heap.' : 'Back up.'); }
function remove(id: string) { graph.removeNode(id); emit('said', 'Deleted.'); }
function swipe(e: PointerEvent, id: string) {
  const row = (e.currentTarget as HTMLElement).closest('li');
  if (row) startSwipe(e, row, () => remove(id));
}

function startSort() { queue.value = graph.heap.filter((h) => !h.backlog).map((h) => h.id); sorting.value = true; }
function sortTo(key: string) {
  const id = queue.value[0];
  if (id) graph.plan(id, key);
  queue.value = queue.value.slice(1);
}
function skip() { queue.value = queue.value.slice(1); }
</script>
