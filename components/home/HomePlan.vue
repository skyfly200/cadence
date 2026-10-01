<template>
  <section class="px-4 pt-4">
    <h1 class="text-xl font-semibold">Plan</h1>

    <template v-if="graph.loaded">
      <!-- The Stack: planned entries, day by day -->
      <h2 class="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">Your stack</h2>
      <div v-for="day in shownDays" :key="day.key" class="mt-3">
        <p class="text-sm font-semibold">{{ label(day) }}</p>
        <ul v-if="day.items.length" class="mt-1 space-y-1.5">
          <li v-for="it in day.items" :key="it.id" class="rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-[#2A2645]">
            <button class="flex min-h-[44px] w-full items-center gap-3 text-left" @click="toggle(it.id)">
              <span class="flex-1 break-words text-[15px]">{{ it.title }}</span>
              <span v-if="it.time" class="text-xs text-slate-400">{{ timeLabel(it.time) }}</span>
            </button>
            <div v-if="openId === it.id" class="mt-1 flex flex-wrap gap-1.5 pb-1">
              <button v-for="d in graph.stack" :key="d.key" :class="chip" @click="place(it.id, d.key)">{{ label(d, true) }}</button>
              <button :class="chip" @click="toHeap(it.id)">Back to the heap</button>
            </div>
          </li>
        </ul>
        <p v-else class="mt-0.5 text-[13px] text-slate-400">Nothing yet.</p>
      </div>
      <button v-if="hiddenDays > 0 || allDays" class="mt-2 min-h-[44px] text-sm font-medium text-teal-700 dark:text-[#B9A6FF]" @click="allDays = !allDays">
        {{ allDays ? 'Fewer days' : 'Show all 7 days' }}
      </button>

      <!-- The Heap: captured things not yet placed -->
      <div class="mt-6 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">The heap · {{ graph.heap.length }}</h2>
        <button v-if="graph.heap.length && !sorting" class="min-h-[44px] px-2 text-sm font-medium text-teal-700 dark:text-[#B9A6FF]" @click="startSort">Sort the heap</button>
      </div>

      <!-- Sorting: one at a time -->
      <div v-if="sorting && current" class="mt-2 rounded-[1.5rem] bg-white p-5 shadow-sm dark:bg-[#2A2645]">
        <p class="text-xs text-slate-400">{{ queue.length }} left</p>
        <p class="mt-1 break-words font-serif text-xl">{{ current.title }}</p>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">When could this happen?</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button v-for="d in graph.stack" :key="d.key" :class="chip" @click="sortTo(d.key)">{{ label(d, true) }}</button>
        </div>
        <div class="mt-3 flex gap-2">
          <button class="min-h-[44px] flex-1 rounded-2xl bg-stone-100 text-sm font-medium dark:bg-white/10" @click="skip">Leave in the heap</button>
          <button class="min-h-[44px] flex-1 rounded-2xl bg-stone-100 text-sm font-medium dark:bg-white/10" @click="sorting = false">Stop sorting</button>
        </div>
      </div>
      <p v-else-if="sorting" class="mt-2 text-[15px] text-slate-500 dark:text-slate-400">That is everything sorted for now.</p>

      <ul v-if="graph.heap.length && !sorting" class="mt-2 space-y-1.5">
        <li v-for="h in graph.heap" :key="h.id" class="rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-[#2A2645]">
          <button class="flex min-h-[44px] w-full items-center text-left text-[15px]" @click="toggle(h.id)"><span class="break-words">{{ h.title }}</span></button>
          <div v-if="openId === h.id" class="mt-1 flex flex-wrap gap-1.5 pb-1">
            <button v-for="d in graph.stack" :key="d.key" :class="chip" @click="place(h.id, d.key)">{{ label(d, true) }}</button>
          </div>
        </li>
      </ul>
      <p v-else-if="!graph.heap.length && !sorting" class="mt-2 text-[15px] text-slate-500 dark:text-slate-400">The heap is empty. Anything you add with + lands here first.</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGraphStore } from '~/stores/graph';
import type { StackDay } from '~/lib/home/derive';

const emit = defineEmits<{ (e: 'said', msg: string): void }>();
const graph = useGraphStore();

const chip = 'min-h-[44px] rounded-xl bg-stone-100 px-3 text-sm font-medium dark:bg-white/10';
const openId = ref<string | null>(null);
const allDays = ref(false);
const sorting = ref(false);
const queue = ref<string[]>([]);

// Quiet by default: today and days with something on them. "Show all" reveals the rest.
const busyDays = computed(() => graph.stack.filter((d, i) => i === 0 || d.items.length));
const shownDays = computed(() => (allDays.value ? graph.stack : busyDays.value));
const hiddenDays = computed(() => graph.stack.length - busyDays.value.length);

function label(day: StackDay, short = false) {
  const i = graph.stack.indexOf(day);
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return day.date.toLocaleDateString([], short ? { weekday: 'short' } : { weekday: 'long', month: 'short', day: 'numeric' });
}
const timeLabel = (iso: string) => new Date(iso).toLocaleString([], { hour: 'numeric', minute: '2-digit' });

const current = computed(() => graph.heap.find((h) => h.id === queue.value[0]) ?? null);

const toggle = (id: string) => { openId.value = openId.value === id ? null : id; };
function place(id: string, key: string) {
  graph.plan(id, key);
  openId.value = null;
  emit('said', 'Added to your stack.');
}
function toHeap(id: string) {
  graph.park(id);
  openId.value = null;
  emit('said', 'Back in the heap.');
}

function startSort() { queue.value = graph.heap.map((h) => h.id); sorting.value = true; openId.value = null; }
function sortTo(key: string) {
  const id = queue.value[0];
  if (id) graph.plan(id, key);
  queue.value = queue.value.slice(1);
}
function skip() { queue.value = queue.value.slice(1); }
</script>
