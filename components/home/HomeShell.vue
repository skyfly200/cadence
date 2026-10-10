<template>
  <div class="relative mx-auto min-h-dvh w-full max-w-md bg-sage pb-32 text-slate-800 md:max-w-xl lg:flex lg:max-w-none lg:pb-0 dark:bg-dusk dark:text-slate-100">
    <!-- desktop rail: lenses, a capture box that is always there, and the menu -->
    <aside class="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-teal-900/5 px-5 py-6 lg:flex dark:border-white/5" aria-label="Cadence">
      <div class="flex items-center gap-3">
        <img src="/apple-touch-icon.png" alt="" class="size-10 shrink-0 rounded-xl" />
        <div>
          <p class="font-serif text-2xl font-semibold leading-tight">Cadence</p>
          <p class="text-[11px] font-semibold uppercase tracking-widest text-teal-700 dark:text-lavender">{{ dateLabel }}</p>
        </div>
      </div>
      <nav class="flex flex-col gap-1" aria-label="Lenses">
        <button v-for="l in [...LEFT, ...RIGHT]" :key="l.k" :aria-current="lens === l.k ? 'page' : undefined" :class="['flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium', lens === l.k ? 'bg-teal-100 text-teal-900 dark:bg-dusk-raised dark:text-peach' : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/5']" @click="lens = l.k">
          <component :is="l.i" class="size-5 shrink-0" aria-hidden="true" />{{ l.n }}
        </button>
      </nav>
      <form class="flex flex-col gap-2" @submit.prevent="railCapture">
        <label for="rail-capture" class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-lavender">Capture</label>
        <textarea
          id="rail-capture" v-model="railText" rows="3" maxlength="4000" placeholder="What's on your mind?"
          class="w-full rounded-2xl border border-stone-200 bg-white p-3 text-[15px] outline-none dark:border-white/10 dark:bg-dusk-card"
          @keydown.enter.exact.prevent="railCapture"
        />
        <p v-if="railError" class="text-sm text-amber-700 dark:text-amber-300">{{ railError }}</p>
        <div class="flex gap-2">
          <button type="submit" class="min-h-[44px] flex-1 rounded-2xl bg-ember font-semibold text-white disabled:opacity-50" :disabled="!railText.trim() || railBusy">Add</button>
          <button type="button" class="grid min-h-[44px] min-w-[44px] place-items-center rounded-2xl bg-white dark:bg-dusk-card" aria-label="Talk to capture" @click="openCapture(true)"><Mic class="size-5" /></button>
        </div>
      </form>
      <div class="mt-auto flex flex-col gap-1">
        <button class="min-h-[44px] rounded-xl px-3 text-left text-[15px] hover:bg-white/60 dark:hover:bg-white/5" @click="planningOpen = true">Planning session</button>
        <NuxtLink to="/deeper" class="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] hover:bg-white/60 dark:hover:bg-white/5">Go deeper</NuxtLink>
        <button class="min-h-[44px] rounded-xl px-3 text-left text-[15px] hover:bg-white/60 dark:hover:bg-white/5" @click="settingsOpen = true">Settings</button>
        <NuxtLink to="/privacy" class="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] hover:bg-white/60 dark:hover:bg-white/5">What Cadence knows and does</NuxtLink>
      </div>
    </aside>
    <div class="min-w-0 flex-1">
    <!-- header -->
    <header class="sticky top-0 z-20 border-b lg:static lg:mx-auto lg:w-full lg:max-w-6xl lg:border-0 lg:bg-transparent lg:px-6 lg:pb-0 lg:pt-4 lg:backdrop-blur-none dark:lg:border-0 dark:lg:bg-transparent border-teal-900/5 bg-sage/95 px-4 pb-2 pt-3 backdrop-blur dark:border-white/5 dark:bg-dusk/95">
      <div class="flex items-center gap-2 lg:hidden">
        <img src="/apple-touch-icon.png" alt="" class="size-9 shrink-0 rounded-lg" />
        <div class="min-w-0 flex-1">
          <p class="font-serif text-xl font-semibold leading-tight">Cadence</p>
          <p class="text-[11px] font-semibold uppercase tracking-widest text-teal-700 dark:text-lavender">{{ dateLabel }}</p>
        </div>
        <button class="grid size-11 shrink-0 place-items-center rounded-lg border border-teal-900/10 bg-white text-lg dark:border-white/10 dark:bg-dusk-card" aria-label="Menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><Menu class="size-5" /></button>
      </div>
      <p v-if="mounted" class="mt-1 truncate text-[15px] font-medium">{{ greeting(away) }}</p>
      <p v-if="eodLine" class="mt-1 text-[13px] text-teal-800 dark:text-peach">{{ eodLine }}</p>
      <div v-if="density >= 1" class="mt-2 flex flex-wrap items-center gap-2">
        <span v-if="graph.kept.length" class="text-[12px] font-semibold text-teal-800 dark:text-peach">{{ graph.kept.length }} accomplished today</span>
        <button
          v-if="graph.habitsPiece.total > 0"
          class="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600 dark:border-white/10 dark:bg-dusk-card dark:text-slate-300"
          @click="lens = 'habits'"
        >🌱 Habits · {{ graph.habitsPiece.done }} of {{ graph.habitsPiece.total }} today <span aria-hidden="true">›</span></button>
      </div>
    </header>

