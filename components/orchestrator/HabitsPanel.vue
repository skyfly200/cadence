<template>
  <Card class="p-2 sm:p-2.5">
    <div class="flex items-center justify-between mb-1.5">
      <div class="flex items-center gap-1.5">
        <Repeat class="size-3.5 text-indigo-500" />
        <span class="text-[11px] sm:text-xs font-semibold">Habits</span>
        <span v-if="dueToday.length" class="text-[9px] text-muted-foreground">{{ doneCount }}/{{ dueToday.length }} today</span>
      </div>
      <Button size="icon" variant="ghost" class="size-6" aria-label="Add habit" @click="showForm = !showForm">
        <Plus class="size-3.5" />
      </Button>
    </div>

    <!-- Add form -->
    <div v-if="showForm" class="rounded-md border bg-muted/20 p-2 mb-2 space-y-1.5">
      <div class="flex gap-1.5">
        <Input v-model="form.emoji" placeholder="🏃" class="h-7 w-10 text-center text-sm px-0" />
        <Input v-model="form.name" placeholder="Habit name (e.g. Duolingo)" class="h-7 text-[11px] flex-1" @keydown="onFormKey" />
      </div>
      <div class="flex items-center gap-1">
        <button v-for="c in (['daily','weekly'] as const)" :key="c" type="button"
          :class="['h-6 px-2 text-[10px] rounded border', form.cadence === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted']"
          @click="form.cadence = c">{{ c }}</button>
        <template v-if="form.cadence === 'weekly'">
          <button v-for="(d, i) in WEEKDAYS" :key="i" type="button"
            :class="['size-6 text-[9px] rounded-full border', form.days.includes(i) ? 'bg-indigo-500 text-white border-indigo-500' : 'border-border hover:bg-muted']"
            @click="toggleDay(i)">{{ d }}</button>
        </template>
      </div>
      <div class="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" class="h-6 text-[10px] px-2" @click="showForm = false">Cancel</Button>
        <Button size="sm" class="h-6 text-[10px] px-2" :disabled="!form.name.trim()" @click="save">Add habit</Button>
      </div>
    </div>

    <p v-if="store.habits.length === 0 && !showForm" class="text-[10px] text-muted-foreground py-2 text-center">
      No habits yet. Add daily or weekly routines like exercise or skills practice.
    </p>

    <div v-else class="space-y-1">
      <div v-for="h in sortedHabits" :key="h.id"
        :class="cn('group flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors', isDueToday(h) ? 'hover:bg-muted/40' : 'opacity-45')">
        <button type="button"
          :class="cn('shrink-0 rounded-full border flex items-center justify-center size-5 transition-colors',
            isDone(h) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-emerald-500')"
          :aria-label="`Mark ${h.name} done`" @click="store.toggleHabitDone(h.id)">
          <Check v-if="isDone(h)" class="size-3" />
        </button>
        <span class="text-sm shrink-0">{{ h.emoji || '•' }}</span>
        <span :class="cn('flex-1 min-w-0 text-[11px] font-medium truncate', isDone(h) && 'line-through text-muted-foreground')">{{ h.name }}</span>
        <span class="text-[8px] text-muted-foreground shrink-0">{{ h.cadence === 'weekly' ? weeklyLabel(h) : 'daily' }}</span>
        <span v-if="streak(h) > 0" class="flex items-center gap-0.5 text-[9px] font-medium text-orange-500 shrink-0" :title="`${streak(h)}-day streak`">
          <Flame class="size-2.5" />{{ streak(h) }}
        </span>
        <button type="button" class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
          aria-label="Delete habit" @click="store.deleteHabit(h.id)">
          <Trash2 class="size-3" />
        </button>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { Repeat, Plus, Check, Flame, Trash2 } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { cn } from '~/lib/utils';
import { todayKey, format } from '~/lib/time-utils';
import type { Habit } from '~/lib/types';

const store = useAppStore();
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const showForm = ref(false);
const form = reactive({ name: '', emoji: '', cadence: 'daily' as 'daily' | 'weekly', days: [] as number[] });

function toggleDay(i: number) {
  const idx = form.days.indexOf(i);
  if (idx === -1) form.days.push(i); else form.days.splice(idx, 1);
}
function onFormKey(e: KeyboardEvent) { if (e.key === 'Enter') save(); }
async function save() {
  if (!form.name.trim()) return;
  await store.createHabit({
    name: form.name, emoji: form.emoji.trim() || null,
    cadence: form.cadence, days: form.cadence === 'weekly' ? [...form.days] : [],
  });
  form.name = ''; form.emoji = ''; form.cadence = 'daily'; form.days = [];
  showForm.value = false;
}

function isDueToday(h: Habit): boolean {
  return h.cadence === 'daily' || h.days.includes(new Date().getDay());
}
function isDone(h: Habit): boolean { return h.completions.includes(todayKey()); }
function weeklyLabel(h: Habit): string {
  return h.days.length ? h.days.slice().sort().map((d) => WEEKDAYS[d]).join('') : 'weekly';
}
function isDueOn(h: Habit, date: Date): boolean {
  return h.cadence === 'daily' || h.days.includes(date.getDay());
}
function streak(h: Habit): number {
  const set = new Set(h.completions);
  let s = 0;
  for (let i = 0; i < 180; i++) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    if (!isDueOn(h, day)) continue;
    const key = format(day, 'yyyy-MM-dd');
    if (set.has(key)) s++;
    else if (i === 0) continue; // today still pending — don't break
    else break;
  }
  return s;
}

const dueToday = computed(() => store.habits.filter(isDueToday));
const doneCount = computed(() => dueToday.value.filter(isDone).length);
const sortedHabits = computed(() =>
  [...store.habits].sort((a, b) => (Number(isDueToday(b)) - Number(isDueToday(a))) || (Number(isDone(a)) - Number(isDone(b)))));
</script>
