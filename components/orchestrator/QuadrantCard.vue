<template>
  <Card
    :class="cn('p-1.5 sm:p-2 md:p-2.5 transition-all', hovered && 'ring-2 ring-primary/40 bg-primary/[0.03] shadow-sm')"
    @dragover.prevent="$emit('dragover-cat', cat)"
    @drop="$emit('drop-task', cat)">
    <div class="flex items-center justify-between mb-0.5 sm:mb-1 px-0.5 sm:px-1">
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] sm:text-xs font-semibold">{{ label ?? meta.label }}</span>
        <span class="text-[8px] sm:text-[9px] text-muted-foreground leading-none">{{ meta.urgent ? '⚡' : '🌙' }} {{ meta.important ? '★' : '☆' }}</span>
      </div>
      <span class="text-[9px] sm:text-[10px] text-muted-foreground tabular-nums">{{ tasks.length }}</span>
    </div>

    <div v-if="tasks.length === 0" :class="cn('py-2 sm:py-3 md:py-4 text-center transition-colors', hovered && 'bg-primary/10 rounded-md')">
      <p :class="cn('text-[10px] italic', hovered ? 'text-primary' : 'text-muted-foreground')">{{ hovered ? 'Drop here' : 'No tasks' }}</p>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-left">
        <tbody>
          <tr v-for="t in tasks" :key="t.id" draggable="true"
            class="group border-b border-border/50 last:border-0 hover:bg-muted/30 transition-all cursor-grab active:cursor-grabbing"
            @dragstart="$emit('drag-start', t.id)" @dragend="$emit('drag-end')">
            <td class="px-0.5 md:px-1 py-1 md:py-1.5 w-4 sm:w-5"><GripVertical class="size-3 text-muted-foreground/60 mx-auto" /></td>
            <td class="px-0.5 md:px-1 py-1 md:py-1.5 w-5 sm:w-6">
              <Checkbox :checked="t.status === 'completed'" :aria-label="`Complete ${t.title}`"
                @change="(v) => v ? store.completeTask(t.id) : store.uncompleteTask(t.id)" />
            </td>
            <td class="px-1 md:px-1.5 py-1 md:py-1.5 min-w-0">
              <div class="flex items-center gap-1">
                <span :class="cn('block text-xs font-medium truncate max-w-[110px] xs:max-w-[160px] sm:max-w-[240px] md:max-w-[360px]', t.status === 'completed' && 'line-through text-muted-foreground')">{{ t.title }}</span>
                <span v-if="projectName(t.projectId)" :class="cn('text-[8px] rounded px-1 py-px font-medium shrink-0 hidden sm:inline border', projectColor(t.projectId))">{{ projectName(t.projectId) }}</span>
              </div>
            </td>
            <td class="px-1 md:px-1.5 py-1 md:py-1.5 text-[10px] whitespace-nowrap hidden xs:table-cell">
              <span :class="cn('inline-block rounded px-1 py-px font-medium', catColor(t.category))">{{ t.category }}</span>
            </td>
            <td class="px-1 md:px-1.5 py-1 md:py-1.5 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap hidden sm:table-cell">{{ formatDuration(t.estimatedMinutes) }}</td>
            <td class="px-1 md:px-1.5 py-1 md:py-1.5">
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" class="size-6" aria-label="Do today" title="Do today" @click.stop="store.updateTask(t.id, { status: 'today' })"><CalendarClock class="size-3" /></Button>
                <Button size="icon" variant="ghost" class="size-6" aria-label="Edit" @click.stop="$emit('edit', t)"><Pencil class="size-3" /></Button>
                <Button size="icon" variant="ghost" class="size-6 text-destructive hover:text-destructive" aria-label="Delete" @click.stop="store.deleteTask(t.id)"><Trash2 class="size-3" /></Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { GripVertical, Pencil, Trash2, CalendarClock } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { cn } from '~/lib/utils';
import { CATEGORY_COLORS, PROJECT_COLORS, EISENHOWER_LABELS, type Task, type EisenhowerCategory } from '~/lib/types';
import { formatDuration } from '~/lib/time-utils';

const props = defineProps<{ cat: EisenhowerCategory; tasks: Task[]; hovered: boolean; label?: string }>();
const projectName = (id?: string | null) => store.projects.find((p) => p.id === id)?.name;
const projectColor = (id?: string | null) => {
  const p = store.projects.find((x) => x.id === id);
  return p ? PROJECT_COLORS[p.color] ?? '' : '';
};
defineEmits<{
  (e: 'drop-task', cat: EisenhowerCategory): void;
  (e: 'dragover-cat', cat: EisenhowerCategory): void;
  (e: 'drag-start', id: string): void;
  (e: 'drag-end'): void;
  (e: 'edit', t: Task): void;
}>();

const store = useAppStore();
const meta = computed(() => EISENHOWER_LABELS[props.cat]);
const catColor = (c: string) => CATEGORY_COLORS[c] ?? CATEGORY_COLORS.Admin;
</script>
