<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-end bg-stone-900/30" @click.self="$emit('close')">
    <div class="mx-auto w-full max-w-md rounded-t-[2rem] bg-white p-5 pb-8 dark:bg-[#2A2645]" role="dialog" aria-label="Capture">
      <CrisisCard v-if="crisis" :resources="crisis" @okay="dismissCrisis" @not-meant="dismissCrisis" />
      <div v-else-if="mode === 'disclose'" role="region" aria-label="Before we talk">
        <p class="font-serif text-xl">Before we talk</p>
        <p class="mt-2 text-[15px] text-slate-700 dark:text-slate-200">This sends this conversation and the relevant part of your list to Claude.</p>
        <div class="mt-3 flex gap-2">
          <button type="button" class="min-h-[44px] rounded-2xl bg-stone-100 px-4 text-sm dark:bg-white/10" @click="mode = 'form'">Not now</button>
          <button type="button" class="min-h-[44px] flex-1 rounded-2xl bg-[#E07A45] font-semibold text-white" @click="acceptDisclosure">Continue</button>
        </div>
      </div>
      <HomeDiscuss v-else-if="mode === 'discuss'" :initial="draft" @close="$emit('close')" @said="(m: string) => $emit('said', m)" @crisis="onDiscussCrisis" />
      <template v-else>
      <p class="font-serif text-xl">What's on your mind?</p>
      <!-- the back-and-forth: each thing said, and Cadence's reply -->
      <ul v-if="turns.length" ref="list" class="mt-3 max-h-56 space-y-2 overflow-y-auto" aria-live="polite">
        <li v-for="(t, i) in turns" :key="i" :class="['rounded-2xl px-3 py-2 text-[15px]', t.role === 'user' ? 'ml-8 bg-stone-100 dark:bg-white/10' : 'mr-8 border border-slate-200 dark:border-white/10']">{{ t.text }}</li>
        <li v-if="busy" class="mr-8 px-3 py-2 text-sm text-slate-500 dark:text-slate-400">…</li>
      </ul>
      <div v-if="speechSupported" class="mt-3 flex items-center gap-2">
        <button
          type="button"
          :aria-pressed="speechState.listening"
          :aria-label="speechState.listening ? 'Stop and send' : 'Start mic'"
          :disabled="busy"
          class="min-h-[44px] min-w-[44px] rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:hover:bg-white/15 dark:text-stone-300 disabled:opacity-50 transition-colors"
          @click="toggleSpeech"
        >
          <Mic v-if="!speechState.listening" class="size-5" />
          <Square v-else class="size-5" />
        </button>
        <div v-if="speechState.message" class="flex-1 text-xs text-stone-600 dark:text-stone-300">{{ speechState.message }}</div>
        <div v-else-if="speechState.listening" class="flex-1 text-xs text-stone-600 dark:text-stone-300">Listening. Tap the square to send.</div>
      </div>
      <div class="relative mt-3">
        <textarea
          ref="box" v-model="draft" rows="3" maxlength="4000"
          class="w-full rounded-2xl border border-stone-200 bg-stone-50 p-3 pr-11 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
          :placeholder="turns.length ? `Say the next thing, or close when you're done.` : `Say it or type it. I'll park it.`" @keydown.ctrl.enter="add()" @keydown.meta.enter="add()"
        />
        <button
          v-if="draft" type="button" aria-label="Clear" :disabled="busy"
          class="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-white/15"
          @click="clear"
        >
          <X class="size-4" />
        </button>
      </div>
      <p v-if="error" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ error }}</p>
      <div class="mt-3 flex gap-2">
        <button type="button" class="min-h-[44px] rounded-2xl bg-stone-100 px-4 text-sm dark:bg-white/10" @click="$emit('close')">Close</button>
        <button v-if="discussAvailable" type="button" class="min-h-[44px] rounded-2xl bg-stone-100 px-4 text-sm font-medium dark:bg-white/10" :disabled="busy" @click="startDiscuss">Discuss</button>
        <button type="button" class="min-h-[44px] flex-1 rounded-2xl bg-[#E07A45] font-semibold text-white disabled:opacity-50" :disabled="!draft.trim() || busy" @click="add()">{{ busy ? 'Adding…' : 'Add' }}</button>
      </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, onMounted, onUnmounted } from 'vue';
