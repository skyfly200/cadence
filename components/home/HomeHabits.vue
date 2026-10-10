<template>
  <section class="px-4 pt-4">
    <h1 class="text-xl font-semibold">Habits</h1>
    <GardenStrip @open="emit('open-garden')" />

    <p v-if="nearEnd.length" class="mt-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-stone-700 dark:bg-white/10 dark:text-slate-200">
      Near the end of their period, still open: {{ nearEnd.join(', ') }}. Only if you want to.
    </p>

    <div v-for="g in groups" :key="g.period" class="mt-4">
      <h2 class="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{{ HEADING[g.period] }}</h2>
      <div class="mt-1.5 grid grid-cols-2 gap-3">
        <div v-for="row in g.rows" :key="row.habit.id" class="flex flex-col gap-1">
        <button
          :class="['min-h-[44px] rounded-xl border p-3 text-left shadow-sm', row.progress.met ? 'border-teal-300 bg-teal-50 dark:border-emerald-300/50 dark:bg-emerald-400/90 dark:text-emerald-950' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-dusk-card']"
          @click="tap(row.habit.id)"
        >
          <span class="block break-words text-sm font-medium leading-tight">{{ row.habit.title }}</span>
          <span class="mt-2 flex flex-wrap gap-1">
            <i v-for="n in Math.min(row.progress.target, 8)" :key="n" :class="['size-2 rounded-full', n <= row.progress.count ? 'bg-teal-400 dark:bg-lavender' : 'bg-slate-200 dark:bg-white/20']" />
          </span>
          <span class="mt-1 block text-[11px] opacity-70">{{ row.progress.count }} of {{ row.progress.target }} {{ WORD[g.period] }}</span>
        </button>
          <a
            v-if="appFor(row.habit)" :href="openLink(appFor(row.habit)!, android)" :target="android ? undefined : '_blank'" rel="noopener"
            class="flex min-h-[44px] items-center justify-center rounded-xl bg-stone-100 text-xs font-medium dark:bg-white/10"
          >Open {{ appFor(row.habit)!.name }} ↗</a>
          <button class="min-h-[32px] text-xs text-blue-600 dark:text-blue-400" @click="$emit('edit', row.habit.id)">Edit</button>
        </div>
      </div>
    </div>

    <p v-if="!groups.length" class="mt-4 text-[15px] text-slate-500 dark:text-slate-400">No habits yet. Add one below. A missed day is just a day.</p>

    <form class="mt-5 rounded-2xl bg-white p-3 shadow-sm dark:bg-dusk-card" @submit.prevent="add">
      <p class="text-sm font-medium">Add a habit</p>
      <input v-model="title" class="mt-2 min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[16px] outline-none dark:border-white/10 dark:bg-dusk" placeholder="e.g. Stretch" maxlength="120">
      <div class="mt-2 flex items-center gap-2">
        <input v-model.number="target" type="number" min="1" max="99" class="min-h-[44px] w-16 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[16px] outline-none dark:border-white/10 dark:bg-dusk" aria-label="Times">
        <span class="text-sm text-slate-500 dark:text-slate-400">times per</span>
        <select v-model="period" class="min-h-[44px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[16px] outline-none dark:border-white/10 dark:bg-dusk" aria-label="Period">
          <option v-for="p in PERIODS" :key="p" :value="p">{{ LABEL[p] }}</option>
        </select>
      </div>
      <button type="submit" class="mt-3 min-h-[44px] w-full rounded-2xl bg-ember font-semibold text-white disabled:opacity-50" :disabled="!title.trim()">Add habit</button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { appForItem, isAndroidUa, openLink } from '~/lib/home/apps';
import { PERIODS, finalStretchMention } from '~/lib/domain';
import { addMentioned, getMentioned } from '~/lib/home/prefs';
import type { Period } from '~/lib/domain';
import { useGraphStore } from '~/stores/graph';
import { useRewards } from '~/composables/useRewards';

const emit = defineEmits<{ (e: 'said', msg: string): void; (e: 'edit', nodeId: string): void; (e: 'open-garden'): void }>();
const graph = useGraphStore();
const { reward } = useRewards();

const HEADING: Record<Period, string> = { day: 'Every day', week: 'Each week', month: 'Each month', quarter: 'Each quarter', four_months: 'Every 4 months', six_months: 'Every 6 months', year: 'Each year' };
const LABEL: Record<Period, string> = { day: 'day', week: 'week', month: 'month', quarter: 'quarter', four_months: '4 months', six_months: '6 months', year: 'year' };
const WORD: Record<Period, string> = { day: 'today', week: 'this week', month: 'this month', quarter: 'this quarter', four_months: 'this 4 months', six_months: 'this 6 months', year: 'this year' };

const groups = computed(() =>
  PERIODS.map((period) => ({ period, rows: graph.habitRows.filter((r) => r.habit.recurrence.period === period && !r.habit.quiet) })).filter((g) => g.rows.length),
);

// Each longer-period habit gets one gentle mention near the end of its period, shown once.
const nearEnd = ref<string[]>([]);
const android = ref(false);
const appFor = (h: { title: string; link?: string | null }) => appForItem(h.title, h.link);

onMounted(() => {
  android.value = isAndroidUa(navigator.userAgent);
  const seen = getMentioned();
  const hits = graph.habits.flatMap((h) => {
    const key = finalStretchMention(h, graph.occurrences, graph.asOf, seen.filter((m) => m.startsWith(`${h.id}|`)).map((m) => m.split('|')[1]));
    return key ? [{ title: h.title, mark: `${h.id}|${key}` }] : [];
  });
  nearEnd.value = hits.map((h) => h.title);
  addMentioned(hits.map((h) => h.mark));
});

const title = ref('');
const target = ref(1);
const period = ref<Period>('day');

function add() {
  if (graph.createHabit({ title: title.value, period: period.value, target: target.value || 1 })) {
    title.value = '';
    target.value = 1;
    emit('said', 'Habit added.');
  }
}
function tap(id: string) {
  const r = graph.tapHabit(id);
  if (r) emit('said', r.logged ? reward('habit', { habitId: id }) : 'Undone.');
}
</script>
