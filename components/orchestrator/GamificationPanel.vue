<template>
  <Card class="p-2 sm:p-2.5">
    <div class="flex items-center justify-between mb-1.5 sm:mb-2">
      <div class="flex items-center gap-1.5">
        <Trophy class="size-3.5 text-amber-500" />
        <span class="text-[11px] sm:text-xs font-semibold">Score</span>
      </div>
      <span class="text-xs sm:text-sm font-bold tabular-nums">{{ todayScore }}</span>
    </div>

    <div class="space-y-1.5 sm:space-y-2">
      <!-- Planning streak -->
      <div class="flex items-center justify-between rounded-md bg-orange-500/10 border border-orange-500/20 px-2 py-1">
        <span class="flex items-center gap-1 text-[10px] font-medium text-orange-700 dark:text-orange-300">
          <Flame :class="cn('size-3', streak > 0 ? 'text-orange-500' : 'text-muted-foreground')" />
          Planning streak
        </span>
        <div class="flex items-center gap-1.5">
          <span v-if="streak > 0 && !plannedToday" class="text-[8px] text-muted-foreground">plan today to keep it</span>
          <span v-else-if="longest > 0" class="text-[8px] text-muted-foreground">best {{ longest }}</span>
          <span class="text-xs font-bold tabular-nums">{{ streak }}<span class="text-[10px]"> day{{ streak !== 1 ? 's' : '' }}</span></span>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between text-[10px] mb-0.5">
          <span class="text-muted-foreground">Tier</span>
          <span class="font-medium tabular-nums">{{ todayScore }}/{{ nextTier }}</span>
        </div>
        <Progress :value="tierPct" class="h-1.5" />
      </div>

      <div class="grid grid-cols-2 gap-1.5 sm:gap-2">
        <div class="rounded bg-muted/40 px-2 py-1 sm:py-1.5 text-center">
          <div class="text-base sm:text-lg font-bold tabular-nums">{{ completedToday.length }}</div>
          <div class="text-[9px] sm:text-[10px] text-muted-foreground">done today</div>
        </div>
        <div class="rounded bg-muted/40 px-2 py-1 sm:py-1.5 text-center">
          <div class="text-base sm:text-lg font-bold tabular-nums">{{ gamification.length }}</div>
          <div class="text-[9px] sm:text-[10px] text-muted-foreground">events</div>
        </div>
      </div>

      <div v-if="gamification.length > 0" class="max-h-24 sm:max-h-28 overflow-y-auto space-y-0 -mr-1 pr-1">
        <div v-for="g in gamification.slice(0, 6)" :key="g.id"
          class="flex items-center gap-1.5 text-[10px] sm:text-xs py-0.5 border-b border-border/30 last:border-0">
          <component :is="meta(g.type).icon" :class="cn('size-2.5 sm:size-3 shrink-0', meta(g.type).color)" />
          <span class="flex-1 truncate text-muted-foreground">{{ g.note ?? meta(g.type).label }}</span>
          <span class="font-medium tabular-nums">+{{ g.points }}</span>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Trophy, Target, Anchor, Flame, CheckCircle2, Clock } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { cn } from '~/lib/utils';

const store = useAppStore();
const todayScore = computed(() => store.todayScore);
const gamification = computed(() => store.gamification);
const completedToday = computed(() => store.completedToday);
const streak = computed(() => store.planningStreakDisplay);
const longest = computed(() => store.planningStreak.longest);
const plannedToday = computed(() => store.plannedToday);

const nextTier = computed(() => Math.ceil((todayScore.value + 1) / 50) * 50);
const tierPct = computed(() => ((todayScore.value % 50) / 50) * 100);

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  realism: { icon: Target, color: 'text-purple-600 dark:text-purple-400', label: 'Realism' },
  anchor_discipline: { icon: Anchor, color: 'text-cyan-600 dark:text-cyan-400', label: 'Anchor' },
  triage_streak: { icon: Flame, color: 'text-orange-600 dark:text-orange-400', label: 'Triage' },
  completion: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', label: 'Done' },
  focus_session: { icon: Clock, color: 'text-teal-600 dark:text-teal-400', label: 'Focus' },
  planning_streak: { icon: Flame, color: 'text-orange-600 dark:text-orange-400', label: 'Streak' },
};
const meta = (type: string) => TYPE_META[type] ?? TYPE_META.completion;
</script>
