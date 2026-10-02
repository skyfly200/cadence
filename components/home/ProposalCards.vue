<template>
  <ul class="space-y-2">
    <li v-for="p in proposals" :key="p.ref" class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
      <p class="min-w-0 flex-1 break-words text-[15px]">{{ p.title }} <span class="text-xs text-slate-500 dark:text-slate-400">({{ KIND_WORD[p.kind] }})</span></p>
      <span v-if="kept.has(p.ref)" class="text-sm text-slate-500 dark:text-slate-400">Kept</span>
      <button v-else type="button" class="min-h-[44px] rounded-xl bg-stone-100 px-4 text-sm font-medium dark:bg-white/10" @click="$emit('keep', p, choices[p.ref] ?? defaultChoice(p))">Keep</button>
      <!-- a habit: how often (editable; without one it is kept as an idea) -->
      <div v-if="p.kind === 'habit' && !kept.has(p.ref)" class="flex basis-full flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <span>How often?</span>
        <select :value="cyclePeriod(p)" class="min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-2 dark:border-white/10 dark:bg-[#1D1A2F]" aria-label="Period" @change="setCycle(p, ($event.target as HTMLSelectElement).value, cycleTarget(p))">
          <option value="">Not sure</option>
          <option v-for="w in PERIOD_WORDS" :key="w.value" :value="w.value">a {{ w.label }}</option>
        </select>
        <template v-if="cyclePeriod(p)">
          <select :value="cycleTarget(p)" class="min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-2 dark:border-white/10 dark:bg-[#1D1A2F]" aria-label="Times" @change="setCycle(p, cyclePeriod(p), Number(($event.target as HTMLSelectElement).value))">
            <option v-for="n in 7" :key="n" :value="n">{{ n }}×</option>
          </select>
        </template>
        <span v-else class="basis-full text-xs">Say how often to keep it as a habit; otherwise it is kept as an idea.</span>
      </div>
      <!-- a place: the address it was found at, with the other matches to choose from -->
      <div v-if="p.thingType === 'place' && !kept.has(p.ref)" class="basis-full text-sm text-slate-600 dark:text-slate-300">
        <template v-if="p.matches?.length">
          <select v-if="p.matches.length > 1" :value="matchIndex(p)" class="min-h-[44px] w-full rounded-xl border border-stone-200 bg-stone-50 px-2 dark:border-white/10 dark:bg-[#1D1A2F]" aria-label="Which place" @change="pickMatch(p, Number(($event.target as HTMLSelectElement).value))">
            <option v-for="(m, i) in p.matches" :key="i" :value="i">{{ m.address }}</option>
          </select>
          <p v-else>{{ p.matches[0]!.address }}</p>
          <a v-if="mapsLink(p)" :href="mapsLink(p)!" target="_blank" rel="noopener" class="mt-1 inline-block min-h-[44px] leading-[44px] underline">Open in Maps</a>
        </template>
        <p v-else>No address found, so it is kept with just its name.</p>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
/**
 * The tap-to-keep cards for proposed Nodes (Discuss and the Google Docs import). A card lets the user settle
 * a habit's cycle and pick which place match to keep before tapping Keep; nothing is saved until the tap.
 */
import { reactive, watch } from 'vue';
import type { Period } from '~/lib/domain';
import { mapsUrl } from '~/lib/home/apps';
import { defaultChoice, type KeepChoice, type NodeProposal } from '~/lib/home/proposals';

const props = defineProps<{ proposals: NodeProposal[]; kept: ReadonlyMap<string, string> }>();
defineEmits<{ (e: 'keep', p: NodeProposal, choice: KeepChoice): void }>();

const choices = reactive<Record<string, KeepChoice>>({}); // proposal ref -> what the card is set to (cycle, place)
watch(() => props.proposals, (list) => { for (const p of list) if (!choices[p.ref]) choices[p.ref] = defaultChoice(p); }, { immediate: true });

const KIND_WORD: Record<NodeProposal['kind'], string> = { goal: 'goal', habit: 'habit idea', commitment: 'to do', idea: 'idea', thing: 'thing' };
const PERIOD_WORDS: { value: Period; label: string }[] = [
  { value: 'day', label: 'day' }, { value: 'week', label: 'week' }, { value: 'month', label: 'month' }, { value: 'quarter', label: 'quarter' },
  { value: 'four_months', label: '4 months' }, { value: 'six_months', label: '6 months' }, { value: 'year', label: 'year' },
];
const cyclePeriod = (p: NodeProposal): string => choices[p.ref]?.cycle?.period ?? '';
const cycleTarget = (p: NodeProposal): number => choices[p.ref]?.cycle?.target ?? 1;
function setCycle(p: NodeProposal, period: string, target: number) {
  choices[p.ref] = { ...choices[p.ref], cycle: period ? { period: period as Period, target } : null };
}
const matchIndex = (p: NodeProposal): number => Math.max(0, (p.matches ?? []).findIndex((m) => m.address === choices[p.ref]?.place?.address));
function pickMatch(p: NodeProposal, i: number) {
  choices[p.ref] = { ...choices[p.ref], place: p.matches?.[i] ?? null };
}
const mapsLink = (p: NodeProposal): string | null => (choices[p.ref]?.place ? mapsUrl(choices[p.ref]!.place!) : null);
</script>