import { Mic, Square, X } from 'lucide-vue-next';
import { useGraphStore } from '~/stores/graph';
import { useRewards } from '~/composables/useRewards';
import { loadState } from '~/lib/home/nudge-state';
import { checkCrisis, type Resource } from '~/lib/domain/crisis';
import { currentResources, markCardShown, shouldShowCard } from '~/lib/home/crisis-state';
import { getAiOn, getDiscussDisclosed, setDiscussDisclosed, speechLevel } from '~/lib/home/prefs';
import { useAppStore } from '~/stores/app';
import { getRecognitionCtor, joinTranscript, messageFor, initialState, setListening, setMessage } from '~/lib/home/speech-input';
import { browserVoice, followUp, sayAloud } from '~/lib/home/talk';

/** `listen`: the sheet was opened from the mic button, so start listening right away. */
const props = defineProps<{ open: boolean; listen?: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'said', msg: string): void }>();
const graph = useGraphStore();
const { reward } = useRewards();
const app = useAppStore();
const draft = ref('');
/** form: the usual box. disclose: the one-line note on what Discuss sends. discuss: the conversation. */
const mode = ref<'form' | 'disclose' | 'discuss'>('form');
/** Discuss needs AI on and a signed-in account (the server holds the switch and the cap). Read each time the sheet opens. */
const discussAvailable = ref(false);
const error = ref('');
const busy = ref(false);
/** The help lines to show in place of the form, after a crisis-language capture. */
const crisis = ref<Resource[] | null>(null);
const box = ref<HTMLTextAreaElement | null>(null);
const speechSupported = ref(false);
const speechState = ref(initialState());
/** What was said on this sheet and what Cadence answered; in memory only, gone when the sheet closes. */
const turns = ref<{ role: 'user' | 'assistant'; text: string }[]>([]);
const list = ref<HTMLUListElement | null>(null);

let recognition: any = null;
let baseSpeech = '';
let ignoreResults = false;
/** Tapping the mic off sends what was heard; `end` arrives after the tap. */
let sendOnEnd = false;

onMounted(() => {
  const ctor = getRecognitionCtor(window);
  speechSupported.value = ctor !== null;
  if (!ctor) return;

  try {
    recognition = new ctor();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.addEventListener('start', () => {
      ignoreResults = false;
      speechState.value = setListening(speechState.value, true);
      speechState.value = setMessage(speechState.value, null);
    });

    recognition.addEventListener('result', (event: any) => {
      if (ignoreResults) return;
      const text = joinTranscript(baseSpeech, event.results);
      draft.value = text;
    });

    recognition.addEventListener('error', (event: any) => {
      const msg = messageFor(event.error);
      if (msg) {
        speechState.value = setMessage(speechState.value, msg);
      }
      speechState.value = setListening(speechState.value, false);
    });

    recognition.addEventListener('end', () => {
      speechState.value = setListening(speechState.value, false);
      if (sendOnEnd && draft.value.trim()) void add({ voice: true });
      sendOnEnd = false;
    });
  } catch {
    speechSupported.value = false;
  }
});

onUnmounted(() => {
  ignoreResults = true;
  if (recognition) {
    try { recognition.abort(); } catch { /* noop */ }
  }
});

watch(() => props.open, async (o) => {
  if (o) {
    error.value = '';
    crisis.value = null;
    mode.value = 'form';
    turns.value = [];
    discussAvailable.value = getAiOn() && app.signedIn;
    baseSpeech = '';
    ignoreResults = false;
    sendOnEnd = false;
    speechState.value = initialState();
    await nextTick();
    if (props.listen && recognition) toggleSpeech(); // still inside the tap that opened it
    else box.value?.focus();
  } else {
    ignoreResults = true;
    window.speechSynthesis?.cancel();
    if (recognition) {
      try { recognition.abort(); } catch { /* noop */ }
    }
    speechState.value = initialState();
  }
});

