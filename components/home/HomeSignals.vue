<template>
  <div v-if="open" class="fixed inset-0 z-[60] flex items-end bg-stone-900/30" @click.self="$emit('close')">
    <div class="mx-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-8 dark:bg-[#2A2645]" role="dialog" aria-label="Signals">
      <p class="font-serif text-xl">Signals</p>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
        For you, while you test whether Cadence helps. Worked out on this device from your own log; nothing leaves it. None of this is a score.
      </p>

      <!-- checkpoint -->
      <div v-if="due" class="mt-4 rounded-2xl bg-amber-50 p-4 dark:bg-white/10">
        <p class="font-serif text-lg">Week {{ due }} check-in</p>
        <p class="mt-1 text-sm">{{ weeksUsed }} of the last {{ series.length }} weeks had something kept; {{ thisWeek }} so far this week. Below is how each feature is doing. What works, what doesn't, and why?</p>
        <select v-model="cpMechanism" class="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-[16px] dark:border-white/10 dark:bg-[#1D1A2F]" aria-label="About which feature">
          <option value="">Overall</option>
          <option v-for="m in MECHANISMS" :key="m.key" :value="m.label">{{ m.label }}</option>
        </select>
        <textarea v-model="cpText" rows="3" class="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-[16px] dark:border-white/10 dark:bg-[#1D1A2F]" aria-label="What works and what doesn't" placeholder="A few words are plenty."></textarea>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <button class="min-h-[44px] rounded-xl bg-[#E07A45] text-sm font-semibold text-white disabled:opacity-40" :disabled="!cpText.trim() || cpBusy" @click="saveCheckpoint">Save to my Ideas</button>
          <button class="min-h-[44px] rounded-xl border border-slate-200 text-sm dark:border-white/10" @click="skipCheckpoint">Skip this one</button>
        </div>
        <p v-if="cpNote" class="mt-2 text-sm">{{ cpNote }}</p>
      </div>

      <!-- still in use -->
      <p class="mt-5 text-sm font-semibold">Still in use</p>
      <p class="mt-1 text-sm">{{ weeksUsed }} of the last {{ series.length }} weeks had at least one thing kept.</p>
      <p v-if="back" class="mt-1 text-sm">You came back after {{ back.gapDays }} days away, and picked it up again. That is the one that counts most.</p>

      <p class="mt-4 text-sm font-semibold">Things kept per week</p>
      <div class="mt-2 flex h-20 items-end gap-1.5" role="img" :aria-label="`Things kept in each of the last ${series.length} weeks`">
        <div v-for="w in series" :key="w.start.toISOString()" class="flex flex-1 flex-col items-center justify-end gap-1">
          <span class="text-[11px] text-slate-500 dark:text-slate-400">{{ w.kept }}</span>
          <div class="w-full rounded-t bg-teal-600/70 dark:bg-[#B9A6FF]/70" :style="{ height: `${Math.max(2, (w.kept / maxKept) * 48)}px` }"></div>
        </div>
      </div>
      <p class="mt-1 text-sm">{{ trendLine }}</p>

      <!-- supporting -->
      <p class="mt-4 text-sm font-semibold">Used only to tune reminders</p>
      <p class="mt-1 text-sm">{{ lapsed }} timed {{ lapsed === 1 ? 'item' : 'items' }} in the last four weeks passed without being marked.</p>
      <p class="mt-1 text-sm">{{ triageLine }}</p>

      <!-- feeling -->
      <p class="mt-4 text-sm font-semibold">How has this week felt?</p>
      <div class="mt-1.5 grid grid-cols-3 gap-2">
        <button
          v-for="f in FEELINGS" :key="f.value"
          :class="['min-h-[44px] rounded-xl border text-sm', feeling === f.value ? 'border-[#E07A45] bg-amber-50 font-semibold text-amber-900 dark:bg-white/10 dark:text-[#FFB59F]' : 'border-slate-200 dark:border-white/10']"
          @click="chooseFeeling(f.value)"
        >{{ f.label }}</button>
      </div>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">One tap, asked once a week, easy to skip.</p>

      <!-- nudge health -->
      <p class="mt-4 text-sm font-semibold">Reminders: shown, "Not now", "Stop these"</p>
      <div class="mt-1.5 space-y-1">
        <div v-for="h in health" :key="h.kind" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
          <span>{{ NUDGE_KIND_LABELS[h.kind] ?? h.kind }}</span>
          <span class="text-slate-600 dark:text-slate-300">{{ h.shown }} · {{ h.notNow }} · {{ h.stopped }}</span>
        </div>
      </div>

      <!-- mechanisms against the rule -->
      <p class="mt-4 text-sm font-semibold">Each feature against the rule of thumb</p>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Keep one that was on in at least half the weeks with no rise in "Stop these". Rework or cut one you switched off within two weeks. Your call, never automatic.</p>
      <div class="mt-1.5 space-y-1">
        <div v-for="r in rules" :key="r.m.key" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
          <span>{{ r.m.label }}</span>
          <span class="text-slate-600 dark:text-slate-300">{{ VERDICT_WORDS[r.verdict] }}</span>
        </div>
      </div>

      <!-- experiment -->
      <p class="mt-4 text-sm font-semibold">Experiment</p>
      <div v-if="experiment && result" class="mt-1.5 rounded-2xl bg-stone-100 p-3 text-sm dark:bg-white/10">
        <p>{{ mechanismByKey(experiment.key)?.label }} turned {{ experiment.turnedOn ? 'on' : 'off' }} {{ result.daysAfter }} {{ result.daysAfter === 1 ? 'day' : 'days' }} ago.</p>
        <p v-if="!result.ready" class="mt-1">Give it a week before reading anything into it.</p>
        <template v-else>
          <p class="mt-1">Kept per week: {{ result.keptPerWeekBefore }} before, {{ result.keptPerWeekAfter }} after.</p>
          <p>"Not now" per week: {{ result.notNowPerWeekBefore }} before, {{ result.notNowPerWeekAfter }} after.</p>
        </template>
        <button class="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 text-sm dark:border-white/10" @click="endExperiment">Done with this experiment</button>
      </div>
      <div v-else class="mt-1.5">
        <p class="text-sm text-slate-600 dark:text-slate-300">Turn one thing off or on for a week or two, then compare. Nothing changes unless you start it.</p>
        <select v-model="expKey" class="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-[16px] dark:border-white/10 dark:bg-[#1D1A2F]" aria-label="Feature to try">
          <option value="">Choose a feature</option>
          <option v-for="m in EXPERIMENTAL" :key="m.key" :value="m.key">{{ m.label }} (now {{ m.isOn!() ? 'on' : 'off' }})</option>
        </select>
        <button class="mt-2 min-h-[44px] w-full rounded-xl bg-stone-100 text-sm disabled:opacity-40 dark:bg-white/10" :disabled="!expKey" @click="startExperiment">Start the experiment</button>
      </div>

      <button class="mt-5 min-h-[44px] w-full rounded-2xl bg-stone-100 text-sm dark:bg-white/10" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  cameBackAfterBreak, checkpointDue, compareExperiment, firstUse, keptPerWeek, keptTrend, lapsedTimeCritical,
  mechanismVerdict, nudgeHealth, ruleFor, triageSpeed, weeksInUse, type Verdict,
} from '~/lib/domain/signals';
import { periodWindow } from '~/lib/domain/periods';
import { NUDGE_KINDS } from '~/lib/domain/nudges';
import {
  answeredCheckpoints, feelingFor, getEvents, getExperiment, markCheckpointAnswered, setExperiment, setFeeling, type Feeling,
} from '~/lib/home/signals-state';
import { EXPERIMENTAL, MECHANISMS, NUDGE_KIND_LABELS, mechanismByKey } from '~/lib/home/signals-mechanisms';
import { useGraphStore } from '~/stores/graph';

