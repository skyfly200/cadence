<template>
  <div role="region" aria-label="Discuss">
    <div class="flex items-center gap-3">
      <p class="min-w-0 flex-1 font-serif text-xl">{{ stage === 'talk' ? "Let's talk it through." : heardLine(totalShown) }}</p>
      <button type="button" class="min-h-[44px] rounded-2xl bg-stone-100 px-4 text-sm font-medium dark:bg-white/10" @click="done">Done</button>
    </div>
    <p v-if="privateNote" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ privateNote }}</p>

    <!-- the conversation: one short question at a time -->
    <template v-if="stage === 'talk'">
      <ul class="mt-3 max-h-56 space-y-2 overflow-y-auto" aria-live="polite">
        <li v-if="!turns.length" class="text-[15px] text-slate-600 dark:text-slate-300">What's nagging at you?</li>
        <li v-for="(t, i) in turns" :key="i" :class="['rounded-2xl px-3 py-2 text-[15px]', t.role === 'user' ? 'ml-8 bg-stone-100 dark:bg-white/10' : 'mr-8 border border-slate-200 dark:border-white/10']">{{ t.text }}</li>
        <li v-if="busy" class="mr-8 px-3 py-2 text-sm text-slate-500 dark:text-slate-400">…</li>
      </ul>
      <textarea
        ref="box" v-model="input" rows="2" maxlength="1000" :disabled="busy"
        class="mt-3 w-full rounded-2xl border border-stone-200 bg-stone-50 p-3 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
        placeholder="Say it or type it." @keydown.ctrl.enter="send" @keydown.meta.enter="send"
      />
      <p v-if="error" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ error }}</p>
      <button type="button" class="mt-3 min-h-[44px] w-full rounded-2xl bg-[#E07A45] font-semibold text-white disabled:opacity-50" :disabled="!input.trim() || busy" @click="send">Send</button>
    </template>

    <!-- the summary: nothing is saved until a tap -->
    <template v-else>
      <p v-if="summarising" class="mt-3 text-[15px] text-slate-600 dark:text-slate-300">One moment…</p>
      <template v-else>
        <ul v-if="proposalNodes.length" class="mt-3 space-y-2">
          <li v-for="p in proposalNodes" :key="p.ref" class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
            <p class="min-w-0 flex-1 break-words text-[15px]">{{ p.title }} <span class="text-xs text-slate-500 dark:text-slate-400">({{ KIND_WORD[p.kind] }})</span></p>
            <span v-if="kept.has(p.ref)" class="text-sm text-slate-500 dark:text-slate-400">Kept</span>
            <button v-else type="button" class="min-h-[44px] rounded-xl bg-stone-100 px-4 text-sm font-medium dark:bg-white/10" @click="keep(p)">Keep</button>
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
        <ul v-if="shownLinks.length" class="mt-3 space-y-2">
          <li v-for="p in shownLinks" :key="linkKey(p)" class="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
            <p class="break-words text-[15px]">{{ sentence(p) }}</p>
            <button type="button" class="mt-2 min-h-[44px] w-full rounded-xl bg-stone-100 text-sm font-medium dark:bg-white/10" @click="connect(p)">Connect</button>
          </li>
        </ul>
        <p v-if="!proposalNodes.length" class="mt-3 text-[15px] text-slate-600 dark:text-slate-300">Nothing is saved unless you keep it. You can park what you said as one note.</p>
        <button v-if="!kept.size && !parked" type="button" class="mt-3 min-h-[44px] w-full rounded-2xl bg-stone-100 text-sm font-medium dark:bg-white/10" :disabled="parking" @click="parkAll">Park what I said as one note</button>
        <p v-if="error" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ error }}</p>
        <button type="button" class="mt-3 min-h-[44px] w-full rounded-2xl bg-[#E07A45] font-semibold text-white" @click="finish">Done</button>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { aiFetch } from '~/lib/ai-client';
import { checkCrisis } from '~/lib/domain/crisis';
import { MAX_TURNS, heardLine, privateLine, spoken, userText } from '~/lib/home/discuss';
import { mapsUrl } from '~/lib/home/apps';
import { defaultChoice, linksAfterKeeping, type KeepChoice, type LinkProposal, type NodeProposal } from '~/lib/home/proposals';
import type { Period } from '~/lib/domain';
import { useAppStore } from '~/stores/app';
import { useGraphStore } from '~/stores/graph';
import type { Turn } from '~~/server/utils/discuss';

/**
 * `crisis`: the person's words matched the on-device rules, or an AI reply did (then `text` is null).
 * The sheet saves `text` as a Private Idea and shows the calm card; no AI call is made for that turn.
 */
const emit = defineEmits<{ (e: 'close'): void; (e: 'said', msg: string): void; (e: 'crisis', text: string | null): void }>();
/** Words already typed on the capture sheet: they open the conversation. */
const props = defineProps<{ initial?: string }>();
const app = useAppStore();
const graph = useGraphStore();

