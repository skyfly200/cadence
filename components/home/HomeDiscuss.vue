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
      <div v-if="speechSupported" class="mt-3 flex items-center gap-2">
        <button
          type="button"
          :aria-pressed="speechState.listening"
          :aria-label="speechState.listening ? 'Stop listening' : 'Start mic'"
          :disabled="busy"
          class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-white/15"
          @click="toggleSpeech"
        >
          <Mic v-if="!speechState.listening" class="size-5" />
          <Square v-else class="size-5" />
        </button>
        <div v-if="speechState.message" class="flex-1 text-xs text-stone-600 dark:text-stone-300">{{ speechState.message }}</div>
      </div>
      <textarea
        ref="box" v-model="input" rows="2" maxlength="1000" :disabled="busy"
        class="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 p-3 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
        placeholder="Say it or type it." @keydown.ctrl.enter="send" @keydown.meta.enter="send"
      />
      <p v-if="error" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ error }}</p>
      <button type="button" class="mt-3 min-h-[44px] w-full rounded-2xl bg-[#E07A45] font-semibold text-white disabled:opacity-50" :disabled="!input.trim() || busy" @click="send">Send</button>
    </template>

    <!-- the summary: nothing is saved until a tap -->
    <template v-else>
      <p v-if="summarising" class="mt-3 text-[15px] text-slate-600 dark:text-slate-300">One moment…</p>
      <template v-else>
        <ProposalCards v-if="proposalNodes.length" class="mt-3" :proposals="proposalNodes" :kept="kept" @keep="keep" />
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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { Mic, Square } from 'lucide-vue-next';
import { aiFetch } from '~/lib/ai-client';
import { checkCrisis } from '~/lib/domain/crisis';
import { loadState } from '~/lib/home/nudge-state';
import { getRecognitionCtor, initialState, joinTranscript, messageFor, setListening, setMessage } from '~/lib/home/speech-input';
import { MAX_TURNS, heardLine, privateLine, spoken, userText } from '~/lib/home/discuss';
import { linksAfterKeeping, type KeepChoice, type LinkProposal, type NodeProposal } from '~/lib/home/proposals';
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
const kept = reactive(new Map<string, string>()); // proposal ref -> saved node id
const connected = ref(new Set<string>());
const parked = ref(false);
const parking = ref(false);

const SAYS: Record<LinkProposal['type'], string> = { part_of: 'is part of', requires: 'needs first', needs: 'needs', at: 'happens at', with: 'goes with' };
const linkKey = (p: LinkProposal) => `${p.type}|${p.from}|${p.to}`;
const titleOf = (id: string) => graph.nodes.find((n) => n.id === id)?.title ?? '';
const sentence = (p: LinkProposal) => `"${titleOf(p.from)}" ${SAYS[p.type]} "${titleOf(p.to)}"?`;

const shownLinks = computed(() => linksAfterKeeping(proposalLinks.value, kept, graph.nodes, graph.links).filter((p) => !connected.value.has(linkKey(p))));
const totalShown = computed(() => proposalNodes.value.length + shownLinks.value.length);
const privateNote = computed(() => privateLine(privateExcluded.value));

// Tap-to-talk, same as the capture sheet's mic: the words land in the message box.
const speechSupported = ref(false);
const speechState = ref(initialState());
let recognition: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
let baseSpeech = '';
let ignoreResults = false;

onMounted(async () => {
  const ctor = getRecognitionCtor(window);
  speechSupported.value = ctor !== null;
  if (ctor) {
    try {
      recognition = new ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.addEventListener('start', () => {
        ignoreResults = false;
        speechState.value = setMessage(setListening(speechState.value, true), null);
      });
      recognition.addEventListener('result', (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!ignoreResults) input.value = joinTranscript(baseSpeech, event.results);
      });
      recognition.addEventListener('error', (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const msg = messageFor(event.error);
        if (msg) speechState.value = setMessage(speechState.value, msg);
        speechState.value = setListening(speechState.value, false);
      });
      recognition.addEventListener('end', () => { speechState.value = setListening(speechState.value, false); });
    } catch {
      speechSupported.value = false;
    }
  }
  await nextTick();
  box.value?.focus();
  if (props.initial?.trim()) { input.value = props.initial.trim(); await send(); }
});

onUnmounted(() => stopListening());

function toggleSpeech() {
  if (!recognition) return;
  try {
    if (speechState.value.listening) {
      recognition.stop();
    } else {
      // The one mute silences the mic too (SPEC section 6).
      if (loadState().muted) {
        speechState.value = setMessage(speechState.value, 'Sound is muted. Unmute it in Settings to use the mic.');
        return;
      }
      baseSpeech = input.value;
      recognition.start();
    }
  } catch {
    speechState.value = setMessage(speechState.value, messageFor('unknown'));
  }
}

/** Stop first, so recognition does not rebuild the box after a message is sent or the conversation ends. */
function stopListening() {
  ignoreResults = true;
  if (recognition && speechState.value.listening) {
    try { recognition.abort(); } catch { /* noop */ }
  }
}

async function send() {
  const text = input.value.trim();
  if (!text || busy.value) return;
  stopListening();
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
  stopListening();
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
}

function keep(p: NodeProposal, choice: KeepChoice) {
  const id = graph.keepProposedNode(p, choice);
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
