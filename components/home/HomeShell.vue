<template>
  <div class="relative mx-auto min-h-dvh w-full max-w-md bg-[#EEF5F3] pb-32 text-slate-800 md:max-w-xl lg:flex lg:max-w-none lg:pb-0 dark:bg-[#1D1A2F] dark:text-slate-100">
    <!-- desktop rail: lenses, a capture box that is always there, and the menu -->
    <aside class="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-teal-900/5 px-5 py-6 lg:flex dark:border-white/5" aria-label="Cadence">
      <div class="flex items-center gap-3">
        <img src="/apple-touch-icon.png" alt="" class="size-10 shrink-0 rounded-xl" />
        <div>
          <p class="font-serif text-2xl font-semibold leading-tight">Cadence</p>
          <p class="text-[11px] font-semibold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">{{ dateLabel }}</p>
        </div>
      </div>
      <nav class="flex flex-col gap-1" aria-label="Lenses">
        <button v-for="l in [...LEFT, ...RIGHT]" :key="l.k" :aria-current="lens === l.k ? 'page' : undefined" :class="['flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium', lens === l.k ? 'bg-teal-100 text-teal-900 dark:bg-[#3A3560] dark:text-[#FFB59F]' : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/5']" @click="lens = l.k">
          <span class="w-5 text-center text-lg">{{ l.i }}</span>{{ l.n }}
        </button>
      </nav>
      <form class="flex flex-col gap-2" @submit.prevent="railCapture">
        <label for="rail-capture" class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">Capture</label>
        <textarea
          id="rail-capture" v-model="railText" rows="3" maxlength="4000" placeholder="What's on your mind?"
          class="w-full rounded-2xl border border-stone-200 bg-white p-3 text-[15px] outline-none dark:border-white/10 dark:bg-[#2A2645]"
          @keydown.enter.exact.prevent="railCapture"
        />
        <p v-if="railError" class="text-sm text-amber-700 dark:text-amber-300">{{ railError }}</p>
        <div class="flex gap-2">
          <button type="submit" class="min-h-[44px] flex-1 rounded-2xl bg-[#E07A45] font-semibold text-white disabled:opacity-50" :disabled="!railText.trim() || railBusy">Add</button>
          <button type="button" class="grid min-h-[44px] min-w-[44px] place-items-center rounded-2xl bg-white text-xl dark:bg-[#2A2645]" aria-label="Talk to capture" @click="captureOpen = true">🎤</button>
        </div>
      </form>
      <div class="mt-auto flex flex-col gap-1">
        <button class="min-h-[44px] rounded-xl px-3 text-left text-[15px] hover:bg-white/60 dark:hover:bg-white/5" @click="planningOpen = true">Planning session</button>
        <button class="min-h-[44px] rounded-xl px-3 text-left text-[15px] hover:bg-white/60 dark:hover:bg-white/5" @click="settingsOpen = true">Settings</button>
        <NuxtLink to="/privacy" class="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] hover:bg-white/60 dark:hover:bg-white/5">What Cadence knows and does</NuxtLink>
        <NuxtLink to="/classic" class="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] hover:bg-white/60 dark:hover:bg-white/5">Classic view</NuxtLink>
      </div>
    </aside>
    <div class="min-w-0 flex-1">
    <!-- header -->
    <header class="sticky top-0 z-20 border-b lg:static lg:mx-auto lg:w-full lg:max-w-6xl lg:border-0 lg:bg-transparent lg:px-6 lg:pb-0 lg:pt-4 lg:backdrop-blur-none dark:lg:border-0 dark:lg:bg-transparent border-teal-900/5 bg-[#EEF5F3]/95 px-4 pb-2 pt-3 backdrop-blur dark:border-white/5 dark:bg-[#1D1A2F]/95">
      <div class="flex items-center gap-2 lg:hidden">
        <img src="/apple-touch-icon.png" alt="" class="size-9 shrink-0 rounded-lg" />
        <div class="min-w-0 flex-1">
          <p class="font-serif text-xl font-semibold leading-tight">Cadence</p>
          <p class="text-[11px] font-semibold uppercase tracking-widest text-teal-700 dark:text-[#B9A6FF]">{{ dateLabel }}</p>
        </div>
        <button class="grid size-11 shrink-0 place-items-center rounded-lg border border-teal-900/10 bg-white text-lg dark:border-white/10 dark:bg-[#2A2645]" aria-label="Menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">☰</button>
      </div>
      <p v-if="mounted" class="mt-1 truncate text-[15px] font-medium">{{ greeting(away) }}</p>
      <p v-if="eodLine" class="mt-1 text-[13px] text-teal-800 dark:text-[#FFB59F]">{{ eodLine }}</p>
      <div v-if="density >= 1" class="mt-2 flex flex-wrap items-center gap-2">
        <span v-if="graph.kept.length" class="text-[12px] font-semibold text-teal-800 dark:text-[#FFB59F]">{{ graph.kept.length }} accomplished today</span>
        <button
          v-if="graph.habitsPiece.total > 0"
          class="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600 dark:border-white/10 dark:bg-[#2A2645] dark:text-slate-300"
          @click="lens = 'habits'"
        >🌱 Habits · {{ graph.habitsPiece.done }} of {{ graph.habitsPiece.total }} today <span aria-hidden="true">›</span></button>
      </div>
    </header>

