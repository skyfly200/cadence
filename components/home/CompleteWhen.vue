<template>
  <span ref="root" class="relative inline-block">
    <button
      type="button" :aria-label="`${label} for an earlier day`" :aria-expanded="open" aria-haspopup="menu" :title="`${label} for an earlier day`"
      :class="['grid shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-white/10', compact ? 'h-9 w-7' : 'min-h-[44px] min-w-[44px]']"
      @click="open = !open"
    ><ChevronDown class="size-4" /></button>
    <div
      v-if="open" role="menu"
      class="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#2A2645]"
    >
      <p class="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ label }} for…</p>
      <button v-for="d in days" :key="d.key" type="button" role="menuitem" class="block min-h-[44px] w-full rounded-lg px-3 text-left text-sm hover:bg-stone-100 dark:hover:bg-white/10" @click="choose(d.at)">{{ d.label }}</button>
      <label class="block px-3 pb-2 pt-1 text-sm">
        <span class="text-slate-500 dark:text-slate-400">Another day</span>
        <input
          type="date" :max="todayKey" aria-label="Pick another day"
          class="mt-1 min-h-[44px] w-full rounded-lg border border-stone-200 bg-stone-50 px-2 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
          @change="pickDate(($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { ChevronDown } from 'lucide-vue-next';
import { dayInputToAt, pastDays } from '~/lib/home/past-days';

/** The small drop-down beside a complete button: finish or log for a day that has passed. */
withDefaults(defineProps<{ label?: string; compact?: boolean }>(), { label: 'Done', compact: true });
const emit = defineEmits<{ (e: 'pick', at: Date): void }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
onClickOutside(root, () => { open.value = false; });

const days = computed(() => (open.value ? pastDays(new Date()) : []));
const todayKey = computed(() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
});

function choose(at: Date) { open.value = false; emit('pick', at); }
function pickDate(value: string) {
  const at = dayInputToAt(value, new Date());
  if (at) choose(at);
}
</script>
