<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <Button type="button" size="icon"
        :variant="state === 'recording' ? 'destructive' : state === 'transcribing' ? 'secondary' : 'outline'"
        :disabled="state === 'transcribing'"
        :class="cn(state === 'recording' && 'animate-pulse')"
        :aria-label="state === 'recording' ? 'Stop recording' : 'Start voice input'"
        @click="toggle">
        <Loader2 v-if="state === 'transcribing'" class="size-4 animate-spin" />
        <Square v-else-if="state === 'recording'" class="size-4" />
        <Mic v-else class="size-4" />
      </Button>
      <Input v-model="transcript" class="flex-1" aria-label="Task transcript"
        :placeholder="state === 'recording' ? 'Listening… speak your task' : state === 'transcribing' ? 'Transcribing audio…' : 'Tap the mic and speak, or type a task here'"
        @keydown="onKeydown" />
      <Button v-if="transcript" size="sm" @click="commit">Add</Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Toggle text mode" title="Text mode" @click="errorMsg = ''">
        <Keyboard class="size-4" />
      </Button>
    </div>

    <p v-if="state === 'recording'" class="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
      <span class="size-2 rounded-full bg-rose-500 animate-pulse" /> Recording — tap the square to stop and transcribe
    </p>
    <p v-else-if="state === 'transcribing'" class="text-xs text-muted-foreground flex items-center gap-1.5">
      <Loader2 class="size-3 animate-spin" /> Sending audio for transcription…
    </p>
    <p v-else-if="state === 'error' && errorMsg" class="text-xs text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
      <AlertCircle class="size-3 shrink-0 mt-0.5" /> <span>{{ errorMsg }}</span>
    </p>
    <p v-else-if="state === 'idle' && !transcript && !errorMsg" class="text-[11px] text-muted-foreground">
      Tip: say “Add design new poster to Incubator list” — we'll parse the title, category, and destination.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Mic, Square, Loader2, AlertCircle, Keyboard } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { cn } from '~/lib/utils';

const props = withDefaults(defineProps<{ autoStart?: boolean }>(), { autoStart: false });
const store = useAppStore();
const { toast } = useToast();

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'error';
const state = ref<VoiceState>('idle');
const transcript = ref('');
const errorMsg = ref('');

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;

function stopStream() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
}

async function startRecording() {
  errorMsg.value = '';
  transcript.value = '';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is not supported in this browser.');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      stopStream();
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
      if (blob.size === 0) { state.value = 'error'; errorMsg.value = 'No audio captured. Check your microphone and try again.'; return; }
      state.value = 'transcribing';
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < uint8.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + chunkSize)));
        }
        const base64 = btoa(binary);
        const r = await fetch('/api/voice/transcribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64, mimeType: mimeType || 'audio/webm' }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || 'Transcription failed');
        const text = (data?.text ?? '').trim();
        if (text) {
          transcript.value = text;
          state.value = 'idle';
          toast({ title: 'Transcribed', description: text.slice(0, 80) + (text.length > 80 ? '…' : '') });
        } else {
          state.value = 'error';
          errorMsg.value = 'Transcription returned empty text. Try speaking more clearly.';
        }
      } catch (err) {
        state.value = 'error';
        errorMsg.value = err instanceof Error ? err.message : 'Transcription failed';
      }
    };
    mediaRecorder.start();
    state.value = 'recording';
  } catch (e) {
    stopStream();
    state.value = 'error';
    const msg = e instanceof Error ? e.message : 'Could not access microphone';
    errorMsg.value = msg.includes('Permission') || msg.includes('denied')
      ? 'Microphone permission denied. Allow mic access in your browser settings, or type below.'
      : `Microphone unavailable: ${msg}. You can type your task below instead.`;
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

function toggle() {
  if (state.value === 'recording') { stopRecording(); return; }
  if (state.value === 'transcribing') return;
  void startRecording();
}

function onKeydown(e: KeyboardEvent) { if (e.key === 'Enter') void commit(); }

async function commit() {
  const text = transcript.value.trim();
  if (!text) return;
  const lower = text.toLowerCase();
  let status: 'backlog' | 'incubator' | 'today' = 'backlog';
  let category = 'Admin';
  let title = text;

  if (lower.includes('incubator') || lower.includes('someday')) {
    status = 'incubator';
    title = text.replace(/to (the )?incubator list/i, '').replace(/to incubator/i, '').replace(/incubator/i, '').trim();
  } else if (lower.includes('today')) {
    status = 'today';
    title = text.replace(/to today('?s)? list/i, '').replace(/to today/i, '').replace(/today/i, '').trim();
  } else {
    title = text.replace(/^add/i, '').trim();
  }

  if (/design|poster|creative|write|draft|sketch|paint/i.test(lower)) category = 'Creative';
  else if (/email|reply|admin|invoice|form|expense/i.test(lower)) category = 'Admin';
  else if (/fix|repair|clean|maintenance|chore|laundry/i.test(lower)) category = 'Maintenance';
  else if (/workout|run|exercise|walk|meditate|yoga/i.test(lower)) category = 'Health';
  else if (/study|learn|read|research|course|tutorial/i.test(lower)) category = 'Learning';
  else if (/call|meet|friend|family|coffee|dinner with/i.test(lower)) category = 'Social';

  if (!title) title = text;
  const t = await store.createTask({ title, status, category });
  if (t) toast({ title: 'Task captured', description: `"${t.title}" → ${status}` });
  transcript.value = '';
  errorMsg.value = '';
}

let autoTimer: ReturnType<typeof setTimeout> | null = null;
onMounted(() => {
  if (props.autoStart) autoTimer = setTimeout(() => void startRecording(), 300);
});
onUnmounted(() => {
  if (autoTimer) clearTimeout(autoTimer);
  stopStream();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') { try { mediaRecorder.stop(); } catch { /* noop */ } }
});
</script>
