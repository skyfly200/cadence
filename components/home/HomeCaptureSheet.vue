<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-end bg-stone-900/30" @click.self="$emit('close')">
    <div class="mx-auto w-full max-w-md rounded-t-[2rem] bg-white p-5 pb-8 dark:bg-[#2A2645]" role="dialog" aria-label="Capture">
      <p class="font-serif text-xl">What's on your mind?</p>
      <div v-if="speechSupported" class="mt-3 flex items-center gap-2">
        <button
          type="button"
          :aria-pressed="speechState.listening"
          :aria-label="speechState.listening ? 'Stop listening' : 'Start mic'"
          :disabled="speechState.listening && busy"
          class="min-h-[44px] min-w-[44px] rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:hover:bg-white/15 dark:text-stone-300 disabled:opacity-50 transition-colors"
          @click="toggleSpeech"
        >
          <Mic v-if="!speechState.listening" class="size-5" />
          <Square v-else class="size-5" />
        </button>
        <div v-if="speechState.message" class="flex-1 text-xs text-stone-600 dark:text-stone-300">{{ speechState.message }}</div>
      </div>
      <textarea
        ref="box" v-model="draft" rows="3" maxlength="4000"
        class="mt-3 w-full rounded-2xl border border-stone-200 bg-stone-50 p-3 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
        placeholder="Say it or type it. I'll park it." @keydown.ctrl.enter="add" @keydown.meta.enter="add"
      />
      <p v-if="error" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ error }}</p>
      <div class="mt-3 flex gap-2">
        <button type="button" class="min-h-[44px] rounded-2xl bg-stone-100 px-4 text-sm dark:bg-white/10" @click="$emit('close')">Close</button>
        <button type="button" class="min-h-[44px] flex-1 rounded-2xl bg-[#E07A45] font-semibold text-white disabled:opacity-50" :disabled="!draft.trim() || busy" @click="add">{{ busy ? 'Adding…' : 'Add' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, onMounted, onUnmounted } from 'vue';
import { Mic, Square } from 'lucide-vue-next';
import { useGraphStore } from '~/stores/graph';
import { getRecognitionCtor, joinTranscript, messageFor, initialState, setListening, setMessage } from '~/lib/home/speech-input';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'said', msg: string): void }>();
const graph = useGraphStore();
const draft = ref('');
const error = ref('');
const busy = ref(false);
const box = ref<HTMLTextAreaElement | null>(null);
const speechSupported = ref(false);
const speechState = ref(initialState());

let recognition: any = null;
let baseSpeech = '';
let ignoreResults = false;

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
    baseSpeech = '';
    ignoreResults = false;
    speechState.value = initialState();
    await nextTick();
    box.value?.focus();
  } else {
    ignoreResults = true;
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
      recognition.stop();
    } else {
      baseSpeech = draft.value;
      recognition.start();
    }
  } catch {
    speechState.value = setMessage(speechState.value, messageFor('unknown'));
  }
}

async function add() {
  if (busy.value) return;
  ignoreResults = true;
  if (recognition && speechState.value.listening) {
    try { recognition.abort(); } catch { /* noop */ }
  }
  busy.value = true;
  const r = await graph.capture(draft.value);
  busy.value = false;
  if (!r.ok) { error.value = r.message; return; }
  draft.value = '';
  emit('close');
  emit('said', r.reply);
}
</script>
