<template>
  <div v-if="open" class="fixed inset-0 z-[35] overflow-y-auto bg-[#EEF5F3] text-slate-800 dark:bg-[#1D1A2F] dark:text-slate-100" role="dialog" aria-label="Planning session">
    <div class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-4 md:max-w-xl">
      <header class="flex items-center gap-3">
        <h1 class="min-w-0 flex-1 font-serif text-xl font-semibold">Planning session</h1>
        <button class="min-h-[44px] rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/5" @click="stop">Stop for now</button>
      </header>
      <p v-if="privateNote" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ privateNote }}</p>

      <!-- the cards: one at a time, each skippable by moving on -->
      <section v-if="step === 'triage'" class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#2A2645]">
        <p class="font-serif text-lg">Things you captured</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep puts it on today. Park leaves it in the heap. Drop deletes it.</p>
        <ul class="mt-3 space-y-3">
          <li v-for="i in ideas" :key="i.id" class="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
            <p class="break-words text-[15px]">{{ i.title }}</p>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button :class="btn" @click="decide(i.id, 'keep')">Keep</button>
              <button :class="btn" @click="decide(i.id, 'park')">Park</button>
              <button :class="btn" @click="decide(i.id, 'drop')">Drop</button>
            </div>
          </li>
        </ul>
        <button class="mt-3 min-h-[44px] w-full rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300" @click="next">Skip these for now</button>
      </section>

      <section v-else-if="step === 'connections'" class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#2A2645]">
        <p class="font-serif text-lg">Could these belong together?</p>
        <ul class="mt-3 space-y-3">
          <li v-for="p in shownConnections" :key="key(p)" class="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
            <p class="break-words text-[15px]">{{ sentence(p) }}</p>
            <p class="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">From "{{ p.evidence }}"</p>
            <div class="mt-2 grid grid-cols-2 gap-2">
              <button :class="btn" @click="connect(p)">Connect</button>
              <button :class="btn" @click="dismiss(p)">Not this</button>
            </div>
          </li>
        </ul>
        <button class="mt-3 min-h-[44px] w-full rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300" @click="next">Next</button>
      </section>

      <section v-else-if="step === 'conflicts'" class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#2A2645]">
        <p class="font-serif text-lg">Worth a look</p>
        <ul class="mt-3 space-y-3">
          <li v-for="(c, n) in conflicts" :key="c.line" class="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
            <p class="break-words text-[15px]">{{ c.line }}</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ c.fix.text }}</p>
            <div class="mt-2 grid grid-cols-2 gap-2">
              <button v-if="c.fix.action" :class="btn" @click="applyFix(c, n)">{{ c.fix.action.type === 'park' ? 'Park it' : 'Open it' }}</button>
              <button :class="btn" @click="conflicts.splice(n, 1); afterList()">Leave it</button>
            </div>
          </li>
        </ul>
        <button class="mt-3 min-h-[44px] w-full rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300" @click="next">Next</button>
      </section>

      <section v-else-if="step === 'recap'" class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#2A2645]">
        <div v-for="s in recaps" :key="s.title" class="mb-3 last:mb-0">
          <p class="text-xs font-bold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">{{ s.title }}</p>
          <p v-for="l in s.lines" :key="l" class="mt-1 text-[15px]">{{ l }}</p>
        </div>
        <button class="mt-3 min-h-[44px] w-full rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300" @click="next">Next</button>
      </section>

      <section v-else class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#2A2645]">
        <p class="font-serif text-lg">{{ nothingToSee ? "Nothing to look at. You're clear." : "That's everything for now." }}</p>
        <button class="mt-4 min-h-[48px] w-full rounded-2xl bg-[#E07A45] font-semibold text-white" @click="finish">Finish</button>
      </section>

      <details class="mt-4 rounded-2xl bg-white/60 px-4 py-2 text-sm dark:bg-white/5">
        <summary class="min-h-[44px] cursor-pointer leading-[44px]">Options</summary>
        <label v-for="r in RECAPS" :key="r.kind" class="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" :checked="recapOn[r.kind]" @change="toggleRecap(r.kind, ($event.target as HTMLInputElement).checked)" />
          {{ r.label }}
        </label>
        <label class="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" :checked="reminder" @change="toggleReminder(($event.target as HTMLInputElement).checked)" />
          Invite me once a week (a notification)
        </label>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { aiFetch } from '~/lib/ai-client';
import { dayKey, detectConflicts, ideasToReview, recapLines, type Conflict, type Idea, type RecapPeriod } from '~/lib/domain';
import {
  addPlanningReviewed, finishPlanning, getAiOn, getPlanningFinished, getPlanningReminder, getPlanningReviewed, getRecapOn, setPlanningReminder, setRecapOn,
} from '~/lib/home/prefs';
import { connectionProposals, type LinkProposal } from '~/lib/home/proposals';
import { useAppStore } from '~/stores/app';
import { useGraphStore } from '~/stores/graph';
import { useRewards } from '~/composables/useRewards';

type Step = 'triage' | 'connections' | 'conflicts' | 'recap' | 'done';
const ORDER: Step[] = ['triage', 'connections', 'conflicts', 'recap'];
const RECAPS: { kind: RecapPeriod; label: string; title: string }[] = [
  { kind: 'week', label: 'Show a weekly recap', title: 'This week' },
  { kind: 'month', label: 'Show a monthly recap', title: 'This month' },
  { kind: 'quarter', label: 'Show a quarterly recap', title: 'This quarter' },
];
const btn = 'min-h-[44px] rounded-xl border border-slate-200 text-sm font-medium dark:border-white/10';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'said', msg: string): void; (e: 'edit', nodeId: string): void }>();
const app = useAppStore();
const graph = useGraphStore();
const { reward } = useRewards();