<!-- menu: more pages go here later -->
    <div v-if="menuOpen" class="fixed inset-0 z-40 lg:hidden" @click.self="menuOpen = false">
      <div class="mx-auto max-w-md px-4 pt-[4.25rem] md:max-w-xl">
        <ul class="ml-auto w-60 rounded-2xl bg-white p-2 shadow-lg dark:bg-[#2A2645]" role="menu">
          <li><button class="min-h-[44px] w-full rounded-xl px-3 text-left text-[15px] hover:bg-stone-100 dark:hover:bg-white/10" role="menuitem" @click="menuOpen = false; planningOpen = true">Planning session</button></li>
          <li><button class="min-h-[44px] w-full rounded-xl px-3 text-left text-[15px] hover:bg-stone-100 dark:hover:bg-white/10" role="menuitem" @click="menuOpen = false; settingsOpen = true">Settings</button></li>
          <li><NuxtLink to="/privacy" class="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] hover:bg-stone-100 dark:hover:bg-white/10" role="menuitem">What Cadence knows and does</NuxtLink></li>
          <li><NuxtLink to="/classic" class="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] hover:bg-stone-100 dark:hover:bg-white/10" role="menuitem">Classic view</NuxtLink></li>
        </ul>
      </div>
    </div>

    <main :class="['lg:mx-auto lg:w-full lg:pb-12 lg:pt-4', lens === 'plan' ? 'lg:max-w-6xl' : 'lg:max-w-2xl']">
    <HomeNow v-if="lens === 'now'" :density="density" @open-plan="lens = 'plan'" @said="say" @edit="onEdit" />
    <HomePlan v-else-if="lens === 'plan'" @said="say" @edit="onEdit" @open-planning="planningOpen = true" />
    <HomeHabits v-else-if="lens === 'habits'" @said="say" @edit="onEdit" />
    <HomeGoals v-else @said="say" />
    </main>

    <!-- toast with Undo -->
    <div v-if="toast" class="fixed inset-x-0 bottom-28 z-40 lg:bottom-6 mx-auto flex w-fit max-w-[85%] items-center gap-3 rounded-full bg-slate-800 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-[#1D1A2F]" role="status">
      <span>{{ toast }}</span>
      <button v-if="graph.lastAction" class="min-h-[32px] font-semibold underline" @click="undo">Undo</button>
    </div>

    <!-- bottom bar: four lenses, capture in the middle -->
    <nav class="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md md:max-w-xl lg:hidden" aria-label="Lenses">
      <div class="relative mx-3 mb-3 flex items-end justify-between rounded-[1.75rem] bg-white px-3 pb-2 pt-2 shadow-[0_-4px_24px_rgba(20,60,60,0.15)] dark:bg-[#2A2645]">
        <button v-for="l in LEFT" :key="l.k" :class="tab(l.k)" @click="lens = l.k"><span class="text-xl">{{ l.i }}</span>{{ l.n }}</button>
        <button class="-mt-8 grid size-16 place-items-center rounded-full bg-[#E07A45] text-3xl text-white shadow-lg ring-4 ring-[#EEF5F3] dark:ring-[#1D1A2F]" aria-label="Talk to capture" @click="captureOpen = true">🎤</button>
        <button v-for="l in RIGHT" :key="l.k" :class="tab(l.k)" @click="lens = l.k"><span class="text-xl">{{ l.i }}</span>{{ l.n }}</button>
      </div>
    </nav>

    </div>

    <HomePlanningSession :open="planningOpen" @close="planningOpen = false" @said="say" @edit="onEdit" />
    <HomeCaptureSheet :open="captureOpen" listen @close="captureOpen = false" @said="say" />
    <HomeEditSheet :open="editOpen" :node-id="editingNodeId" @close="editOpen = false" @deleted="say('Deleted.')" />
    <HomeSettingsSheet
      :open="settingsOpen" :density="density" :time-format="graph.timeFormat" :signed-in="app.signedIn" :nudge-state="nudges.state.value" :muted="nudges.state.value.muted"
      @close="settingsOpen = false" @update:density="setDensityValue" @update:time-format="setTimeFormatValue" @account="settingsOpen = false; authOpen = true"
      @toggle-kind="onToggleNudgeKind" @toggle-mute="onToggleNudgeMute" @restore-node="nudges.onRestoreNode" @restore-kind="nudges.onRestoreKind"
    />
    <NudgeToast
      :nudge="nudges.currentNudge.value" :disclosed="nudges.state.value.disclosed" :muted="nudges.state.value.muted"
      @not-now="nudges.onNotNow(nudges.currentNudge.value!); nudges.currentNudge.value = null"
      @stop-node="nudges.onStopNode(nudges.currentNudge.value!.nodeId!); nudges.currentNudge.value = null"
      @stop-kind="nudges.onStopKind(nudges.currentNudge.value!.kind); nudges.currentNudge.value = null"
      @toggle-mute="nudges.onToggleMute(!nudges.state.value.muted)"
    />
    <Dialog :open="authOpen" content-class="sm:max-w-sm" @update:open="authOpen = $event">
      <AuthDialog @done="authOpen = false" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { NudgeKind } from '~/lib/domain';
