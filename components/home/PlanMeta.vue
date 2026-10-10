<template>
  <span v-if="meta.category || meta.minutes || meta.blockedBy.length || backlog" class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
    <span v-if="meta.category" class="rounded-full bg-teal-50 px-2 py-0.5 text-teal-800 dark:bg-white/10 dark:text-lavender">{{ meta.category }}</span>
    <span v-if="meta.minutes">~{{ meta.minutes >= 60 ? `${Math.round((meta.minutes / 60) * 10) / 10} h` : `${meta.minutes} min` }}</span>
    <span v-if="meta.blockedBy.length" class="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300" :title="`Needs first: ${meta.blockedBy.map((b) => b.title).join(', ')}`">
      <Lock class="size-3" />Needs {{ meta.blockedBy[0]!.title }}<template v-if="meta.blockedBy.length > 1"> +{{ meta.blockedBy.length - 1 }}</template>
    </span>
    <span v-if="backlog">Backlog</span>
  </span>
</template>

<script setup lang="ts">
import { Lock } from 'lucide-vue-next';

defineProps<{
  meta: { category: string | null; minutes: number | null; blockedBy: { id: string; title: string }[] };
  backlog?: boolean;
}>();
</script>
