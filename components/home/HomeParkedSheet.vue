<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-end bg-stone-900/30" @click.self="$emit('close')">
    <div class="mx-auto flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-[2rem] bg-white p-5 pb-8 dark:bg-[#2A2645]" role="dialog" aria-label="Parked">
      <p class="font-serif text-xl">Parked</p>
      <ul v-if="graph.parked.length" class="mt-2 flex-1 divide-y overflow-y-auto text-[15px] dark:divide-white/10">
        <li v-for="p in graph.parked" :key="p.id" class="flex items-center justify-between gap-3 py-2.5">
          <span class="min-w-0 break-words">{{ p.title }}</span>
          <button class="min-h-[44px] shrink-0 px-2 text-xs font-medium text-teal-700 dark:text-[#B9A6FF]" @click="bring(p.id)">
            {{ p.kind === 'idea' ? 'Do this today' : 'Bring back' }}
          </button>
        </li>
      </ul>
      <p v-else class="mt-2 text-[15px] text-slate-500 dark:text-slate-400">Nothing parked. Anything you add lands here first.</p>
      <button class="mt-3 min-h-[44px] w-full rounded-2xl bg-stone-100 text-sm dark:bg-white/10" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGraphStore } from '~/stores/graph';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'said', msg: string): void }>();
const graph = useGraphStore();

function bring(id: string) {
  graph.bringBack(id);
  emit('said', 'Brought back.');
}
</script>
