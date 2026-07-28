<template>
  <div class="space-y-2 sm:space-y-3">
    <div class="grid grid-cols-2 xs:grid-cols-4 gap-2">
      <Card v-for="s in statCards" :key="s.label" class="p-2 sm:p-2.5 flex items-center gap-2">
        <component :is="s.icon" :class="cn('size-4 shrink-0', s.color)" />
        <div class="min-w-0">
          <div class="text-base sm:text-lg font-bold tabular-nums leading-none">{{ s.value }}</div>
          <div class="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{{ s.label }}</div>
        </div>
      </Card>
    </div>

    <div class="grid gap-2 sm:gap-3 md:grid-cols-2">
      <Card class="p-2 sm:p-2.5">
        <h3 class="text-[11px] sm:text-xs font-semibold mb-2 flex items-center gap-1.5"><Calendar class="size-3" /> Last 7 days</h3>
        <div class="flex items-end justify-between gap-1 sm:gap-1.5 h-24 sm:h-28">
          <div v-for="(d, i) in completedByDay" :key="i" class="flex-1 flex flex-col items-center gap-0.5">
            <span class="text-[9px] font-medium tabular-nums">{{ d.count }}</span>
            <div class="w-full flex items-end justify-center" style="height: 72px">
              <div class="w-full max-w-[1.25rem] rounded-t bg-primary/70"
                :style="{ height: `${(d.count / maxCompleted) * 100}%`, minHeight: d.count > 0 ? '4px' : '1px' }" />
            </div>
            <span class="text-[8px] sm:text-[9px] text-muted-foreground">{{ d.date.toLocaleDateString('en', { weekday: 'short' }) }}</span>
          </div>
        </div>
      </Card>

      <Card class="p-2 sm:p-2.5">
        <h3 class="text-[11px] sm:text-xs font-semibold mb-2 flex items-center gap-1.5"><Anchor class="size-3" /> Focus by category</h3>
        <p v-if="catEntries.length === 0" class="text-[10px] text-muted-foreground py-4 text-center">No data yet.</p>
        <div v-else class="space-y-1.5">
          <div v-for="[cat, v] in catEntries" :key="cat" class="flex items-center gap-2 text-[10px] sm:text-xs">
            <span class="w-12 sm:w-14 truncate font-medium">{{ cat }}</span>
            <div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div class="h-full rounded-full bg-primary/60" :style="{ width: `${(v.minutes / maxCatMin) * 100}%` }" />
            </div>
            <span class="tabular-nums text-muted-foreground w-14 sm:w-16 text-right text-[9px] sm:text-[10px]">{{ v.count }} · {{ formatDuration(v.minutes) }}</span>
          </div>
        </div>
      </Card>
    </div>

    <Card v-if="gamification.length > 0" class="p-2 sm:p-2.5">
      <h3 class="text-[11px] sm:text-xs font-semibold mb-2 flex items-center gap-1.5"><Trophy class="size-3 text-amber-500" /> Scoring events</h3>
      <div class="max-h-40 overflow-y-auto">
        <div class="overflow-x-auto">
          <table class="w-full text-left min-w-[280px]">
            <thead>
              <tr class="border-b border-border text-[9px] text-muted-foreground uppercase tracking-wide">
                <th class="px-1.5 py-0.5">Type</th>
                <th class="px-1.5 py-0.5">Note</th>
                <th class="px-1.5 py-0.5 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in gamification" :key="g.id" class="border-b border-border/30 last:border-0">
                <td class="px-1.5 py-1 text-[10px] capitalize text-muted-foreground">{{ g.type.replace('_', ' ') }}</td>
                <td class="px-1.5 py-1 text-[10px] truncate max-w-[200px] text-muted-foreground">{{ g.note ?? '—' }}</td>
                <td :class="cn('px-1.5 py-1 text-[10px] font-semibold tabular-nums text-right', g.points > 0 ? 'text-emerald-600' : 'text-rose-600')">
                  {{ g.points > 0 ? '+' : '' }}{{ g.points }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Trophy, Target, TrendingUp, Flame, Calendar, Anchor } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { formatDuration } from '~/lib/time-utils';
import { cn } from '~/lib/utils';

const store = useAppStore();
const tasks = computed(() => store.tasks);
const gamification = computed(() => store.gamification);
const todayScore = computed(() => store.todayScore);

const completed = computed(() => tasks.value.filter((t) => t.status === 'completed' && t.completedAt));

const last7Days = computed(() => Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return d;
}));
const completedByDay = computed(() => last7Days.value.map((d) => ({
  date: d,
  count: completed.value.filter((t) => t.completedAt && new Date(t.completedAt).toDateString() === d.toDateString()).length,
})));
const maxCompleted = computed(() => Math.max(1, ...completedByDay.value.map((x) => x.count)));

const completedToday = computed(() => completed.value.filter(
  (t) => t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()));
const realistic = computed(() => completedToday.value.filter((t) => {
  if (t.estimatedMinutes === 0) return false;
  const ratio = t.actualMinutes / t.estimatedMinutes;
  return ratio >= 0.8 && ratio <= 1.2;
}));
const realismPct = computed(() => completedToday.value.length > 0
  ? Math.round((realistic.value.length / completedToday.value.length) * 100) : 0);
const totalFocusMin = computed(() => tasks.value.reduce((s, t) => s + t.actualMinutes, 0));

const catEntries = computed(() => {
  const byCategory: Record<string, { count: number; minutes: number }> = {};
  for (const t of completed.value) {
    if (!byCategory[t.category]) byCategory[t.category] = { count: 0, minutes: 0 };
    byCategory[t.category].count++;
    byCategory[t.category].minutes += t.actualMinutes;
  }
  return Object.entries(byCategory).sort((a, b) => b[1].minutes - a[1].minutes);
});
const maxCatMin = computed(() => Math.max(1, ...catEntries.value.map(([, v]) => v.minutes)));

const statCards = computed(() => [
  { icon: Trophy, color: 'text-amber-500', value: String(todayScore.value), label: 'Score' },
  { icon: Target, color: 'text-purple-500', value: `${realismPct.value}%`, label: 'Realism' },
  { icon: TrendingUp, color: 'text-emerald-500', value: String(completed.value.length), label: 'Completed' },
  { icon: Flame, color: 'text-orange-500', value: formatDuration(totalFocusMin.value), label: 'Focus' },
]);
</script>
