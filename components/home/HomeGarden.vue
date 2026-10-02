<template>
  <div v-if="open" class="fixed inset-0 z-[35] overflow-y-auto bg-[#EEF5F3] text-slate-800 dark:bg-[#1D1A2F] dark:text-slate-100" role="dialog" aria-label="Garden">
    <div class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-4 md:max-w-xl">
      <header class="flex items-center gap-3">
        <h1 class="min-w-0 flex-1 font-serif text-xl font-semibold">{{ tab === 'season' ? 'Garden' : 'Pressed book' }}</h1>
        <button class="min-h-[44px] rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/5" @click="$emit('close')">Close</button>
      </header>

      <div class="mt-2 grid grid-cols-2 gap-2" role="tablist">
        <button role="tab" :aria-selected="tab === 'season'" :class="tabClass('season')" @click="tab = 'season'">This season</button>
        <button role="tab" :aria-selected="tab === 'book'" :class="tabClass('book')" @click="tab = 'book'">Pressed book</button>
      </div>

      <!-- this season -->
      <section v-if="tab === 'season'" class="mt-4">
        <div class="overflow-hidden rounded-3xl bg-white p-3 shadow-sm dark:bg-[#2A2645]">
          <GardenScene :pieces="garden.pieces" :resting="garden.resting" :motion="motion" label="Your garden this season" />
          <p class="mt-2 px-1 font-serif text-lg">{{ garden.season.name }} {{ garden.season.year }}</p>
          <p class="px-1 text-sm text-slate-600 dark:text-slate-300">
            <template v-if="garden.resting">A new season. The garden starts light, and last season is in the Pressed book.</template>
            <template v-else-if="garden.empty">A light garden. It grows as you keep things.</template>
            <template v-else>{{ garden.kept }} {{ garden.kept === 1 ? 'thing' : 'things' }} kept this season.</template>
          </p>
        </div>

        <ul v-if="named.length" class="mt-4 space-y-2">
          <li v-for="p in named" :key="p.id" class="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-[#2A2645]">
            <svg viewBox="-20 -46 40 50" class="size-10 shrink-0" aria-hidden="true"><GardenPiece :kind="p.kind" :stage="p.stage" :blooms="p.blooms" :id="p.id" /></svg>
            <span class="min-w-0 flex-1"><span class="block break-words text-[15px]">{{ p.title }}</span><span class="text-xs text-slate-500 dark:text-slate-400">{{ WORD[p.kind] }}</span></span>
          </li>
        </ul>
        <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">Everything you keep grows here. Nothing wilts, and undoing a log undoes its growth.</p>
      </section>

      <!-- pressed book -->
      <section v-else class="mt-4 space-y-4">
        <p v-if="!book.length" class="rounded-3xl bg-white p-5 text-[15px] text-slate-600 shadow-sm dark:bg-[#2A2645] dark:text-slate-300">
          Nothing pressed yet. When a season turns, the plants that grew most are pressed here, so nothing you did is lost.
        </p>
        <article v-for="s in book" :key="s.key" class="rounded-3xl bg-amber-50 p-4 shadow-sm dark:bg-[#332E52]">
          <h2 class="font-serif text-lg">{{ s.name }} {{ s.year }}</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ s.kept }} {{ s.kept === 1 ? 'thing' : 'things' }} kept</p>
          <ul class="mt-3 grid grid-cols-3 gap-2">
            <li v-for="p in s.plants" :key="p.nodeId" class="flex flex-col items-center rounded-2xl border border-amber-200/70 bg-white/60 p-2 text-center dark:border-white/10 dark:bg-white/5">
              <svg viewBox="-20 -46 40 50" class="size-14" aria-hidden="true"><GardenPiece :kind="p.kind" :stage="p.stage" :id="p.nodeId" /></svg>
              <span class="mt-1 break-words text-xs leading-tight">{{ p.title }}</span>
            </li>
          </ul>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PieceKind } from '~/lib/domain';
import { getGardenMotion } from '~/lib/home/garden-state';
import { useGraphStore } from '~/stores/graph';

const props = defineProps<{ open: boolean }>();
defineEmits<{ (e: 'close'): void }>();
const graph = useGraphStore();

const tab = ref<'season' | 'book'>('season');
const motion = ref(false);
const book = ref<ReturnType<typeof graph.pressed>>([]);

// Read when opened: the motion choice and the book live on this device, outside Vue's reach.
watch(() => props.open, (o) => {
  if (!o) return;
  tab.value = 'season';
  motion.value = getGardenMotion();
  book.value = graph.pressed();
}, { immediate: true });

const garden = computed(() => graph.garden);
const named = computed(() => garden.value.pieces.filter((p) => p.title));

const WORD: Record<PieceKind, string> = {
  sprout: 'A daily habit, a sprout', fern: 'A weekly habit, a fern', lavender: 'A monthly habit, lavender', tulip: 'A quarterly habit, a tulip',
  sunflower: 'A habit every four months, a sunflower', foxglove: 'A habit every six months, a foxglove', iris: 'A yearly habit, an iris',
  oak: 'A goal, an oak', birch: 'A goal, a birch', pine: 'A goal, a pine',
  mushroom: '', stone: '', clover: '', lantern: '',
};
const tabClass = (t: 'season' | 'book') => [
  'min-h-[44px] rounded-xl text-sm font-medium',
  tab.value === t ? 'bg-teal-100 text-teal-900 dark:bg-[#3A3560] dark:text-[#FFB59F]' : 'bg-white text-slate-600 dark:bg-[#2A2645] dark:text-slate-300',
];
</script>
