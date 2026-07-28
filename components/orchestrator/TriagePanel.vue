<template>
  <div v-if="triageTasks.length === 0 && resolved === 0" class="py-6 sm:py-8 text-center text-xs text-muted-foreground">
    <CheckCircle2 class="size-4 mx-auto mb-1 text-emerald-500" />
    No rollover triage — unfinished tasks move here at midnight for review.
  </div>

  <div v-else class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-xs sm:text-sm font-semibold">{{ triageTasks.length }} task{{ triageTasks.length !== 1 ? 's' : '' }} to triage</span>
      <Button v-if="triageTasks.length > 0" size="sm" variant="outline" class="h-7 sm:h-6 text-[10px] px-2" @click="completeTriage">
        Complete triage (+15 pts)
      </Button>
    </div>

    <div class="rounded-md border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left min-w-[320px] sm:min-w-[500px]">
          <thead>
            <tr class="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wide">
              <th class="px-2 sm:px-3 py-1">Task</th>
              <th class="px-2 py-1 hidden sm:table-cell">Cat</th>
              <th class="px-2 py-1 hidden sm:table-cell">Est</th>
              <th class="px-2 py-1 hidden md:table-cell">Eis</th>
              <th class="px-2 py-1 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in triageTasks" :key="task.id" class="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
              <td class="px-2 sm:px-3 py-1.5 sm:py-2 min-w-0">
                <div class="text-xs font-medium truncate max-w-[200px] sm:max-w-[280px]">{{ task.title }}</div>
                <div v-if="task.notes" class="text-[10px] text-muted-foreground truncate hidden sm:block">{{ task.notes }}</div>
              </td>
              <td class="px-2 py-1.5 sm:py-2 hidden sm:table-cell">
                <span :class="cn('text-[9px] rounded px-1 py-px font-medium', catColor(task.category))">{{ task.category }}</span>
              </td>
              <td class="px-2 py-1.5 sm:py-2 text-[10px] text-muted-foreground tabular-nums hidden sm:table-cell">{{ formatDuration(task.estimatedMinutes) }}</td>
              <td class="px-2 py-1.5 sm:py-2 hidden md:table-cell">
                <span class="inline-block rounded border border-border/60 px-1 py-px text-[9px] text-muted-foreground">{{ EISENHOWER_LABELS[task.eisenhowerCategory].short }}</span>
              </td>
              <td class="px-2 py-1.5 sm:py-2">
                <div class="flex items-center justify-end gap-0.5 sm:gap-1">
                  <Button size="sm" class="h-6 sm:h-5 text-[9px] px-1.5 gap-0.5" @click="resolve(task.id, 'schedule_today', task.title)">
                    <CalendarClock class="size-2.5" /> <span class="hidden xs:inline">Today</span>
                  </Button>
                  <Button size="sm" variant="outline" class="h-6 sm:h-5 text-[9px] px-1.5 gap-0.5" @click="resolve(task.id, 'incubator', task.title)">
                    <Lightbulb class="size-2.5" /> <span class="hidden xs:inline">Incubate</span>
                  </Button>
                  <Button size="sm" variant="ghost" class="h-6 sm:h-5 text-[9px] px-1.5 text-destructive hover:text-destructive gap-0.5" @click="resolve(task.id, 'delete', task.title)">
                    <Trash2 class="size-2.5" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { CalendarClock, Lightbulb, Trash2, CheckCircle2 } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { cn } from '~/lib/utils';
import { CATEGORY_COLORS, EISENHOWER_LABELS } from '~/lib/types';
import { formatDuration } from '~/lib/time-utils';

const store = useAppStore();
const { toast } = useToast();
const resolved = ref(0);
const triageTasks = computed(() => store.triageTasks);
const catColor = (c: string) => CATEGORY_COLORS[c] ?? CATEGORY_COLORS.Admin;

async function resolve(taskId: string, action: 'schedule_today' | 'incubator' | 'delete', title: string) {
  await store.resolveTriageItem(taskId, action);
  resolved.value++;
  const labels = { schedule_today: '→ today', incubator: '→ incubator', delete: 'deleted' };
  toast({ title: `${title} ${labels[action]}` });
}

async function completeTriage() {
  await store.setCapacity({ triageCompleted: true, triageStreak: (store.capacity?.triageStreak ?? 0) + 1 });
  await store.awardPoints('triage_streak', 15, 'Completed morning triage ritual');
  toast({ title: 'Triage complete', description: '+15 pts · streak++' });
}
</script>