const props = defineProps<{ open: boolean }>();
defineEmits<{ (e: 'close'): void }>();

const graph = useGraphStore();
const tick = ref(0); // bumps after a local change so the device-stored values are read again
const now = computed(() => { void tick.value; return new Date(); });

const FEELINGS: { value: Feeling; label: string }[] = [
  { value: 'lighter', label: 'Lighter' },
  { value: 'same', label: 'About the same' },
  { value: 'heavier', label: 'Heavier' },
];
const VERDICT_WORDS: Record<Verdict, string> = {
  keep: 'Keep', rework: 'Rework or cut?', undecided: 'Not clear yet', too_early: 'Too early',
};

const events = computed(() => { void tick.value; return props.open ? getEvents() : []; });
const series = computed(() => keptPerWeek(graph.occurrences, now.value, 8));
const weeksUsed = computed(() => weeksInUse(series.value));
const thisWeek = computed(() => series.value[series.value.length - 1]?.kept ?? 0);
const maxKept = computed(() => Math.max(1, ...series.value.map((w) => w.kept)));
const back = computed(() => cameBackAfterBreak(graph.occurrences, now.value));
const trendLine = computed(() => {
  const t = keptTrend(series.value);
  return t === 'too_early' ? 'A trend shows up after about two months.'
    : t === 'up' ? 'A little more kept lately than before.'
    : t === 'down' ? 'A little less kept lately than before. That is information, not a verdict.'
    : 'About the same as before.';
});
const lapsed = computed(() => lapsedTimeCritical(graph.nodes, graph.occurrences, now.value));
const triageLine = computed(() => {
  const t = triageSpeed(graph.occurrences);
  if (t.medianHours === null) return t.waiting ? `${t.waiting} captured ${t.waiting === 1 ? 'thing is' : 'things are'} still waiting to be looked at.` : 'Nothing captured yet.';
  const h = t.medianHours < 1 ? 'under an hour' : t.medianHours < 48 ? `about ${Math.round(t.medianHours)} hours` : `about ${Math.round(t.medianHours / 24)} days`;
  return `Captured things usually get looked at in ${h}${t.waiting ? `; ${t.waiting} still waiting` : ''}.`;
});

