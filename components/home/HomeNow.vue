<template>
  <section class="px-4 pt-4">
    <button v-if="density >= 1 && graph.kept.length" class="mb-1 ml-8 text-xs font-medium text-slate-500 dark:text-slate-400" @click="showPast = !showPast">
      {{ showPast ? 'Hide' : `Kept earlier ✓ ${graph.kept.length}` }}
    </button>

    <ol class="relative ml-3 border-l-2 border-dashed border-teal-900/15 pl-6 dark:border-white/15">
      <template v-if="showPast">
        <li v-for="k in graph.kept" :key="k.id" class="relative pb-3 text-sm text-slate-400">
          <span class="absolute -left-[31px] top-0.5 grid size-4 place-items-center rounded-full bg-teal-200 text-[9px] text-teal-900">✓</span><s>{{ k.title }}</s>
        </li>
      </template>

      <li class="relative pb-5">
        <span class="absolute -left-[38px] top-9 size-6 rounded-full bg-[#E07A45] ring-4 ring-[#EEF5F3] dark:ring-[#1D1A2F]" />
        <!-- The Now card -->
        <div class="relative mt-8 rounded-[2rem] bg-white p-5 pt-9 shadow-[0_10px_30px_-12px_rgba(180,110,40,0.35)] dark:bg-[#2A2645] dark:shadow-none">
          <svg viewBox="0 0 80 80" class="absolute -top-8 left-1/2 size-16 -translate-x-1/2" aria-hidden="true">
            <circle cx="40" cy="40" r="30" fill="#FBBF24" /><circle cx="40" cy="40" r="22" fill="#FCD34D" />
            <circle cx="32" cy="36" r="2.5" fill="#78350F" /><circle cx="48" cy="36" r="2.5" fill="#78350F" />
            <path d="M31 46 Q40 54 49 46" stroke="#78350F" stroke-width="2.5" fill="none" stroke-linecap="round" />
          </svg>

          <template v-if="current">
            <p class="text-center text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-[#FFB59F]">{{ started ? 'You are on it' : 'Right now' }}</p>
            <h1 class="mt-1 break-words text-center font-serif text-[1.7rem] leading-tight">{{ current.title }}</h1>
            <p v-if="density >= 1 && whenText" class="mt-2 text-center text-[15px] text-stone-600 dark:text-slate-300">{{ whenText }}</p>
            <div v-if="!started" class="mt-5 grid grid-cols-3 gap-2">
              <button class="col-span-3 min-h-[44px] rounded-2xl bg-[#E07A45] py-3.5 text-base font-semibold text-white shadow-sm active:scale-[.99]" @click="onStart">Start</button>
              <button class="col-span-2 min-h-[44px] rounded-2xl bg-stone-100 py-3 text-sm font-medium dark:bg-white/10" @click="onNotNow">Not now</button>
              <button class="min-h-[44px] rounded-2xl bg-stone-100 py-3 text-sm font-medium dark:bg-white/10" @click="onPark">Park</button>
            </div>
            <button v-else class="mt-5 min-h-[44px] w-full rounded-2xl bg-emerald-500 py-3.5 text-base font-semibold text-white" @click="onDone">Done ✓</button>
          </template>

          <template v-else>
            <h1 class="mt-2 text-center font-serif text-2xl">{{ graph.parked.length ? 'Nothing is queued for now' : 'You’re clear for now' }} 🌤</h1>
            <p class="mt-2 text-center text-stone-600 dark:text-slate-300">
              {{ graph.parked.length ? 'Open the parked list and pick something to do today.' : 'Nothing needs you. Capture anything that pops up with the + button.' }}
            </p>
            <button v-if="graph.parked.length" class="mx-auto mt-4 block min-h-[44px] rounded-2xl bg-[#E07A45] px-5 text-sm font-semibold text-white" @click="$emit('open-parked')">Open parked</button>
          </template>
        </div>
      </li>

      <li v-for="c in ahead" :key="c.id" class="relative pb-3">
        <span class="absolute -left-[31px] top-1.5 size-3.5 rounded-full bg-sky-400 ring-4 ring-[#EEF5F3] dark:ring-[#1D1A2F]" />
        <p v-if="timeOf(c)" class="text-[11px] font-bold text-slate-400">{{ timeOf(c) }}</p>
        <p class="break-words text-[15px]">{{ c.title }}</p>
      </li>
    </ol>

    <button v-if="density >= 1" class="ml-8 mt-3 min-h-[44px] text-xs font-medium text-teal-700 underline dark:text-[#B9A6FF]" @click="$emit('open-parked')">Parked ideas</button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGraphStore } from '~/stores/graph';
import type { Commitment } from '~/lib/domain';
import type { Density } from '~/lib/home/prefs';

const props = defineProps<{ density: Density }>();
const emit = defineEmits<{ (e: 'open-parked'): void; (e: 'said', msg: string): void }>();

const graph = useGraphStore();
const showPast = ref(false);

const current = computed(() => graph.pick.now);
const started = computed(() => !!graph.currentState?.started);
const ahead = computed(() => graph.pick.strip.slice(0, props.density === 0 ? 0 : props.density === 1 ? 3 : 5));

const fmt = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const timeOf = (c: Commitment) => (c.fixedTime ? fmt(c.fixedTime) : c.deadline ? `by ${fmt(c.deadline)}` : '');
const whenText = computed(() => (current.value ? timeOf(current.value) : ''));

function onStart() { if (current.value) graph.start(current.value.id); }
function onDone() { if (current.value) { graph.complete(current.value.id); emit('said', `Nice. ${graph.kept.length} kept today.`); } }
function onNotNow() { if (current.value) { graph.notNow(current.value.id); emit('said', 'Moved to later today.'); } }
function onPark() { if (current.value) { graph.park(current.value.id); emit('said', 'Got it, parked.'); } }
</script>
