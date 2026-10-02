<template>
  <section class="px-4 pt-4">
    <button v-if="density >= 1 && graph.kept.length" class="mb-1 ml-8 text-xs font-medium text-slate-500 dark:text-slate-400" @click="showPast = !showPast">
      {{ showPast ? 'Hide' : `Accomplished earlier ✓ ${graph.kept.length}` }}
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
            <div class="mt-1 flex items-center justify-center gap-2">
              <h1 class="break-words text-center font-serif text-[1.7rem] leading-tight">{{ current.node.title }}</h1>
              <button
                v-if="current.node.kind !== 'habit'"
                class="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 whitespace-nowrap"
                @click="$emit('edit', current.node.id)"
              >
                Edit
              </button>
            </div>
            <p v-if="density >= 1 && graph.rank.reason" class="mt-2 text-center text-[15px] text-stone-600 dark:text-slate-300">{{ graph.rank.reason }}</p>
            <p v-if="density >= 2 && graph.rank.chain.length" class="mt-1 text-center text-xs text-stone-500 dark:text-slate-400">{{ graph.rank.chain.join(' · ') }}</p>

            <div v-if="graph.rank.offerShrinkParkKeep && !keepDismissed" class="mt-4 rounded-2xl bg-amber-50 p-3 text-center text-sm dark:bg-white/10">
              <p>This has moved a few times. Send it to the heap, or keep it?</p>
              <div class="mt-2 flex justify-center gap-2">
                <button class="min-h-[44px] rounded-xl bg-white px-4 font-medium dark:bg-[#1D1A2F]" @click="onPark">To the heap</button>
                <button class="min-h-[44px] rounded-xl bg-white px-4 font-medium dark:bg-[#1D1A2F]" @click="keepDismissed = true">Keep it</button>
              </div>
            </div>

            <div v-if="!started && !stayWithMeActive" class="mt-5 grid grid-cols-3 gap-2">
              <button class="col-span-3 min-h-[44px] rounded-2xl bg-[#E07A45] py-3.5 text-base font-semibold text-white shadow-sm active:scale-[.99]" @click="onStart">Start</button>
              <button class="col-span-2 min-h-[44px] rounded-2xl bg-stone-100 py-3 text-sm font-medium dark:bg-white/10" @click="onNotNow">Not now</button>
              <button class="min-h-[44px] rounded-2xl bg-stone-100 py-3 text-sm font-medium dark:bg-white/10" @click="onPark">To the heap</button>
            </div>

            <div v-if="!started && !stayWithMeActive" class="mt-3 flex justify-center">
              <button class="text-sm font-medium text-slate-500 underline dark:text-slate-400" @click="showStayOptions = !showStayOptions">
                Stay with me
              </button>
            </div>

            <div v-if="!started && showStayOptions" class="mt-4 rounded-2xl bg-stone-50 p-4 dark:bg-white/10">
              <p class="text-sm font-medium text-slate-700 dark:text-slate-200">How long?</p>
              <div class="mt-2 grid grid-cols-3 gap-2">
                <button
                  v-for="dur in [15, 25, 45]"
                  :key="dur"
                  class="min-h-[44px] rounded-xl bg-white py-2 text-sm font-medium dark:bg-[#1D1A2F]"
                  @click="startStayWithMe(dur)"
                >
                  {{ dur }}m
                </button>
              </div>
            </div>

            <div v-if="stayWithMeActive && stayWithMeState" class="mt-4 rounded-2xl bg-stone-50 p-4 dark:bg-white/10">
              <p class="text-center text-sm text-slate-700 dark:text-slate-200">{{ stayWithMeStatus }}</p>
              <div class="mt-3 flex justify-center">
                <button class="min-h-[44px] rounded-xl bg-white px-4 text-sm font-medium dark:bg-[#1D1A2F]" @click="endStayWithMe">
                  End
                </button>
              </div>
            </div>

            <button v-if="started && !stayWithMeActive" class="mt-5 min-h-[44px] w-full rounded-2xl bg-emerald-500 py-3.5 text-base font-semibold text-white" @click="onDone">Done ✓</button>
          </template>

          <template v-else>
            <h1 class="mt-2 text-center font-serif text-2xl">{{ graph.heap.length ? 'Nothing is queued for now' : 'You’re clear for now' }} 🌤</h1>
            <p class="mt-2 text-center text-stone-600 dark:text-slate-300">
              {{ graph.heap.length ? 'Open Plan and put something from the heap on your stack.' : 'Nothing needs you. Capture anything that pops up with the + button.' }}
            </p>
            <button v-if="graph.heap.length" class="mx-auto mt-4 block min-h-[44px] rounded-2xl bg-[#E07A45] px-5 text-sm font-semibold text-white" @click="$emit('open-plan')">Open Plan</button>
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

    <button v-if="density >= 1" class="ml-8 mt-3 min-h-[44px] text-xs font-medium text-teal-700 underline dark:text-[#B9A6FF]" @click="$emit('open-plan')">The heap</button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useGraphStore } from '~/stores/graph';
