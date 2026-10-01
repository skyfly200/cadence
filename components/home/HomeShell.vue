<template>
  <div class="relative mx-auto min-h-dvh w-full max-w-md bg-[#EEF5F3] pb-32 text-slate-800 md:max-w-xl dark:bg-[#1D1A2F] dark:text-slate-100">
    <!-- header -->
    <header class="sticky top-0 z-20 border-b border-teal-900/5 bg-[#EEF5F3]/95 px-4 pb-2 pt-3 backdrop-blur dark:border-white/5 dark:bg-[#1D1A2F]/95">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">{{ dateLabel }}</p>
          <p class="truncate text-[15px] font-medium">{{ away ? 'Welcome back. Nothing is on fire.' : 'Here is your day.' }}</p>
        </div>
        <button class="grid size-11 shrink-0 place-items-center rounded-lg border border-teal-900/10 bg-white text-base dark:border-white/10 dark:bg-[#2A2645]" aria-label="Display and account" @click="settingsOpen = true">⚙</button>
      </div>
      <div v-if="density >= 1" class="mt-2 flex flex-wrap items-center gap-2">
        <span v-if="graph.kept.length" class="text-[12px] font-semibold text-teal-800 dark:text-[#FFB59F]">{{ graph.kept.length }} kept today</span>
        <button
          v-if="graph.habitsPiece.total > 0"
          class="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600 dark:border-white/10 dark:bg-[#2A2645] dark:text-slate-300"
          @click="lens = 'habits'"
        >🌱 Habits · {{ graph.habitsPiece.done }} of {{ graph.habitsPiece.total }} today <span aria-hidden="true">›</span></button>
      </div>
    </header>

    <HomeNow v-if="lens === 'now'" :density="density" @open-parked="parkedOpen = true" @said="say" />
    <HomeToday v-else-if="lens === 'today'" :density="density" />
    <HomeHabits v-else-if="lens === 'habits'" @said="say" />
    <HomeGoals v-else />

    <!-- toast with Undo -->
    <div v-if="toast" class="fixed inset-x-0 bottom-28 z-40 mx-auto flex w-fit max-w-[85%] items-center gap-3 rounded-full bg-slate-800 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-[#1D1A2F]" role="status">
      <span>{{ toast }}</span>
      <button v-if="graph.lastAction" class="min-h-[32px] font-semibold underline" @click="undo">Undo</button>
    </div>

    <!-- bottom bar: four lenses, capture in the middle -->
    <nav class="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md md:max-w-xl" aria-label="Lenses">
      <div class="relative mx-3 mb-3 flex items-end justify-between rounded-[1.75rem] bg-white px-3 pb-2 pt-2 shadow-[0_-4px_24px_rgba(20,60,60,0.15)] dark:bg-[#2A2645]">
        <button v-for="l in LEFT" :key="l.k" :class="tab(l.k)" @click="lens = l.k"><span class="text-xl">{{ l.i }}</span>{{ l.n }}</button>
        <button class="-mt-8 grid size-16 place-items-center rounded-full bg-[#E07A45] text-3xl text-white shadow-lg ring-4 ring-[#EEF5F3] dark:ring-[#1D1A2F]" aria-label="Capture" @click="captureOpen = true">＋</button>
        <button v-for="l in RIGHT" :key="l.k" :class="tab(l.k)" @click="lens = l.k"><span class="text-xl">{{ l.i }}</span>{{ l.n }}</button>
      </div>
    </nav>

    <HomeCaptureSheet :open="captureOpen" @close="captureOpen = false" @said="say" />
    <HomeParkedSheet :open="parkedOpen" @close="parkedOpen = false" @said="say" />
    <HomeSettingsSheet
      :open="settingsOpen" :density="density" :signed-in="app.signedIn"
      @close="settingsOpen = false" @update:density="setDensityValue" @account="settingsOpen = false; authOpen = true"
    />
    <Dialog :open="authOpen" content-class="sm:max-w-sm" @update:open="authOpen = $event">
      <AuthDialog @done="authOpen = false" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useAppStore } from '~/stores/app';
import { useGraphStore } from '~/stores/graph';
import { getDensity, markOpened, setDensity, wasAway, type Density } from '~/lib/home/prefs';

type Lens = 'now' | 'today' | 'habits' | 'goals';

const app = useAppStore();
const graph = useGraphStore();
const lens = ref<Lens>('now');
const density = ref<Density>(1);
const away = ref(false);
const captureOpen = ref(false);
const parkedOpen = ref(false);
const settingsOpen = ref(false);
const authOpen = ref(false);
const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const LEFT: { k: Lens; i: string; n: string }[] = [{ k: 'now', i: '◉', n: 'Now' }, { k: 'today', i: '▤', n: 'Today' }];
const RIGHT: { k: Lens; i: string; n: string }[] = [{ k: 'habits', i: '↻', n: 'Habits' }, { k: 'goals', i: '△', n: 'Goals' }];
const tab = (k: Lens) => [
  'flex min-h-[44px] w-16 flex-col items-center gap-0.5 rounded-2xl py-1 text-[11px] font-medium',
  lens.value === k ? 'bg-teal-100 text-teal-900 dark:bg-[#3A3560] dark:text-[#FFB59F]' : 'text-slate-500 dark:text-slate-400',
];

// Client-only: the server's date and locale differ from the browser's, which would cause a hydration mismatch.
const mounted = ref(false);
const dateLabel = computed(() => (mounted.value ? graph.asOf.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : ''));

function say(msg: string) {
  toast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 5000);
}
function undo() {
  const label = graph.undoLast();
  say(label ? `${label} undone.` : 'Nothing to undo.');
}
function setDensityValue(d: Density) { density.value = d; graph.density = d; setDensity(d); }

const onHydrated = () => graph.load();

onMounted(() => {
  // Google sends the user back to "/" with ?gcal_connected / ?gcal_error. Calendar settings live in the
  // classic view until they are rebuilt, so hand those redirects over with their query intact.
  if (window.location.search.includes('gcal_')) {
    void navigateTo(`/classic${window.location.search}`, { replace: true });
    return;
  }
  mounted.value = true;
  density.value = getDensity();
  graph.density = density.value;
  away.value = wasAway();
  markOpened();
  graph.load();
  void app.initAuth(); // restores a signed-in session and starts the sync (which now covers the graph tables)
  window.addEventListener('cadence:hydrated', onHydrated);
});
onUnmounted(() => {
  window.removeEventListener('cadence:hydrated', onHydrated);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>
