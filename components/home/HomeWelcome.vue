<template>
  <div v-if="open" class="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <div class="w-full max-w-md rounded-t-3xl bg-white p-6 text-slate-800 sm:rounded-3xl dark:bg-dusk-card dark:text-slate-100">
      <p class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-lavender">{{ step + 1 }} of {{ STEPS.length }}</p>
      <h2 id="welcome-title" class="mt-1 font-serif text-2xl font-semibold">{{ STEPS[step]!.title }}</h2>
      <p class="mt-2 text-[15px]">{{ STEPS[step]!.body }}</p>
      <p v-if="STEPS[step]!.link" class="mt-2 text-[15px]"><NuxtLink :to="STEPS[step]!.link" class="underline">What Cadence knows and does</NuxtLink></p>
      <div class="mt-6 flex gap-2">
        <button class="min-h-[44px] rounded-2xl px-4 text-[15px] text-slate-600 dark:text-slate-300" @click="$emit('close')">Skip</button>
        <button class="min-h-[44px] flex-1 rounded-2xl bg-ember font-semibold text-white" @click="next">{{ step === STEPS.length - 1 ? 'Start' : 'Next' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const STEPS: { title: string; body: string; link?: string }[] = [
  { title: 'Say it, and it is kept', body: 'Tap the mic or type in the capture box. Whatever is on your mind is saved at once; sorting it out can wait.' },
  { title: 'One thing at a time', body: 'Home shows a single card for what to do now, and a small strip of what is coming. "Not now" and "Park" are always fine; nothing is ever marked as failed.' },
  { title: 'You choose what the AI sees', body: 'The AI is optional and can be switched off. Anything marked Private never leaves your device, and you can export or delete your data at any time.', link: '/privacy' },
];
const step = ref(0);
watch(() => props.open, (o) => { if (o) step.value = 0; });
function next() { if (step.value < STEPS.length - 1) step.value += 1; else emit('close'); }
</script>
