<template>
  <div role="region" aria-label="Support">
    <p class="font-serif text-xl">That sounds really heavy.</p>
    <p class="mt-2 text-[15px] text-slate-700 dark:text-slate-200">
      I'm an app, so I can't be the help you deserve right now, but people can.
    </p>
    <ul class="mt-3 space-y-2">
      <li v-for="r in resources" :key="r.name" class="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
        <p class="text-[15px] font-medium">{{ r.name }}</p>
        <p class="text-sm text-slate-600 dark:text-slate-300">{{ r.detail }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <a v-if="r.tel" :href="r.tel" class="inline-flex min-h-[44px] items-center rounded-xl bg-stone-100 px-4 text-sm font-medium dark:bg-white/10">Call</a>
          <a v-if="r.sms" :href="r.sms" class="inline-flex min-h-[44px] items-center rounded-xl bg-stone-100 px-4 text-sm font-medium dark:bg-white/10">Text</a>
          <a v-if="r.url" :href="r.url" target="_blank" rel="noopener" class="inline-flex min-h-[44px] items-center rounded-xl bg-stone-100 px-4 text-sm font-medium dark:bg-white/10">Open</a>
        </div>
      </li>
    </ul>
    <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
      What you wrote is saved, privately. I'm here when you want to go back to your list.
    </p>
    <div class="mt-3 flex gap-2">
      <button type="button" class="min-h-[44px] flex-1 rounded-2xl bg-stone-100 text-sm font-medium dark:bg-white/10" @click="$emit('okay')">Okay</button>
      <button type="button" class="min-h-[44px] flex-1 rounded-2xl bg-stone-100 text-sm dark:bg-white/10" @click="$emit('not-meant')">That's not what I meant</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Resource } from '~/lib/domain/crisis';

defineProps<{ resources: Resource[] }>();
defineEmits<{ (e: 'okay'): void; (e: 'not-meant'): void }>();
</script>
