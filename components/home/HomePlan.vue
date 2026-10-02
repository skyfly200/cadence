<template>
  <section class="px-4 pt-4">
    <h1 class="text-xl font-semibold">Plan</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400">Drag to a day or the heap.</p>

    <form class="mt-3 flex gap-2" @submit.prevent="addEntry">
      <input
        v-model="newText" type="text" maxlength="4000" placeholder="Add something"
        class="min-h-[44px] min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white px-3 text-[16px] outline-none dark:border-white/10 dark:bg-[#2A2645]"
      />
      <button type="submit" class="min-h-[44px] rounded-2xl bg-[#E07A45] px-5 font-semibold text-white disabled:opacity-50" :disabled="!newText.trim() || adding">Add</button>
    </form>
    <p v-if="addError" class="mt-1 text-sm text-amber-700 dark:text-amber-300">{{ addError }}</p>

    <template v-if="graph.loaded">
      <!-- The Stack: every day, always there; empty days stay slim -->
      <h2 class="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">Your stack</h2>
      <div
        v-for="(day, i) in graph.stack" :key="day.key" :data-drop="day.key"
        :class="['mt-2 rounded-xl border border-transparent px-2 transition-colors data-[over]:border-[#E07A45] data-[over]:bg-amber-50 dark:data-[over]:bg-white/10', day.items.length ? 'py-2' : dragging ? 'py-4' : 'py-1']"
      >
        <p :class="['text-sm', day.items.length ? 'font-semibold' : 'text-slate-400']">{{ label(day, i) }}</p>
        <ul v-if="day.items.length" class="mt-1 space-y-1.5">
          <li v-for="it in day.items" :key="it.id" class="flex items-center gap-2 rounded-lg bg-white px-2 py-1 shadow-sm dark:bg-[#2A2645]">
            <span v-if="it.time" class="grid size-11 shrink-0 place-items-center text-slate-300" title="Has its own time">⏱</span>
            <button v-else :class="grip" aria-label="Drag to another day" @pointerdown.prevent="drag($event, it.id, it.title)">⠿</button>
            <span class="min-w-0 flex-1 break-words text-[15px]">{{ it.title }}</span>
            <span v-if="it.time" class="shrink-0 pr-1 text-xs text-slate-400">{{ timeLabel(it.time) }}</span>
          </li>
        </ul>
      </div>

      <!-- The Heap: captured things not yet placed -->
      <div class="mt-6 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">The heap · {{ graph.heap.length }}</h2>
        <button v-if="graph.heap.length && !sorting" class="min-h-[44px] rounded-xl bg-stone-100 px-3 text-sm font-medium dark:bg-white/10" @click="startSort">Sort</button>
      </div>

      <!-- Sorting: one at a time, one tap each -->
      <div v-if="sorting && current" class="mt-2 rounded-[1.5rem] bg-white p-5 shadow-sm dark:bg-[#2A2645]">
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

      <div data-drop="heap" :class="['mt-2 min-h-[56px] rounded-xl border border-dashed border-transparent p-1 transition-colors data-[over]:border-[#E07A45] data-[over]:bg-amber-50 dark:data-[over]:bg-white/10', dragging && 'border-slate-300 dark:border-white/20']">
        <ul v-if="graph.heap.length" class="space-y-1.5">
          <li v-for="h in graph.heap" :key="h.id" class="flex items-center gap-2 rounded-lg bg-white px-2 py-1 shadow-sm dark:bg-[#2A2645]">
            <button :class="grip" aria-label="Drag onto a day" @pointerdown.prevent="drag($event, h.id, h.title)">⠿</button>
            <span class="min-w-0 flex-1 break-words text-[15px]">{{ h.title }}</span>
          </li>
        </ul>
        <p v-else class="px-2 py-3 text-[15px] text-slate-500 dark:text-slate-400">Heap is empty.</p>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGraphStore } from '~/stores/graph';
import { startDrag } from '~/lib/home/drag';
import type { StackDay } from '~/lib/home/derive';

const emit = defineEmits<{ (e: 'said', msg: string): void }>();
const graph = useGraphStore();

const chip = 'min-h-[44px] rounded-xl bg-stone-100 px-3 text-sm font-medium dark:bg-white/10';
const grip = 'grid size-11 shrink-0 touch-none cursor-grab place-items-center text-xl text-slate-400 active:cursor-grabbing';
const dragging = ref(false);
const sorting = ref(false);
const queue = ref<string[]>([]);

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
      else { graph.plan(id, zone); emit('said', 'Added to your stack.'); }
    },
    onEnd: () => { dragging.value = false; },
  });
}

function startSort() { queue.value = graph.heap.map((h) => h.id); sorting.value = true; }
function sortTo(key: string) {
  const id = queue.value[0];
  if (id) graph.plan(id, key);
  queue.value = queue.value.slice(1);
}
function skip() { queue.value = queue.value.slice(1); }
</script>