import type { Commitment, Habit } from '~/lib/domain';
import { getVolume, speechVolume, toneGain, type Density } from '~/lib/home/prefs';
import {
  start as startStayWithMeSession,
  checkInDue,
  markCheckedIn,
  isEnded,
  statusLine,
  PRESENCE_CUE_TEXT,
  CHECK_IN_TEXT,
  END_TEXT,
  type StayWithMeState,
} from '~/lib/home/stay-with-me';

defineProps<{ density: Density }>();
const emit = defineEmits<{ (e: 'open-plan'): void; (e: 'said', msg: string): void; (e: 'edit', nodeId: string): void }>();

const graph = useGraphStore();
const showPast = ref(false);
const keepDismissed = ref(false);
const showStayOptions = ref(false);
const stayWithMeActive = ref(false);
const stayWithMeState = ref<StayWithMeState | null>(null);
const stayWithMeStatus = ref('');
const stayWithMeInteracted = ref(false);
let stayWithMeTimer: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;

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
  emit('said', `Nice. ${graph.kept.length} accomplished today.`);
}
function onNotNow() { if (current.value) { graph.notNow(current.value.node.id); emit('said', 'Moved to later today.'); } }
function onPark() { if (current.value) { graph.park(current.value.node.id); emit('said', 'Sent to the heap.'); } }

function startStayWithMe(minutes: number) {
  stayWithMeInteracted.value = true;
  const now = Date.now();
  stayWithMeState.value = startStayWithMeSession(now, minutes * 60 * 1000);
  stayWithMeActive.value = true;
  showStayOptions.value = false;

  // Try to get mute state from nudge-state (using localStorage directly as fallback)
  const muted = typeof window !== 'undefined' ? (window.localStorage?.getItem('cadence:nudgeMuted') === 'true') : false;

  // Play presence cue (tone + speech)
  if (!muted) {
    playPresenceCue();
  }

  // Record a 'started' occurrence on the current item if it exists
  if (current.value) {
    graph.start(current.value.node.id);
  }

  // Start the interval ticker
  startStayWithMeTicker();
}

function endStayWithMe() {
  stayWithMeActive.value = false;
  stayWithMeState.value = null;
  if (stayWithMeTimer) {
    clearInterval(stayWithMeTimer);
    stayWithMeTimer = null;
  }
  if (audioContext) {
    try {
      audioContext.close();
    } catch {
      /* ignore */
    }
    audioContext = null;
  }
}

function playPresenceCue() {
  try {
    if (!audioContext) {
      const Ctor = typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext);
      if (Ctor) audioContext = new Ctor();
    }
    if (audioContext) {
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.frequency.value = 600;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(toneGain(getVolume()), now + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    /* ignore audio errors */
  }

  // Speak the presence cue
  if ('speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(PRESENCE_CUE_TEXT);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = speechVolume(getVolume());
      window.speechSynthesis.speak(utterance);
    } catch {
      /* ignore speech errors */
    }
  }
}

function startStayWithMeTicker() {
  if (stayWithMeTimer) clearInterval(stayWithMeTimer);
  stayWithMeTimer = setInterval(() => {
    if (!stayWithMeState.value || !stayWithMeActive.value) {
      if (stayWithMeTimer) {
        clearInterval(stayWithMeTimer);
        stayWithMeTimer = null;
      }
      return;
    }

    const now = Date.now();
    const muted = typeof window !== 'undefined' ? (window.localStorage?.getItem('cadence:nudgeMuted') === 'true') : false;

    // Check if check-in is due
    if (checkInDue(stayWithMeState.value, now) && stayWithMeInteracted.value && !muted) {
      stayWithMeState.value = markCheckedIn(stayWithMeState.value);
      // Play tone + speak check-in
      playCheckInCue();
    }

    // Check if session has ended
    if (isEnded(stayWithMeState.value, now)) {
      stayWithMeActive.value = false;
      if (stayWithMeInteracted.value && !muted) {
        // Speak end message
        if ('speechSynthesis' in window) {
          try {
            const utterance = new SpeechSynthesisUtterance(END_TEXT);
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = speechVolume(getVolume());
            window.speechSynthesis.speak(utterance);
          } catch {
            /* ignore */
          }
        }
      }
      if (stayWithMeTimer) {
        clearInterval(stayWithMeTimer);
        stayWithMeTimer = null;
      }
      if (audioContext) {
        try {
          audioContext.close();
        } catch {
          /* ignore */
        }
        audioContext = null;
      }
      return;
    }

    // Update status line
    stayWithMeStatus.value = statusLine(stayWithMeState.value, now);
  }, 1000);
}

function playCheckInCue() {
  try {
    if (!audioContext) {
      const Ctor = typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext);
      if (Ctor) audioContext = new Ctor();
    }
    if (audioContext) {
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.frequency.value = 650;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(toneGain(getVolume()), now + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    /* ignore audio errors */
  }

  // Speak the check-in cue
  if ('speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(CHECK_IN_TEXT);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = speechVolume(getVolume());
      window.speechSynthesis.speak(utterance);
    } catch {
      /* ignore speech errors */
    }
  }
}

onBeforeUnmount(() => {
  if (stayWithMeTimer) {
    clearInterval(stayWithMeTimer);
    stayWithMeTimer = null;
  }
  if (audioContext) {
    try {
      audioContext.close();
    } catch {
      /* ignore */
    }
  }
});
</script>
