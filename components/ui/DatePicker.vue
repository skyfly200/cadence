<template>
  <div ref="root" class="relative inline-block">
    <button
      type="button"
      :disabled="disabled"
      :class="cn(
        'flex items-center gap-1.5 rounded-md border border-input bg-transparent px-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50',
        props.class,
      )"
      @click="toggle">
      <CalendarIcon class="size-3 shrink-0 text-muted-foreground" />
      <span :class="cn('truncate', !modelValue && 'text-muted-foreground')">
        {{ modelValue ? displayLabel : (placeholder || 'Pick a date') }}
      </span>
    </button>

    <div
      v-if="openState"
      class="absolute z-50 mt-1 w-[15rem] rounded-md border bg-background p-2 shadow-lg"
      :class="alignRight ? 'right-0' : 'left-0'">
      <!-- Month nav -->
      <div class="flex items-center justify-between mb-1.5">
        <button type="button" class="size-6 rounded hover:bg-muted flex items-center justify-center" aria-label="Previous month" @click="shiftMonth(-1)">
          <ChevronLeft class="size-3.5" />
        </button>
        <span class="text-[11px] font-semibold">{{ monthLabel }}</span>
        <button type="button" class="size-6 rounded hover:bg-muted flex items-center justify-center" aria-label="Next month" @click="shiftMonth(1)">
          <ChevronRight class="size-3.5" />
        </button>
      </div>

      <!-- Weekday header -->
      <div class="grid grid-cols-7 gap-0.5 mb-0.5">
        <span v-for="d in WEEKDAYS" :key="d" class="text-center text-[9px] text-muted-foreground py-0.5">{{ d }}</span>
      </div>

      <!-- Day grid -->
      <div class="grid grid-cols-7 gap-0.5">
        <button
          v-for="(cell, i) in cells" :key="i"
          type="button"
          :disabled="!cell"
          :class="cn(
            'h-6 rounded text-[11px] flex items-center justify-center transition-colors',
            !cell && 'invisible',
            cell && cell.iso === modelValue && 'bg-primary text-primary-foreground font-semibold',
            cell && cell.iso !== modelValue && cell.isToday && 'ring-1 ring-primary/50',
            cell && cell.iso !== modelValue && 'hover:bg-muted',
          )"
          @click="cell && pick(cell.iso)">
          {{ cell ? cell.day : '' }}
        </button>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between mt-1.5 pt-1.5 border-t">
        <button type="button" class="text-[10px] text-primary hover:underline" @click="pick(todayIso())">Today</button>
        <button v-if="modelValue && clearable" type="button" class="text-[10px] text-muted-foreground hover:text-destructive hover:underline" @click="pick('')">Clear</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { cn } from '~/lib/utils';

const props = withDefaults(defineProps<{
  modelValue?: string | null; // YYYY-MM-DD, or '' / null
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  alignRight?: boolean;
  class?: string;
}>(), { modelValue: '', clearable: true, alignRight: false });

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const root = ref<HTMLElement | null>(null);
const openState = ref(false);

const pad = (n: number) => String(n).padStart(2, '0');
function toIso(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayIso(): string { return toIso(new Date()); }
function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Which month the calendar is currently showing.
const viewYear = ref(new Date().getFullYear());
const viewMonth = ref(new Date().getMonth());

function syncViewToValue() {
  const d = parse(props.modelValue) ?? new Date();
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
}
watch(() => props.modelValue, () => { if (openState.value) syncViewToValue(); });

const monthLabel = computed(() => `${MONTHS[viewMonth.value]} ${viewYear.value}`);
const displayLabel = computed(() => {
  const d = parse(props.modelValue);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
});

interface Cell { day: number; iso: string; isToday: boolean; }
const cells = computed<(Cell | null)[]>(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1);
  const startPad = first.getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
  const out: (Cell | null)[] = [];
  for (let i = 0; i < startPad; i++) out.push(null);
  const t = todayIso();
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${viewYear.value}-${pad(viewMonth.value + 1)}-${pad(day)}`;
    out.push({ day, iso, isToday: iso === t });
  }
  return out;
});

function shiftMonth(delta: number) {
  const m = viewMonth.value + delta;
  const d = new Date(viewYear.value, m, 1);
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
}

function toggle() {
  if (props.disabled) return;
  openState.value = !openState.value;
  if (openState.value) syncViewToValue();
}
function pick(iso: string) {
  emit('update:modelValue', iso);
  openState.value = false;
}

function onDocClick(e: MouseEvent) {
  if (openState.value && root.value && !root.value.contains(e.target as Node)) openState.value = false;
}
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') openState.value = false; }

onMounted(() => {
  document.addEventListener('mousedown', onDocClick);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick);
  document.removeEventListener('keydown', onKey);
});
</script>