<!-- menu: more pages go here later -->
    <div v-if="menuOpen" class="fixed inset-0 z-40 lg:hidden" @click.self="menuOpen = false">
      <div class="mx-auto max-w-md px-4 pt-[4.25rem] md:max-w-xl">
        <ul class="ml-auto w-60 rounded-2xl bg-white p-2 shadow-lg dark:bg-dusk-card" role="menu">
          <li><button class="min-h-[44px] w-full rounded-xl px-3 text-left text-[15px] hover:bg-stone-100 dark:hover:bg-white/10" role="menuitem" @click="menuOpen = false; planningOpen = true">Planning session</button></li>
          <li><NuxtLink to="/deeper" class="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] hover:bg-stone-100 dark:hover:bg-white/10" role="menuitem">Go deeper</NuxtLink></li>
          <li><button class="min-h-[44px] w-full rounded-xl px-3 text-left text-[15px] hover:bg-stone-100 dark:hover:bg-white/10" role="menuitem" @click="menuOpen = false; settingsOpen = true">Settings</button></li>
          <li><NuxtLink to="/privacy" class="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] hover:bg-stone-100 dark:hover:bg-white/10" role="menuitem">What Cadence knows and does</NuxtLink></li>
        </ul>
      </div>
    </div>

    <main :class="['lg:mx-auto lg:w-full lg:pb-12 lg:pt-4', lens === 'plan' ? 'lg:max-w-6xl' : 'lg:max-w-2xl']">
    <HomeNow v-if="lens === 'now'" :density="density" @open-plan="lens = 'plan'" @said="say" @edit="onEdit" />
    <HomePlan v-else-if="lens === 'plan'" :density="density" @said="say" @edit="onEdit" @open-planning="planningOpen = true" />
    <HomeHabits v-else-if="lens === 'habits'" :density="density" @said="say" @edit="onEdit" @open-garden="gardenOpen = true" @capture="openCapture(false)" />
    <HomeGoals v-else :density="density" @said="say" @edit="onEdit" @open-garden="gardenOpen = true" @capture="openCapture(false)" />
    <!-- room to scroll the last controls clear of the toast -->
    <div v-if="toast || nudges.currentNudge.value" class="h-16 lg:hidden" aria-hidden="true" />
    </main>

    <!-- toast with Undo: one line, in the same slot as a nudge (a nudge waits until it clears) -->
    <div v-if="toast" class="fixed inset-x-0 bottom-28 z-40 lg:bottom-6 mx-auto flex w-fit max-w-[85%] items-center gap-3 rounded-full bg-slate-800 py-1 pl-4 pr-2 text-sm text-white shadow-lg dark:bg-white dark:text-dusk" role="status">
      <span class="line-clamp-2">{{ toast }}</span>
      <button v-if="graph.lastAction" class="min-h-[44px] shrink-0 px-2 font-semibold underline" @click="undo">Undo</button>
    </div>

    <!-- bottom bar: four lenses, capture in the middle -->
    <nav class="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md md:max-w-xl lg:hidden" aria-label="Lenses">
      <div class="relative mx-3 mb-3 flex items-end justify-between rounded-[1.75rem] bg-white px-3 pb-2 pt-2 shadow-[0_-4px_24px_rgba(20,60,60,0.15)] dark:bg-dusk-card">
        <button v-for="l in LEFT" :key="l.k" :class="tab(l.k)" @click="lens = l.k"><component :is="l.i" class="size-5" aria-hidden="true" />{{ l.n }}</button>
        <!-- capture: a tap opens the box with the keyboard up; holding it opens the mic -->
        <button
          class="-mt-8 grid size-16 select-none place-items-center rounded-full bg-ember text-white shadow-lg ring-4 ring-sage [-webkit-touch-callout:none] dark:ring-dusk"
          aria-label="Capture (hold to talk)" title="Tap to type, hold to talk"
          @pointerdown="captureDownAt = Date.now()" @contextmenu.prevent @click="onCaptureClick"
        ><Plus class="size-8" /></button>
        <button v-for="l in RIGHT" :key="l.k" :class="tab(l.k)" @click="lens = l.k"><component :is="l.i" class="size-5" aria-hidden="true" />{{ l.n }}</button>
      </div>
    </nav>

    </div>

    <HomePlanningSession :open="planningOpen" @close="planningOpen = false" @said="say" @edit="onEdit" @open-garden="planningOpen = false; gardenOpen = true" />
    <HomeWelcome :open="welcomeOpen" @close="closeWelcome" />
    <HomeGarden :open="gardenOpen" @close="gardenOpen = false" />
    <HomeCaptureSheet :open="captureOpen" :listen="captureListen" @close="captureOpen = false" @said="say" />
    <HomeEditSheet :open="editOpen" :node-id="editingNodeId" @close="editOpen = false" @deleted="say('Deleted.')" />
    <HomeSettingsSheet
      :open="settingsOpen" :density="density" :time-format="graph.timeFormat" :signed-in="app.signedIn" :nudge-state="nudges.state.value" :muted="nudges.state.value.muted"
      @close="settingsOpen = false" @update:density="setDensityValue" @update:time-format="setTimeFormatValue" @account="settingsOpen = false; authOpen = true" @welcome="settingsOpen = false; welcomeOpen = true"
      @toggle-kind="onToggleNudgeKind" @toggle-mute="onToggleNudgeMute" @restore-node="nudges.onRestoreNode" @restore-kind="nudges.onRestoreKind"
    />
    <NudgeToast
      :nudge="toast ? null : nudges.currentNudge.value" :disclosed="nudges.state.value.disclosed" :muted="nudges.state.value.muted"
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
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue';
import { CalendarDays, Menu, Mic, Mountain, Plus, Repeat, Sun } from 'lucide-vue-next';
import type { NudgeKind } from '~/lib/domain';
import { useAppStore } from '~/stores/app';
import { useGraphStore } from '~/stores/graph';
import { getDensity, getWelcomed, setWelcomed, getEndOfDayOn, getTimeFormat, greeting, markOpened, setDensity, setTimeFormat, wasAway, type Density } from '~/lib/home/prefs';
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
const gardenOpen = ref(false);
const authOpen = ref(false);
const welcomeOpen = ref(false);
function closeWelcome() { welcomeOpen.value = false; setWelcomed(true); }
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

