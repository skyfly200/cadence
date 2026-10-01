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
            <h1 class="mt-1 break-words text-center font-serif text-[1.7rem] leading-tight">{{ current.node.title }}</h1>
            <p v-if="density >= 1 && graph.rank.reason" class="mt-2 text-center text-[15px] text-stone-600 dark:text-slate-300">{{ graph.rank.reason }}</p>
            <p v-if="density >= 2 && graph.rank.chain.length" class="mt-1 text-center text-xs text-stone-500 dark:text-slate-400">{{ graph.rank.chain.join(' · ') }}</p>

            <div v-if="graph.rank.offerShrinkParkKeep && !keepDismissed" class="mt-4 rounded-2xl bg-amber-50 p-3 text-center text-sm dark:bg-white/10">
              <p>This has moved a few times. Park it, or keep it?</p>
              <div class="mt-2 flex justify-center gap-2">
                <button class="min-h-[44px] rounded-xl bg-white px-4 font-medium dark:bg-[#1D1A2F]" @click="onPark">Park it</button>
                <button class="min-h-[44px] rounded-xl bg-white px-4 font-medium dark:bg-[#1D1A2F]" @click="keepDismissed = true">Keep it</button>
              </div>
            </div>

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

        <p v-if="density >= 1 && graph.rank.workloadGuard.show" class="mt-3 rounded-2xl bg-white/70 px-4 py-2.5 text-center text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
          {{ graph.rank.workloadGuard.line }}
        </p>
      </li>

      <li v-for="item in graph.rank.strip" :key="item.node.id" class="relative pb-3">
        <span class="absolute -left-[31px] top-1.5 size-3.5 rounded-full bg-sky-400 ring-4 ring-[#EEF5F3] dark:ring-[#1D1A2F]" />
        <p v-if="timeOf(item.node)" class="text-[11px] font-bold text-slate-400">{{ timeOf(item.node) }}</p>
        <p class="break-words text-[15px]">{{ item.node.title }}</p>
      </li>
    </ol>

    <button v-if="density >= 1" class="ml-8 mt-3 min-h-[44px] text-xs font-medium text-teal-700 underline dark:text-[#B9A6FF]" @click="$emit('open-parked')">Parked ideas</button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGraphStore } from '~/stores/graph';
import type { Commitment, Habit } from '~/lib/domain';
import type { Density } from '~/lib/home/prefs';

defineProps<{ density: Density }>();
const emit = defineEmits<{ (e: 'open-parked'): void; (e: 'said', msg: string): void }>();

const graph = useGraphStore();
const showPast = ref(false);
const keepDismissed = ref(false);

const current = computed(() => graph.rank.now);
const started = computed(() => !!graph.currentState?.started);
// A new card gets a fresh prompt.
watch(() => current.value?.node.id, () => { keepDismissed.value = false; });

const fmt = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const timeOf = (n: Commitment | Habit) => {
  if (n.kind !== 'commitment') return '';
  return n.fixedTime ? fmt(n.fixedTime) : n.deadline ? `by ${fmt(n.deadline)}` : '';
};

function onStart() { if (current.value) graph.start(current.value.node.id); }
function onDone() {
  const node = current.value?.node;
  if (!node) return;
  // A habit is logged (and counts toward its period); a Commitment is finished.
  if (node.kind === 'habit') graph.tapHabit(node.id); else graph.complete(node.id);
  emit('said', `Nice. ${graph.kept.length} kept today.`);
}
function onNotNow() { if (current.value) { graph.notNow(current.value.node.id); emit('said', 'Moved to later today.'); } }
function onPark() { if (current.value) { graph.park(current.value.node.id); emit('said', 'Got it, parked.'); } }
</script>
