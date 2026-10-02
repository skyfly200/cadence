<template>
  <!-- One piece, drawn with its base at (0, 0) and growing upward (about 40 units at full size). -->
  <g :transform="`scale(${size})`" class="g-piece">
    <!-- plants: a stem and a head; blooms sit on the head -->
    <template v-if="isPlant">
      <path :d="`M0 0 Q ${lean} ${-height / 2} 0 ${-height}`" class="fill-none stroke-emerald-700 dark:stroke-emerald-300" stroke-width="2" stroke-linecap="round" />
      <ellipse cx="-5" :cy="-height * 0.35" rx="5" ry="2.4" transform="rotate(-25)" class="fill-emerald-500 dark:fill-emerald-300" />
      <ellipse cx="5" :cy="-height * 0.5" rx="5" ry="2.4" transform="rotate(25)" class="fill-emerald-600 dark:fill-emerald-200" />

      <template v-if="kind === 'fern'">
        <path v-for="n in 3" :key="n" :d="`M0 ${-n * height / 4} q -7 -3 -10 2 M0 ${-n * height / 4} q 7 -3 10 2`" class="fill-none stroke-emerald-600 dark:stroke-emerald-200" stroke-width="1.6" stroke-linecap="round" />
      </template>
      <template v-else-if="kind === 'lavender'">
        <ellipse v-for="n in 3" :key="n" cx="0" :cy="-height + (n - 1) * 4.5" rx="2.6" ry="3.6" class="g-glow fill-violet-500 dark:fill-violet-300" />
      </template>
      <template v-else-if="kind === 'tulip'">
        <path :d="`M-5 ${-height} q 0 -9 5 -9 q 5 0 5 9 q -5 4 -10 0 z`" class="g-glow fill-rose-500 dark:fill-rose-300" />
      </template>
      <template v-else-if="kind === 'sunflower'">
        <circle v-for="n in 8" :key="n" :cx="Math.cos(n * Math.PI / 4) * 6" :cy="-height + Math.sin(n * Math.PI / 4) * 6" r="2.8" class="g-glow fill-amber-400 dark:fill-amber-200" />
        <circle cx="0" :cy="-height" r="3.4" class="fill-amber-800 dark:fill-amber-500" />
      </template>
      <template v-else-if="kind === 'foxglove'">
        <circle v-for="n in 3" :key="n" :cx="n % 2 ? -3 : 3" :cy="-height + n * 5 - 3" :r="4 - n * 0.6" class="g-glow fill-fuchsia-500 dark:fill-fuchsia-300" />
      </template>
      <template v-else-if="kind === 'iris'">
        <path :d="`M0 ${-height} q -9 -4 -7 -12 q 6 2 7 12 z M0 ${-height} q 9 -4 7 -12 q -6 2 -7 12 z`" class="g-glow fill-indigo-500 dark:fill-indigo-300" />
        <path :d="`M0 ${-height} q -6 5 -9 2 q 5 -1 9 -2 z M0 ${-height} q 6 5 9 2 q -5 -1 -9 -2 z`" class="fill-indigo-300 dark:fill-indigo-200" />
      </template>
      <template v-else>
        <!-- sprout: a pair of leaves -->
        <ellipse cx="-4.5" :cy="-height" rx="5" ry="2.6" transform="rotate(-30)" class="fill-lime-500 dark:fill-lime-300" />
        <ellipse cx="4.5" :cy="-height" rx="5" ry="2.6" transform="rotate(30)" class="fill-lime-600 dark:fill-lime-200" />
      </template>

      <!-- one small bloom per kept period (up to five) -->
      <circle v-for="n in blooms" :key="`b${n}`" :cx="-9 + (n - 1) * 4.5" :cy="-height * 0.62 - ((n % 2) * 4)" r="2.2" class="g-glow fill-pink-400 dark:fill-pink-200" />
    </template>

    <!-- trees -->
    <template v-else-if="kind === 'oak'">
      <rect x="-2.2" y="-18" width="4.4" height="18" rx="1.5" class="fill-amber-900 dark:fill-amber-700" />
      <circle cx="-8" cy="-24" r="9" class="fill-emerald-600 dark:fill-emerald-400" />
      <circle cx="8" cy="-24" r="9" class="fill-emerald-500 dark:fill-emerald-300" />
      <circle cx="0" cy="-32" r="10" class="g-glow fill-emerald-600 dark:fill-emerald-300" />
    </template>
    <template v-else-if="kind === 'birch'">
      <rect x="-2" y="-30" width="4" height="30" rx="1.5" class="fill-stone-200 dark:fill-stone-300" />
      <path d="M-2 -20 h4 M-2 -12 h3 M-2 -26 h3" class="stroke-stone-500" stroke-width="1" />
      <ellipse cx="0" cy="-36" rx="10" ry="13" class="g-glow fill-lime-500 dark:fill-lime-300" />
    </template>
    <template v-else-if="kind === 'pine'">
      <rect x="-2" y="-10" width="4" height="10" class="fill-amber-900 dark:fill-amber-700" />
      <path d="M0 -42 L-11 -22 H11 Z M0 -34 L-13 -12 H13 Z M0 -24 L-15 -6 H15 Z" class="g-glow fill-teal-700 dark:fill-teal-300" />
    </template>

    <!-- ground pieces -->
    <template v-else-if="kind === 'mushroom'">
      <rect x="-1.8" y="-5" width="3.6" height="5" rx="1" class="fill-stone-100 dark:fill-stone-200" />
      <path d="M-7 -5 a7 6 0 0 1 14 0 z" class="g-glow fill-red-500 dark:fill-red-300" />
      <circle cx="-2.5" cy="-8" r="1" class="fill-white" /><circle cx="2.5" cy="-7" r="1" class="fill-white" />
    </template>
    <template v-else-if="kind === 'stone'">
      <ellipse cx="0" cy="-3" rx="8" ry="4.5" class="fill-stone-400 dark:fill-stone-500" />
      <ellipse cx="-2" cy="-4.5" rx="3.5" ry="1.6" class="fill-stone-300 dark:fill-stone-400" />
    </template>
    <template v-else-if="kind === 'clover'">
      <circle cx="-3" cy="-4" r="3" class="fill-green-500 dark:fill-green-300" />
      <circle cx="3" cy="-4" r="3" class="fill-green-500 dark:fill-green-300" />
      <circle cx="0" cy="-8" r="3" class="fill-green-600 dark:fill-green-200" />
    </template>
    <template v-else>
      <!-- lantern: a small lit lantern -->
      <rect x="-3.5" y="-12" width="7" height="10" rx="1.5" class="fill-stone-700 dark:fill-stone-300" />
      <rect x="-2" y="-10.5" width="4" height="7" rx="1" class="g-glow fill-amber-300 dark:fill-amber-200" />
      <path d="M-3 -12 q3 -5 6 0" class="fill-none stroke-stone-700 dark:stroke-stone-300" stroke-width="1.2" />
    </template>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PLANT_FOR_PERIOD, unit, type PieceKind, type Stage } from '~/lib/domain';

const props = defineProps<{ kind: PieceKind; stage: Stage; blooms?: number; scale?: number; id?: string }>();

const PLANTS: readonly PieceKind[] = Object.values(PLANT_FOR_PERIOD);
const isPlant = computed(() => PLANTS.includes(props.kind));
/** A seedling at stage 0 up to full height at stage 4; trees and ground pieces use the same ramp, more gently. */
const grow = computed(() => 0.5 + props.stage * 0.125);
const size = computed(() => (props.scale ?? 1) * (isPlant.value || props.kind === 'oak' || props.kind === 'birch' || props.kind === 'pine' ? grow.value : 1));
const height = computed(() => 22 + props.stage * 4);
const lean = computed(() => (unit(props.id ?? props.kind, 'lean') - 0.5) * 8);
const blooms = computed(() => Math.min(5, Math.max(0, props.blooms ?? 0)));
</script>
