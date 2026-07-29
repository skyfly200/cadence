<template>
  <Card :class="cn('p-2 sm:p-2.5 ring-1', style.ring, style.bg)">
    <div class="flex items-center justify-between mb-1.5 sm:mb-2">
      <div class="flex items-center gap-1.5">
        <Battery :class="cn('size-3.5', style.text)" />
        <span class="text-[11px] sm:text-xs font-semibold">Capacity</span>
      </div>
      <span :class="cn('text-[10px] font-medium', style.text)">{{ style.label }}</span>
    </div>

    <div class="space-y-1.5 sm:space-y-2">
      <div>
        <div class="flex items-center justify-between text-[10px] mb-0.5">
          <span class="flex items-center gap-0.5 text-muted-foreground"><Zap class="size-2.5" /> Readiness</span>
          <span :class="cn('font-semibold tabular-nums', style.text)">{{ score ?? '—' }}</span>
        </div>
        <Slider :model-value="score ?? 70" :min="0" :max="100" :step="1" @update:model-value="onReadiness" />
      </div>

      <div class="grid grid-cols-2 gap-1.5 sm:gap-2">
        <div>
          <label class="text-[9px] text-muted-foreground flex items-center gap-0.5"><Moon class="size-2.5" /> Sleep hrs</label>
          <Input type="number" :step="0.5" :min="0" :max="14" :model-value="capacity?.sleepHours ?? ''"
            class="h-7 sm:h-6 text-[11px] px-1.5 mt-0.5"
            @update:model-value="(v) => store.setCapacity({ sleepHours: Number(v) || null })" />
        </div>
        <div>
          <label class="text-[9px] text-muted-foreground flex items-center gap-0.5"><Heart class="size-2.5" /> Energy</label>
          <Input type="number" :min="1" :max="10" :model-value="capacity?.manualEnergyRating ?? ''"
            class="h-7 sm:h-6 text-[11px] px-1.5 mt-0.5"
            @update:model-value="(v) => store.setCapacity({ manualEnergyRating: Number(v) || null })" />
        </div>
      </div>

      <div class="rounded bg-background/60 px-2 py-1 sm:py-1.5 border">
        <div class="flex items-center justify-between text-[10px] mb-0.5">
          <span class="text-muted-foreground">Focus budget</span>
          <span :class="cn('font-medium tabular-nums', over ? 'text-rose-600' : '')">
            {{ formatDuration(used) }}/{{ formatDuration(maxFocus) }}
          </span>
        </div>
        <Progress :value="pct" :bar-class="over ? 'bg-rose-500' : committed > 0 ? 'bg-sky-500' : undefined" class="h-1.5" />
        <div class="flex items-center justify-between text-[9px] mt-1 text-muted-foreground">
          <span v-if="committed > 0" class="flex items-center gap-0.5">
            <CalendarClock class="size-2.5 text-sky-500" /> {{ formatDuration(committed) }} committed
          </span>
          <span v-else>{{ formatDuration(scheduled) }} scheduled</span>
          <span :class="cn('tabular-nums font-medium', over ? 'text-rose-600' : 'text-emerald-600')">
            {{ over ? 'over budget' : `${formatDuration(available)} free` }}
          </span>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Battery, Heart, Moon, Zap, CalendarClock } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { getCapacityTier } from '~/lib/types';
import { cn } from '~/lib/utils';
import { formatDuration } from '~/lib/time-utils';

const store = useAppStore();
const capacity = computed(() => store.capacity);
const score = computed(() => capacity.value?.readinessScore ?? null);

const committed = computed(() => store.committedMinutes);
const scheduled = computed(() => store.scheduledFocusMinutes);
const available = computed(() => store.availableFocusMinutes);
const maxFocus = computed(() => capacity.value?.maxAllowedFocusMinutes ?? 270);
const used = computed(() => committed.value + scheduled.value);

const TIER_STYLES: Record<string, { ring: string; text: string; bg: string; label: string }> = {
  emerald: { ring: 'ring-emerald-500/40', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/10', label: 'Peak' },
  amber: { ring: 'ring-amber-500/40', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/10', label: 'Steady' },
  rose: { ring: 'ring-rose-500/40', text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/10', label: 'Conservation' },
};
const style = computed(() => TIER_STYLES[getCapacityTier(score.value).color]);

const pct = computed(() => maxFocus.value > 0 ? Math.min(100, Math.round((used.value / maxFocus.value) * 100)) : 0);
const over = computed(() => used.value > maxFocus.value);

function onReadiness(v: number) {
  store.setCapacity({ readinessScore: v });
}
</script>
