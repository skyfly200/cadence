<template>
  <section class="px-4 pt-4">
    <h1 class="text-xl font-semibold">Today</h1>
    <ul v-if="items.length" class="mt-3 space-y-1.5">
      <li v-for="c in items" :key="c.id" class="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-[#2A2645]">
        <span class="size-5 shrink-0 rounded border-2 border-teal-300 dark:border-[#B9A6FF]" />
        <span class="flex-1 break-words text-[15px]">{{ c.title }}</span>
        <span v-if="when(c)" class="text-xs text-slate-400">{{ when(c) }}</span>
      </li>
    </ul>
    <p v-else class="mt-3 text-[15px] text-slate-500 dark:text-slate-400">Nothing is lined up. Add something, or pick from parked.</p>
    <button v-if="more > 0" class="mt-3 min-h-[44px] text-sm font-medium text-teal-700 dark:text-[#B9A6FF]" @click="expanded = !expanded">{{ expanded ? 'Fewer' : 'More' }}</button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGraphStore } from '~/stores/graph';
import type { Commitment } from '~/lib/domain';
import type { Density } from '~/lib/home/prefs';

const props = defineProps<{ density: Density }>();
const graph = useGraphStore();
const expanded = ref(false);

// 5 to 7 items per lens, with a quiet "more" (never reorders under the finger).
const limit = computed(() => (props.density >= 2 ? 7 : 5));
const all = computed<Commitment[]>(() => [...(graph.pick.now ? [graph.pick.now] : []), ...graph.pick.strip]);
const items = computed(() => (expanded.value ? all.value : all.value.slice(0, limit.value)));
const more = computed(() => all.value.length - limit.value);

const fmt = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const when = (c: Commitment) => (c.fixedTime ? fmt(c.fixedTime) : c.deadline ? `by ${fmt(c.deadline)}` : '');
</script>
