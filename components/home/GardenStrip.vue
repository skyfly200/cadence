<template>
  <button class="mt-3 block w-full overflow-hidden rounded-2xl bg-white p-2 text-left shadow-sm dark:bg-dusk-card" :aria-label="`Open the garden. ${caption}`" @click="$emit('open')">
    <GardenScene :pieces="graph.garden.pieces" :resting="graph.garden.resting" :motion="motion" label="Your garden this season" class="max-h-28" />
    <span class="mt-1 flex items-center justify-between gap-2 px-1 text-xs text-slate-600 dark:text-slate-300">
      <span>{{ caption }}</span>
      <span aria-hidden="true">Open ›</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getGardenMotion } from '~/lib/home/garden-state';
import { useGraphStore } from '~/stores/graph';

defineEmits<{ (e: 'open'): void }>();
const graph = useGraphStore();
const motion = ref(false);
onMounted(() => { motion.value = getGardenMotion(); });

const caption = computed(() => {
  const g = graph.garden;
  if (g.resting) return `A new ${g.season.name.toLowerCase()}. The garden is resting.`;
  return g.empty ? 'Things you keep will grow here.' : `${g.season.name} garden`;
});
</script>