const stage = ref<'talk' | 'summary'>('talk');
/** The transcript lives here, in memory, and goes when this component does. */
const turns = ref<Turn[]>([]);
const input = ref('');
const busy = ref(false);
const error = ref('');
const privateExcluded = ref(0);
const box = ref<HTMLTextAreaElement | null>(null);

const summarising = ref(false);
const proposalNodes = ref<NodeProposal[]>([]);
const proposalLinks = ref<LinkProposal[]>([]);
const choices = reactive<Record<string, KeepChoice>>({}); // proposal ref -> what the card is set to (cycle, place)
const kept = reactive(new Map<string, string>()); // proposal ref -> saved node id
const connected = ref(new Set<string>());
const parked = ref(false);
const parking = ref(false);

const KIND_WORD: Record<NodeProposal['kind'], string> = { goal: 'goal', habit: 'habit idea', commitment: 'to do', idea: 'idea', thing: 'thing' };
const SAYS: Record<LinkProposal['type'], string> = { part_of: 'is part of', requires: 'needs first', needs: 'needs', at: 'happens at', with: 'goes with' };
const linkKey = (p: LinkProposal) => `${p.type}|${p.from}|${p.to}`;
const titleOf = (id: string) => graph.nodes.find((n) => n.id === id)?.title ?? '';
const sentence = (p: LinkProposal) => `"${titleOf(p.from)}" ${SAYS[p.type]} "${titleOf(p.to)}"?`;

const shownLinks = computed(() => linksAfterKeeping(proposalLinks.value, kept, graph.nodes, graph.links).filter((p) => !connected.value.has(linkKey(p))));
const totalShown = computed(() => proposalNodes.value.length + shownLinks.value.length);
const privateNote = computed(() => privateLine(privateExcluded.value));

onMounted(async () => {
  await nextTick();
  box.value?.focus();
  if (props.initial?.trim()) { input.value = props.initial.trim(); await send(); }
});

async function send() {
  const text = input.value.trim();
  if (!text || busy.value) return;
  // On-device rules first: a matching message is never sent anywhere, AI call or not.
  if (checkCrisis(text)) { emit('crisis', [userText(turns.value), text].filter(Boolean).join('\n')); return; }
  error.value = '';
  const next: Turn[] = [...turns.value, { role: 'user', text }];
  busy.value = true;
  turns.value = next;
  input.value = '';
  const r = await aiFetch<{ ok: true; crisis: boolean; reply?: string; last?: boolean; privateExcluded?: number }>(
    '/api/ai/discuss', { messages: next }, { accessToken: app.session?.access_token },
  );
  busy.value = false;
  if (r.status === 'off') { error.value = 'AI is switched off, so Discuss is not available.'; return; }
  if (r.status === 'signed_out') { error.value = 'Sign in to use Discuss.'; return; }
  if (r.status === 'failed') { error.value = r.message; return; }
  if (r.data.crisis) { emit('crisis', null); return; }
  privateExcluded.value = r.data.privateExcluded ?? 0;
  turns.value = [...next, { role: 'assistant', text: r.data.reply ?? '' }];
  if (r.data.last || spoken(turns.value) >= MAX_TURNS) await summarise();
  else { await nextTick(); box.value?.focus(); }
}

/** "Done" at any point: sum up what was said, or just close if nothing was. */
async function done() {
  if (stage.value === 'summary') return finish();
  if (!spoken(turns.value) && !input.value.trim()) { emit('close'); return; }
  if (input.value.trim()) {
    // The unsent words count too, and are checked like any other.
    const text = input.value.trim();
    if (checkCrisis(text)) { emit('crisis', [userText(turns.value), text].filter(Boolean).join('\n')); return; }
    turns.value = [...turns.value, { role: 'user', text }]; // only used for the summary, which reads what the person said
    input.value = '';
  }
  await summarise();
}

async function summarise() {
  stage.value = 'summary';
  summarising.value = true;
  const r = await aiFetch<{ ok: true; nodes: NodeProposal[]; links: LinkProposal[] }>('/api/ai/extract', { text: userText(turns.value) }, { accessToken: app.session?.access_token });
  summarising.value = false;
  if (r.status !== 'ok') return; // no proposals: the person can still park what they said
  proposalNodes.value = r.data.nodes;
  proposalLinks.value = r.data.links;
  for (const p of r.data.nodes) choices[p.ref] = defaultChoice(p);
}

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

function keep(p: NodeProposal) {
  const id = graph.keepProposedNode(p, choices[p.ref] ?? defaultChoice(p));
  if (id) kept.set(p.ref, id);
}

function connect(p: LinkProposal) {
  if (graph.acceptConnection(p)) connected.value = new Set([...connected.value, linkKey(p)]);
}

async function parkAll() {
  parking.value = true;
  const r = await graph.capture(userText(turns.value));
  parking.value = false;
  if (!r.ok) { error.value = r.message; return; }
  parked.value = true;
}

function finish() {
  const saved = kept.size > 0 || connected.value.size > 0 || parked.value;
  emit('close');
  emit('said', saved ? 'Got it, parked.' : 'Okay.');
}
</script>