import { useAppStore } from '~/stores/app';
import { useGraphStore } from '~/stores/graph';
import { getDensity, getEndOfDayOn, getTimeFormat, greeting, markOpened, setDensity, setTimeFormat, wasAway, type Density } from '~/lib/home/prefs';
import { endOfDayLine } from '~/lib/home/rewards';
import type { TimeFormat } from '~/lib/domain';
import { useNudges } from '~/composables/useNudges';
import { useNudgeUrlAction } from '~/composables/useNudgeUrlAction';

type Lens = 'now' | 'plan' | 'habits' | 'goals';

const app = useAppStore();
const graph = useGraphStore();
useNudgeUrlAction();
const nudges = useNudges();
const lens = ref<Lens>('now');
const density = ref<Density>(1);
const away = ref(false);
const captureOpen = ref(false);
const menuOpen = ref(false);
const editOpen = ref(false);
const editingNodeId = ref<string | null>(null);
const settingsOpen = ref(false);
const planningOpen = ref(false);
const authOpen = ref(false);
const railText = ref('');
const railBusy = ref(false);
const railError = ref('');
async function railCapture() {
  if (railBusy.value || !railText.value.trim()) return;
  railBusy.value = true;
  railError.value = '';
  const r = await graph.capture(railText.value);
  railBusy.value = false;
  if (!r.ok) { railError.value = r.message; return; }
  railText.value = '';
  say(r.reply);
}
const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function onEdit(nodeId: string) {
  editingNodeId.value = nodeId;
  editOpen.value = true;
}

const LEFT: { k: Lens; i: string; n: string }[] = [{ k: 'now', i: '◉', n: 'Now' }, { k: 'plan', i: '▤', n: 'Plan' }];
const RIGHT: { k: Lens; i: string; n: string }[] = [{ k: 'habits', i: '↻', n: 'Habits' }, { k: 'goals', i: '△', n: 'Goals' }];
const tab = (k: Lens) => [
  'flex min-h-[44px] w-16 flex-col items-center gap-0.5 rounded-2xl py-1 text-[11px] font-medium',
  lens.value === k ? 'bg-teal-100 text-teal-900 dark:bg-[#3A3560] dark:text-[#FFB59F]' : 'text-slate-500 dark:text-slate-400',
];

// Client-only: the server's date and locale differ from the browser's, which would cause a hydration mismatch.
const mounted = ref(false);
// The opt-in end-of-day line ("Today you kept 5 things"); re-read when Settings closes, where it is switched on.
const eodOn = ref(false);
watch(settingsOpen, (open) => { if (!open) eodOn.value = getEndOfDayOn(); });
const eodLine = computed(() => (mounted.value ? endOfDayLine({
  on: eodOn.value, occurrences: graph.occurrences, now: graph.asOf, habitsDone: graph.habitsPiece.done, habitsTotal: graph.habitsPiece.total,
}) : null));
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
function setTimeFormatValue(f: TimeFormat) { graph.timeFormat = f; setTimeFormat(f); }

function onToggleNudgeKind(kind: NudgeKind, enabled: boolean): void {
  if (enabled) {
    nudges.onRestoreKind(kind);
  } else {
    nudges.onStopKind(kind);
  }
}

const onHydrated = () => graph.load();

onMounted(() => {
  // Google sends the user back to "/" with ?gcal_connected / ?gcal_error. Calendar settings live in the
  // classic view until they are rebuilt, so hand those redirects over with their query intact.
  if (window.location.search.includes('gcal_')) {
    void navigateTo(`/classic${window.location.search}`, { replace: true });
    return;
  }
  mounted.value = true;
  // Tapping the weekly Planning notification lands here with ?open=planning (see consumeNudgeUrl).
  const params = new URLSearchParams(window.location.search);
  if (params.get('open') === 'planning') {
    planningOpen.value = true;
    params.delete('open');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  }
  eodOn.value = getEndOfDayOn();
  density.value = getDensity();
  graph.timeFormat = getTimeFormat();
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