const LEFT: { k: Lens; i: Component; n: string }[] = [{ k: 'now', i: Sun, n: 'Now' }, { k: 'plan', i: CalendarDays, n: 'Plan' }];
const RIGHT: { k: Lens; i: Component; n: string }[] = [{ k: 'habits', i: Repeat, n: 'Habits' }, { k: 'goals', i: Mountain, n: 'Goals' }];

/** Capture: a tap types (keyboard up), a hold of HOLD_MS or more talks. Decided on click, inside the tap, so the mic may start. */
const HOLD_MS = 450;
const captureDownAt = ref(0);
const captureListen = ref(false);
function openCapture(listen: boolean) {
  captureListen.value = listen;
  captureOpen.value = true;
}
function onCaptureClick() {
  const held = captureDownAt.value > 0 && Date.now() - captureDownAt.value >= HOLD_MS;
  captureDownAt.value = 0;
  openCapture(held);
}
const tab = (k: Lens) => [
  'flex min-h-[44px] w-16 flex-col items-center gap-0.5 rounded-2xl py-1 text-[11px] font-medium',
  lens.value === k ? 'bg-teal-100 text-teal-900 dark:bg-dusk-raised dark:text-peach' : 'text-slate-500 dark:text-slate-400',
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
  mounted.value = true;
  // Google sends the user back to "/" with ?gcal_connected=1 or ?gcal_error=...: say how it went (never a
  // token: those stay on the server), tidy the address bar, and open Settings, where the imports are.
  const back = new URLSearchParams(window.location.search);
  if (back.has('gcal_connected') || back.has('gcal_error')) {
    say(back.get('gcal_connected') === '1' ? 'Google is connected.' : 'Google could not connect just now. Please try again from Settings.');
    back.delete('gcal_connected');
    back.delete('gcal_error');
    const rest = back.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    settingsOpen.value = true;
  }
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
  // First run only: someone who already has entries has no need for the tour (it can be replayed from Settings).
  if (!getWelcomed()) { if (graph.nodes.length) setWelcomed(true); else welcomeOpen.value = true; }
  void app.initAuth(); // restores a signed-in session and starts the sync (which now covers the graph tables)
  window.addEventListener('cadence:hydrated', onHydrated);
});
onUnmounted(() => {
  window.removeEventListener('cadence:hydrated', onHydrated);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>
