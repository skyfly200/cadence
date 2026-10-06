<template>
  <span class="group relative inline-flex align-middle" tabindex="0" :aria-label="text" role="note">
    <Info class="size-4 text-slate-400" aria-hidden="true" />
    <span class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-normal text-white shadow-lg group-hover:block group-focus:block dark:bg-slate-100 dark:text-slate-900">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { Info } from 'lucide-vue-next';

defineProps<{ text: string }>();
</script>
