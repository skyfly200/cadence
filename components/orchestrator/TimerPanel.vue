<template>
  <Card :class="cn('p-2 sm:p-2.5', activeTimer && 'ring-1 ring-primary/40')">
    <div class="flex items-center justify-between mb-1.5 sm:mb-2">
      <div class="flex items-center gap-1.5">
        <component :is="activeTimer?.type === 'pomodoro' ? TimerIcon : Brain" class="size-3.5" />
        <span class="text-[11px] sm:text-xs font-semibold">Timer</span>
      </div>
      <span v-if="activeTimer" class="text-[9px] text-muted-foreground capitalize">{{ activeTimer.type.replace('_', ' ') }}</span>
    </div>

    <div v-if="activeTimer" class="space-y-1.5 sm:space-y-2">
      <p class="text-[10px] sm:text-[11px] text-muted-foreground truncate">
        {{ task ? task.title : (activeTimer.type === 'pomodoro' ? 'Free Pomodoro' : 'Free Flow') }}
      </p>
      <div class="text-center">
        <div class="font-mono text-xl sm:text-2xl font-bold tabular-nums leading-none">{{ formatSeconds(elapsed) }}</div>
        <div v-if="remaining !== null" :class="cn('mt-0.5 text-[10px]', remaining < 60 ? 'text-rose-600' : 'text-muted-foreground')">
          {{ remaining > 0 ? `${formatSeconds(remaining)} left` : 'done' }}
        </div>
      </div>
      <div class="flex justify-center gap-1.5 sm:gap-2">
        <Button size="sm" variant="outline" class="h-7 sm:h-6 text-[10px] px-2" @click="handleStop(true)">
          <Square class="size-2.5" /> Stop
        </Button>
        <Button size="sm" class="h-7 sm:h-6 text-[10px] px-2" @click="handleStop(false)">Complete</Button>
      </div>
    </div>

    <div v-else class="space-y-1.5">
      <p class="text-[10px] sm:text-[11px] text-muted-foreground">No active session.</p>
      <div class="flex flex-col gap-1">
        <Button size="sm" variant="outline" class="h-7 sm:h-6 text-[10px] px-2" @click="start('pomodoro')">
          <TimerIcon class="size-2.5" /> Start Pomodoro
        </Button>
        <Button size="sm" variant="ghost" class="h-7 sm:h-6 text-[10px] px-2" @click="start('open_flow')">
          <Brain class="size-2.5" /> Open Flow
        </Button>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Square, Timer as TimerIcon, Brain } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { formatSeconds } from '~/lib/time-utils';
import { cn } from '~/lib/utils';
import { useToast } from '~/composables/useToast';

const store = useAppStore();
const { toast } = useToast();
const now = ref(Date.now());
let interval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  interval = setInterval(() => { now.value = Date.now(); store.tickTimer(); }, 1000);
});
onUnmounted(() => { if (interval) clearInterval(interval); });

const activeTimer = computed(() => store.activeTimer);
const task = computed(() => activeTimer.value ? store.tasks.find((t) => t.id === activeTimer.value!.taskId) : null);

// Fix: clamp elapsed to >= 0 so it never renders -1:-1 on start.
const elapsed = computed(() => activeTimer.value
  ? Math.max(0, activeTimer.value.elapsedBeforeStart + Math.floor((now.value - activeTimer.value.startedAt) / 1000))
  : 0);
const remaining = computed(() => activeTimer.value?.type === 'pomodoro' && activeTimer.value.targetSeconds > 0
  ? Math.max(0, activeTimer.value.targetSeconds - elapsed.value)
  : null);

function start(type: 'pomodoro' | 'open_flow') {
  const t = store.tasks.find((x) => x.status === 'today');
  store.startTimer(t?.id ?? null, type);
}
function handleStop(interrupted: boolean) {
  const secs = elapsed.value;
  store.stopTimer(interrupted);
  toast({ title: interrupted ? 'Stopped' : 'Complete', description: formatSeconds(secs) });
}
</script>
