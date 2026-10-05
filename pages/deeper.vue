<template>
  <div class="mx-auto min-h-dvh max-w-3xl bg-[#EEF5F3] px-4 pb-12 pt-4 text-slate-800 dark:bg-[#1D1A2F] dark:text-slate-100">
    <header class="flex items-center gap-3">
      <NuxtLink to="/" class="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] hover:bg-white/60 dark:hover:bg-white/5">← Home</NuxtLink>
      <h1 class="font-serif text-2xl font-semibold">Go deeper</h1>
    </header>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Optional views. Cadence never needs you to open them.</p>

    <nav class="mt-4 flex gap-2" aria-label="Views">
      <button v-for="t in tabs" :key="t.k" :aria-current="view === t.k ? 'page' : undefined" :class="['min-h-[44px] rounded-2xl px-4 text-[15px] font-medium', view === t.k ? 'bg-teal-100 text-teal-900 dark:bg-[#3A3560] dark:text-[#FFB59F]' : 'bg-white text-slate-600 dark:bg-[#2A2645] dark:text-slate-300']" @click="view = t.k">{{ t.n }}</button>
    </nav>

    <section v-if="view === 'matrix'" class="mt-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">Worked out from your dates and goals: urgent means due within two days; important means part of a goal or tagged as a slog.</p>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div v-for="c in CELLS" :key="c.k" class="rounded-2xl bg-white p-3 dark:bg-[#2A2645]">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">{{ c.n }}</h2>
          <p class="text-xs text-slate-400">{{ c.hint }}</p>
          <ul class="mt-2 space-y-1">
            <li v-for="it in matrix[c.k]" :key="it.id" class="text-[15px]">{{ it.title }}</li>
            <li v-if="!matrix[c.k].length" class="text-sm text-slate-400">Nothing here.</li>
          </ul>
        </div>
      </div>
    </section>

    <section v-else class="mt-4">
      <MapView v-if="view === 'map'" />
      <TripsView v-else />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { eisenhower, type Quadrant } from '~/lib/domain';
import { getTripsOn } from '~/lib/home/prefs';
import { useGraphStore } from '~/stores/graph';

useHead({ title: 'Go deeper · Cadence' });

type View = 'matrix' | 'trips' | 'map';
const graph = useGraphStore();
const view = ref<View>('matrix');
const tripsOn = ref(false);
const tabs = computed<{ k: View; n: string }[]>(() => [
  { k: 'matrix', n: 'Matrix' },
  ...(tripsOn.value ? [{ k: 'trips' as const, n: 'Trips' }, { k: 'map' as const, n: 'Map' }] : []),
]);
const CELLS: { k: Quadrant; n: string; hint: string }[] = [
  { k: 'do', n: 'Do now', hint: 'Urgent and important' },
  { k: 'plan', n: 'Plan', hint: 'Important, not urgent' },
  { k: 'quick', n: 'Quick', hint: 'Urgent, less important' },
  { k: 'later', n: 'Later', hint: 'Neither' },
];
const matrix = computed(() => eisenhower(graph.nodes, graph.links, graph.occurrences, graph.asOf));
onMounted(() => { tripsOn.value = getTripsOn(); graph.load(); });
</script>