function toggleSpeech() {
  if (!recognition) return;

  try {
    if (speechState.value.listening) {
      sendOnEnd = true;
      recognition.stop();
    } else {
      // The one mute silences the mic too (SPEC section 6).
      if (loadState().muted) {
        speechState.value = setMessage(speechState.value, 'Sound is muted. Unmute it in Settings to use the mic.');
        return;
      }
      baseSpeech = draft.value;
      recognition.start();
    }
  } catch {
    speechState.value = setMessage(speechState.value, messageFor('unknown'));
  }
}

function stopListening() {
  ignoreResults = true;
  if (recognition && speechState.value.listening) {
    try { recognition.abort(); } catch { /* noop */ }
  }
}

function startDiscuss() {
  stopListening();
  mode.value = getDiscussDisclosed() ? 'discuss' : 'disclose';
}

function acceptDisclosure() {
  setDiscussDisclosed(true);
  mode.value = 'discuss';
}

/**
 * Crisis language in Discuss (ticket 24): no AI call was or will be made for it. What the person said is
 * kept as a Private Idea, and the calm card shows at most once a day. A match in an AI reply has no text to keep.
 */
async function onDiscussCrisis(text: string | null) {
  if (text) await graph.capture(text, { private: true });
  mode.value = 'form';
  draft.value = '';
  if (shouldShowCard()) {
    markCardShown();
    crisis.value = currentResources().resources;
    return;
  }
  emit('close');
}

function dismissCrisis() {
  crisis.value = null;
  emit('close');
}

function clear() {
  // Stop listening first: recognition rebuilds the text from everything heard so far.
  if (recognition && speechState.value.listening) {
    try { recognition.abort(); } catch { /* noop */ }
  }
  draft.value = '';
  baseSpeech = '';
  nextTick(() => box.value?.focus());
}

/** `voice`: the words came from the mic, so the reply is said aloud and the mic opens again after it. */
async function add(opts: { voice?: boolean } = {}) {
  if (busy.value || !draft.value.trim()) return;
  sendOnEnd = false;
  ignoreResults = true;
  if (recognition && speechState.value.listening) {
    try { recognition.abort(); } catch { /* noop */ }
  }
  busy.value = true;
  // On-device rules only: the text is checked here and never sent anywhere to be checked.
  // A match is saved as a Private Idea; the card shows at most once a day.
  const text = draft.value.trim();
  const heavy = checkCrisis(text);
  const r = await graph.capture(text, { private: heavy });
  busy.value = false;
  if (!r.ok) { error.value = r.message; return; }
  draft.value = '';
  baseSpeech = '';
  if (heavy) {
    // No back-and-forth, coach voice or tone after a crisis match: the card, or just the plain acknowledgement.
    if (shouldShowCard()) {
      markCardShown();
      crisis.value = currentResources().resources;
      return;
    }
    emit('close');
    emit('said', r.reply);
    return;
  }
  // The sheet stays open: the reply shows as Cadence's turn and asks for the next thing.
  error.value = '';
  const ack = reward('capture', { ack: r.reply });
  const ask = followUp(turns.value.filter((t) => t.role === 'user').length + 1);
  turns.value = [...turns.value, { role: 'user', text }, { role: 'assistant', text: `${ack} ${ask}` }];
  await nextTick();
  if (list.value) list.value.scrollTop = list.value.scrollHeight;
  if (!opts.voice) { box.value?.focus(); return; }
  // Spoken in, spoken back: say the reply (never over the one mute), then listen for the next thing.
  if (loadState().muted) return;
  await sayAloud(`${ack} ${ask}`, { ...browserVoice(window), volume: speechLevel() });
  if (props.open && mode.value === 'form' && !crisis.value && !speechState.value.listening) toggleSpeech();
}
</script>
