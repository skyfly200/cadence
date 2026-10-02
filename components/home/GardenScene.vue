<template>
  <svg :class="['g-scene block w-full', motion ? 'shimmer' : '', resting ? 'opacity-80' : '']" viewBox="0 0 320 180" preserveAspectRatio="xMidYMax meet" role="img" :aria-label="label">
    <rect x="0" y="0" width="320" height="180" rx="18" class="fill-sky-100/70 dark:fill-[#262244]" />
    <path d="M0 150 Q 80 138 160 148 T 320 144 V 180 H 0 Z" class="fill-emerald-200 dark:fill-[#2E2A52]" />
    <path d="M0 164 Q 100 154 200 162 T 320 160 V 180 H 0 Z" class="fill-emerald-300/80 dark:fill-[#34305C]" />
    <g v-for="p in pieces" :key="p.id" :transform="`translate(${12 + p.x * 296} ${58 + p.y * 104})`">
      <GardenPiece :kind="p.kind" :stage="p.stage" :blooms="p.blooms" :scale="p.scale" :id="p.id" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import type { GardenPiece as Piece } from '~/lib/domain';

defineProps<{ pieces: readonly Piece[]; motion?: boolean; resting?: boolean; label?: string }>();
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
