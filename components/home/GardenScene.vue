<template>
  <svg :class="['g-scene block w-full', motion ? 'shimmer' : '', resting ? 'opacity-80' : '']" :viewBox="`0 0 ${layout.width} ${layout.height}`" preserveAspectRatio="xMidYMax meet" role="img" :aria-label="label">
    <rect x="0" y="0" :width="layout.width" :height="layout.height" rx="18" class="fill-sky-100/70 dark:fill-[#262244]" />
    <circle :cx="layout.width - 56" cy="38" r="16" class="fill-amber-200/80 dark:fill-[#FFB59F]/40" />
    <path :d="`M0 ${TOP - 25} Q ${layout.width * 0.25} ${TOP - 55} ${layout.width * 0.5} ${TOP - 28} T ${layout.width} ${TOP - 38} V ${layout.height} H 0 Z`" class="fill-emerald-200 dark:fill-[#2E2A52]" />
    <path :d="`M0 ${TOP + 40} Q ${layout.width * 0.3} ${TOP + 15} ${layout.width * 0.6} ${TOP + 35} T ${layout.width} ${TOP + 28} V ${layout.height} H 0 Z`" class="fill-emerald-300/80 dark:fill-[#34305C]" />
    <g v-for="p in drawn" :key="p.id" :transform="`translate(${p.x} ${p.y}) scale(${ZOOM})`">
      <GardenPiece :kind="p.kind" :stage="p.stage" :blooms="p.blooms" :scale="p.scale" :id="p.id" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GardenPiece as Piece } from '~/lib/domain';
import { TOP, ZOOM, layoutGarden } from '~/lib/home/garden-layout';

const props = defineProps<{ pieces: readonly Piece[]; motion?: boolean; resting?: boolean; label?: string }>();

/** Every piece gets its own spot, and the scene grows taller when the garden is getting full. */
const layout = computed(() => layoutGarden(props.pieces));
/** Back to front, so nearer pieces draw over the ones behind. */
const drawn = computed(() => {
  const at = new Map(layout.value.placed.map((p) => [p.id, p]));
  return props.pieces.map((p) => ({ ...p, x: at.get(p.id)!.x, y: at.get(p.id)!.y })).sort((a, b) => a.y - b.y);
});
</script>

<style scoped>
/* A soft glow on flowers, crowns and lanterns in the dark scheme. Still by default. */
:global(.dark) .g-scene :deep(.g-glow) { filter: drop-shadow(0 0 3px rgba(185, 166, 255, 0.7)); }
@media (prefers-reduced-motion: no-preference) {
  .shimmer :deep(.g-glow) { animation: garden-shimmer 8s ease-in-out infinite; }
}
@keyframes garden-shimmer {
  0%, 100% { opacity: 0.82; }
  50% { opacity: 1; }
}
</style>