const weekKey = computed(() => periodWindow('week', now.value).start.toISOString().slice(0, 10));
const feeling = ref<Feeling | null>(null);
const health = computed(() => nudgeHealth(events.value, NUDGE_KINDS));
const first = computed(() => firstUse(graph.nodes, graph.occurrences));
const rules = computed(() => MECHANISMS.map((m) => ({
  m, verdict: mechanismVerdict(ruleFor(events.value, m.key, m.defaultOn, first.value, now.value, m.nudgeKind)),
})));

// checkpoint
const due = ref<number | null>(null);
const cpText = ref('');
const cpMechanism = ref('');
const cpBusy = ref(false);
const cpNote = ref('');

// experiment
const experiment = ref(getExperiment());
const expKey = ref('');
const result = computed(() => (experiment.value ? compareExperiment(graph.occurrences, events.value, experiment.value, now.value) : null));

watch(() => props.open, (o) => {
  if (!o) return;
  tick.value++;
  feeling.value = feelingFor(weekKey.value);
  due.value = checkpointDue(first.value, new Date(), answeredCheckpoints());
  experiment.value = getExperiment();
  cpNote.value = '';
}, { immediate: true });

function chooseFeeling(v: Feeling): void { setFeeling(weekKey.value, v); feeling.value = v; }

async function saveCheckpoint(): Promise<void> {
  if (!due.value || !cpText.value.trim()) return;
  cpBusy.value = true;
  const about = cpMechanism.value ? ` (${cpMechanism.value})` : '';
  const r = await graph.capture(`Checkpoint, week ${due.value}${about}: ${cpText.value.trim()}`, { private: true });
  cpBusy.value = false;
  if (!r.ok) { cpNote.value = r.message; return; }
  markCheckpointAnswered(due.value);
  due.value = checkpointDue(first.value, new Date(), answeredCheckpoints());
  cpText.value = '';
  cpMechanism.value = '';
  cpNote.value = 'Saved to your Ideas.';
}
function skipCheckpoint(): void {
  if (!due.value) return;
  markCheckpointAnswered(due.value);
  due.value = checkpointDue(first.value, new Date(), answeredCheckpoints());
}

function startExperiment(): void {
  const m = mechanismByKey(expKey.value);
  if (!m?.isOn || !m.set) return;
  const turnOn = !m.isOn();
  m.set(turnOn); // records the switch in the history, like a change made in Settings
  const e = { key: m.key, startedAt: new Date().toISOString(), turnedOn: turnOn };
  setExperiment(e);
  experiment.value = e;
  expKey.value = '';
  tick.value++;
}
function endExperiment(): void { setExperiment(null); experiment.value = null; }
</script>
