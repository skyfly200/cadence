<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-end bg-stone-900/30" @click.self="$emit('close')">
    <div class="mx-auto w-full max-w-md rounded-t-[2rem] bg-white p-5 pb-8 dark:bg-[#2A2645]" role="dialog" aria-label="Display and account">
      <p class="font-serif text-xl">Display</p>

      <p class="mt-4 text-sm font-medium">How much to show</p>
      <div class="mt-1.5 grid grid-cols-3 gap-2">
        <button
          v-for="(n, i) in ['Simple', 'Balanced', 'Rich']" :key="n"
          :class="['min-h-[44px] rounded-xl border text-sm', density === i ? 'border-[#E07A45] bg-amber-50 font-semibold text-amber-900 dark:bg-white/10 dark:text-[#FFB59F]' : 'border-slate-200 dark:border-white/10']"
          @click="$emit('update:density', i as 0 | 1 | 2)"
        >{{ n }}</button>
      </div>

      <p class="mt-4 text-sm font-medium">Colours</p>
      <ClientOnly>
        <div class="mt-1.5 grid grid-cols-3 gap-2">
          <button
            v-for="m in MODES" :key="m.value"
            :class="['min-h-[44px] rounded-xl border text-sm', colorMode.preference === m.value ? 'border-[#E07A45] bg-amber-50 font-semibold text-amber-900 dark:bg-white/10 dark:text-[#FFB59F]' : 'border-slate-200 dark:border-white/10']"
            @click="colorMode.preference = m.value"
          >{{ m.label }}</button>
        </div>
      </ClientOnly>

      <div class="mt-5 grid gap-2">
        <button class="min-h-[44px] rounded-xl border border-slate-200 text-sm dark:border-white/10" @click="$emit('account')">
          Account and sync <span class="text-slate-400">· {{ signedIn ? 'signed in' : 'signed out' }}</span>
        </button>
        <NuxtLink to="/classic" class="grid min-h-[44px] place-items-center rounded-xl border border-slate-200 text-sm dark:border-white/10">Classic view (the old app)</NuxtLink>
      </div>

      <button class="mt-4 min-h-[44px] w-full rounded-2xl bg-stone-100 text-sm dark:bg-white/10" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Density } from '~/lib/home/prefs';

defineProps<{ open: boolean; density: Density; signedIn: boolean }>();
defineEmits<{ (e: 'close'): void; (e: 'update:density', d: Density): void; (e: 'account'): void }>();

const colorMode = useColorMode();
const MODES = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
</script>