const step = ref<Step>('done');
const nothingToSee = ref(false);
const ideas = ref<Idea[]>([]);
const conflicts = ref<Conflict[]>([]);
const recaps = ref<{ title: string; lines: string[] }[]>([]);
const proposals = ref<LinkProposal[]>([]);
const dismissed = ref(new Set<string>());
const aiUsed = ref(false);
const recapOn = reactive<Record<RecapPeriod, boolean>>({ week: false, month: false, quarter: false });
const reminder = ref(false);
let run = 0;

const key = (p: LinkProposal) => `${p.type}|${p.from}|${p.to}`;
const shownConnections = computed(() => connectionProposals(proposals.value, graph.nodes, graph.links).filter((p) => !dismissed.value.has(key(p))));
const privateNote = computed(() => {
  const n = graph.nodes.filter((x) => x.private).length;
  return aiUsed.value && n > 0 ? `${n} private ${n === 1 ? 'item' : 'items'} not included.` : '';
});

const active = (s: Step): boolean =>
  s === 'triage' ? ideas.value.length > 0
    : s === 'connections' ? shownConnections.value.length > 0
      : s === 'conflicts' ? conflicts.value.length > 0
        : s === 'recap' ? recaps.value.length > 0 : false;

/** The next card that has something on it after the current one, or the end. */
function next() {
  const from = ORDER.indexOf(step.value as Step);
  step.value = ORDER.slice(from + 1).find(active) ?? 'done';
}
/** After a list on the current card has been worked through, move on if it is empty. */
function afterList() { if (!active(step.value)) next(); }

function buildRecaps() {
  const input = { nodes: graph.nodes, links: graph.links, occurrences: graph.occurrences, at: new Date() };
  recaps.value = RECAPS.filter((r) => recapOn[r.kind]).map((r) => ({ title: r.title, lines: recapLines({ ...input, period: r.kind }) })).filter((s) => s.lines.length > 0);
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) { run++; return; }
  const mine = ++run;
  for (const r of RECAPS) recapOn[r.kind] = getRecapOn(r.kind);
  reminder.value = getPlanningReminder();
  graph.refresh();
  ideas.value = ideasToReview(graph.nodes, getPlanningFinished(), getPlanningReviewed());
  conflicts.value = detectConflicts({ now: new Date(), nodes: graph.nodes, links: graph.links, occurrences: graph.occurrences, timeFormat: graph.timeFormat });
  buildRecaps();
  proposals.value = [];
  dismissed.value = new Set();
  aiUsed.value = getAiOn() && app.signedIn;
  step.value = ORDER.find(active) ?? 'done';
  nothingToSee.value = step.value === 'done';
  if (aiUsed.value) void loadProposals(mine);
}, { immediate: true });

/** Ask for connections for the Ideas on screen. Private ones are never even named; the server drops them too. */
async function loadProposals(mine: number) {
  const focusIds = ideas.value.filter((i) => !i.private).map((i) => i.id);
  if (focusIds.length === 0) return;
  const r = await aiFetch<{ ok: true; links: LinkProposal[] }>('/api/ai/extract', { focusIds }, { accessToken: app.session?.access_token });
  if (mine !== run || r.status !== 'ok') return; // closed meanwhile, or AI off or unavailable: the session simply has no connections card
  proposals.value = r.data.links;
}

function decide(id: string, choice: 'keep' | 'park' | 'drop') {
  if (choice === 'keep') { graph.plan(id, dayKey(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)); emit('said', 'Added to today.'); }
  else if (choice === 'drop') { graph.removeNode(id); emit('said', 'Dropped.'); }
  addPlanningReviewed(id); // kept even if the session is stopped here
  ideas.value = ideas.value.filter((i) => i.id !== id);
  afterList();
}

const titleOf = (id: string) => graph.nodes.find((n) => n.id === id)?.title ?? '';
const SAYS: Record<LinkProposal['type'], string> = { part_of: 'is part of', requires: 'needs first', needs: 'needs', at: 'happens at', with: 'goes with' };
const sentence = (p: LinkProposal) => `"${titleOf(p.from)}" ${SAYS[p.type]} "${titleOf(p.to)}"?`;
function connect(p: LinkProposal) {
  if (graph.acceptConnection(p)) emit('said', 'Connected.');
  dismissed.value = new Set([...dismissed.value, key(p)]);
  afterList();
}
function dismiss(p: LinkProposal) { dismissed.value = new Set([...dismissed.value, key(p)]); afterList(); }

function applyFix(c: Conflict, n: number) {
  const a = c.fix.action;
  if (!a) return;
  if (a.type === 'park') { graph.park(a.id); emit('said', 'Parked.'); } else emit('edit', a.id);
  conflicts.value.splice(n, 1);
  afterList();
}

function toggleRecap(kind: RecapPeriod, on: boolean) { recapOn[kind] = on; setRecapOn(kind, on); buildRecaps(); }
function toggleReminder(on: boolean) { reminder.value = on; setPlanningReminder(on); }

function stop() { emit('said', 'Stopped for now. Where you got to is kept.'); emit('close'); }
/** Finishing is the reward moment: one warm line and the week's tally, nothing to lose. */
function finish() {
  finishPlanning();
  emit('said', reward('planning'));
  emit('close');
}
</script>
