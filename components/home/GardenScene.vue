<template>
  <svg :class="['g-scene block w-full', motion ? 'shimmer' : '', resting ? 'opacity-80' : '']" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMax meet" role="img" :aria-label="label">
    <rect x="0" y="0" :width="W" :height="H" rx="18" class="fill-sky-100/70 dark:fill-[#262244]" />
    <circle :cx="W - 56" cy="38" r="16" class="fill-amber-200/80 dark:fill-[#FFB59F]/40" />
    <path :d="`M0 ${H * 0.62} Q ${W * 0.25} ${H * 0.55} ${W * 0.5} ${H * 0.61} T ${W} ${H * 0.58} V ${H} H 0 Z`" class="fill-emerald-200 dark:fill-[#2E2A52]" />
    <path :d="`M0 ${H * 0.78} Q ${W * 0.3} ${H * 0.72} ${W * 0.6} ${H * 0.77} T ${W} ${H * 0.75} V ${H} H 0 Z`" class="fill-emerald-300/80 dark:fill-[#34305C]" />
    <g v-for="p in sorted" :key="p.id" :transform="`translate(${PAD + p.x * (W - 2 * PAD)} ${TOP + p.y * SPAN}) scale(${ZOOM})`">
      <GardenPiece :kind="p.kind" :stage="p.stage" :blooms="p.blooms" :scale="p.scale" :id="p.id" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GardenPiece as Piece } from '~/lib/domain';

const props = defineProps<{ pieces: readonly Piece[]; motion?: boolean; resting?: boolean; label?: string }>();

const W = 480;
const H = 300;
const PAD = 36;
/** Pieces sit in a band across the lower hills, drawn larger than their own units. */
const TOP = 150;
const SPAN = 130;
const ZOOM = 2.2;
/** Back to front, so nearer pieces draw over the ones behind. */
const sorted = computed(() => [...props.pieces].sort((a, b) => a.y - b.y));
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
