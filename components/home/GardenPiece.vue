<template>
  <!-- One piece, drawn with its base at (0, 0) and growing upward (about 45 units at full size). -->
  <g :transform="`scale(${size})`" class="g-piece">
    <!-- a soft shadow on the ground under everything -->
    <ellipse cx="0" cy="0.5" :rx="shadowRx" ry="2.6" class="fill-emerald-900/15 dark:fill-black/25" />

    <!-- plants: a stem with alternate leaves, a head, and blooms on top -->
    <template v-if="isPlant">
      <!-- grass tufts at the base -->
      <path d="M-5 0 q-1 -5 -3 -7 M-4 0 q0 -4 -1 -6 M5 0 q1 -5 3 -7 M4 0 q0 -4 1 -6" class="fill-none stroke-emerald-600 dark:stroke-emerald-300" stroke-width="1" stroke-linecap="round" />

      <template v-if="kind !== 'fern'">
        <path :d="`M0 0 Q ${lean} ${-height / 2} 0 ${-height}`" class="fill-none stroke-emerald-700 dark:stroke-emerald-300" stroke-width="2.2" stroke-linecap="round" />
        <path :d="`M0.7 0 Q ${lean + 0.7} ${-height / 2} 0.7 ${-height}`" class="fill-none stroke-emerald-400/60 dark:stroke-emerald-100/40" stroke-width="0.7" stroke-linecap="round" />
        <!-- leaves, alternating sides, a midrib on each -->
        <g v-for="n in leafCount" :key="`l${n}`" :transform="`translate(${lean * 0.25} ${-height * 0.14 * n - 2}) scale(${n % 2 ? 1 : -1} 1) rotate(${-18 - (n % 3) * 6})`">
          <path d="M0 0 C 4 -5 11 -5 15 -1 C 11 3 4 3 0 0 z" :class="n % 2 ? 'fill-emerald-500 dark:fill-emerald-300' : 'fill-emerald-600 dark:fill-emerald-200'" />
          <path d="M1 0 Q 8 -2 14 -1" class="fill-none stroke-emerald-800/50 dark:stroke-emerald-900/50" stroke-width="0.6" />
        </g>
      </template>

      <!-- fern: arching fronds, each with paired leaflets -->
      <template v-if="kind === 'fern'">
        <g v-for="(f, i) in fronds" :key="`f${i}`" :transform="`rotate(${f.angle})`">
          <path :d="`M0 0 Q ${f.curve} ${-f.len * 0.55} ${f.curve * 1.6} ${-f.len}`" class="fill-none stroke-emerald-700 dark:stroke-emerald-300" stroke-width="1.6" stroke-linecap="round" />
          <g v-for="j in 6" :key="j" :transform="`translate(${f.curve * 1.6 * (j / 7) * (j / 7)} ${-f.len * (j / 7)})`">
            <path :d="`M0 0 l ${-(7 - j) * 1.5 - 2} ${-3 - (7 - j) * 0.3} M0 0 l ${(7 - j) * 1.5 + 2} ${-3 - (7 - j) * 0.3}`" :class="['fill-none', i % 2 ? 'stroke-emerald-500 dark:stroke-emerald-200' : 'stroke-emerald-600 dark:stroke-emerald-300']" stroke-width="1.4" stroke-linecap="round" />
          </g>
        </g>
      </template>
      <template v-else-if="kind === 'lavender'">
        <g :transform="`translate(0 ${-height})`">
          <ellipse v-for="n in 7" :key="n" :cx="(n % 2 ? -1.6 : 1.6)" :cy="-n * 2.6 + 6" :rx="3.2 - n * 0.2" ry="2.4" :class="['g-glow', n % 2 ? 'fill-violet-500 dark:fill-violet-300' : 'fill-purple-400 dark:fill-purple-200']" />
          <circle cx="0" cy="-14" r="1.6" class="g-glow fill-violet-600 dark:fill-violet-200" />
        </g>
      </template>
      <template v-else-if="kind === 'tulip'">
        <g :transform="`translate(0 ${-height})`">
          <path d="M-7 0 C -8 -9 -4 -13 0 -15 C 4 -13 8 -9 7 0 C 3 4 -3 4 -7 0 z" class="g-glow fill-rose-500 dark:fill-rose-300" />
          <path d="M-7 0 C -8 -8 -6 -12 -3 -14 C -1 -9 -2 -4 -3.5 2 z" class="fill-rose-600/80 dark:fill-rose-400/80" />
          <path d="M7 0 C 8 -8 6 -12 3 -14 C 1 -9 2 -4 3.5 2 z" class="fill-rose-400 dark:fill-rose-200" />
          <path d="M0 -15 C -2 -9 -2 -3 0 3 C 2 -3 2 -9 0 -15 z" class="fill-rose-500/70 dark:fill-rose-300/70" />
        </g>
      </template>
      <template v-else-if="kind === 'sunflower'">
        <g :transform="`translate(0 ${-height})`">
          <ellipse v-for="n in 14" :key="n" cx="0" cy="-8" rx="2" ry="4.4" :transform="`rotate(${n * 360 / 14})`" :class="['g-glow', n % 2 ? 'fill-amber-400 dark:fill-amber-200' : 'fill-yellow-300 dark:fill-yellow-100']" />
          <circle cx="0" cy="0" r="5.2" class="fill-amber-900 dark:fill-amber-600" />
          <circle cx="0" cy="0" r="3.2" class="fill-amber-950 dark:fill-amber-700" />
          <circle v-for="n in 6" :key="`s${n}`" :cx="Math.cos(n * Math.PI / 3) * 2.2" :cy="Math.sin(n * Math.PI / 3) * 2.2" r="0.5" class="fill-amber-300/70" />
        </g>
      </template>
      <template v-else-if="kind === 'foxglove'">
        <g :transform="`translate(0 ${-height})`">
          <g v-for="n in 5" :key="n" :transform="`translate(${n % 2 ? -3.5 : 3.5} ${n * 4.4 - 4}) scale(${1.15 - n * 0.14})`">
            <path d="M-4 -4 C -5 2 -3 6 0 6 C 3 6 5 2 4 -4 C 2 -6 -2 -6 -4 -4 z" class="g-glow fill-fuchsia-500 dark:fill-fuchsia-300" />
            <path d="M-4 -4 C -2 -6 2 -6 4 -4 C 2 -2 -2 -2 -4 -4 z" class="fill-fuchsia-300 dark:fill-fuchsia-100" />
            <circle cx="-1" cy="2" r="0.7" class="fill-fuchsia-950/70" /><circle cx="1.2" cy="3.4" r="0.6" class="fill-fuchsia-950/70" />
          </g>
          <circle cx="0" cy="-5" r="1.6" class="fill-fuchsia-300 dark:fill-fuchsia-100" />
        </g>
      </template>
      <template v-else-if="kind === 'iris'">
        <g :transform="`translate(0 ${-height})`">
          <path d="M0 0 C -4 -6 -3 -12 0 -15 C 3 -12 4 -6 0 0 z" class="g-glow fill-indigo-500 dark:fill-indigo-300" />
          <path d="M-1 -1 C -8 -4 -10 -10 -6 -13 C -3 -9 -2 -5 -1 -1 z" class="g-glow fill-indigo-600 dark:fill-indigo-400" />
          <path d="M1 -1 C 8 -4 10 -10 6 -13 C 3 -9 2 -5 1 -1 z" class="g-glow fill-indigo-600 dark:fill-indigo-400" />
          <path d="M-1 1 C -8 0 -11 4 -9 8 C -5 6 -2 4 -1 1 z" class="fill-indigo-300 dark:fill-indigo-200" />
          <path d="M1 1 C 8 0 11 4 9 8 C 5 6 2 4 1 1 z" class="fill-indigo-300 dark:fill-indigo-200" />
          <path d="M0 2 C -3 5 -3 9 0 11 C 3 9 3 5 0 2 z" class="fill-indigo-400 dark:fill-indigo-300" />
          <path d="M-3 4 q 3 -2 6 0" class="fill-none stroke-amber-400" stroke-width="1.2" stroke-linecap="round" />
        </g>
      </template>
      <template v-else>
        <!-- sprout: a pair of leaves, a seed at the foot -->
        <g :transform="`translate(0 ${-height})`">
          <path d="M0 0 C -4 -6 -12 -6 -15 0 C -11 5 -4 4 0 0 z" class="fill-lime-500 dark:fill-lime-300" />
          <path d="M0 0 C 4 -6 12 -6 15 0 C 11 5 4 4 0 0 z" class="fill-lime-600 dark:fill-lime-200" />
          <path d="M-1 0 Q -8 -1.5 -13 0 M1 0 Q 8 -1.5 13 0" class="fill-none stroke-lime-800/50" stroke-width="0.7" />
        </g>
        <ellipse cx="0" cy="-0.5" rx="3.4" ry="1.6" class="fill-amber-900/60 dark:fill-amber-700/70" />
      </template>

      <!-- one small bloom per kept period (up to five) -->
      <g v-for="n in blooms" :key="`b${n}`" :transform="`translate(${-12 + (n - 1) * 6} ${-height * 0.62 - ((n % 2) * 5)})`">
        <circle v-for="k in 5" :key="k" :cx="Math.cos(k * Math.PI * 0.4) * 1.9" :cy="Math.sin(k * Math.PI * 0.4) * 1.9" r="1.5" class="g-glow fill-pink-400 dark:fill-pink-200" />
        <circle cx="0" cy="0" r="1.1" class="fill-amber-300" />
      </g>
    </template>

    <!-- trees -->
    <template v-else-if="kind === 'oak'">
      <path d="M-4 0 C -3 -8 -2.5 -14 -2.6 -20 L 2.6 -20 C 2.5 -14 3 -8 4.5 0 z" class="fill-amber-900 dark:fill-amber-700" />
      <path d="M-1 0 C -1 -8 -1 -14 -1 -20 M1.5 -2 C 1.5 -8 1.2 -12 1.2 -17" class="fill-none stroke-amber-950/40" stroke-width="0.7" />
      <path d="M0 -14 L -8 -22 M0 -15 L 7 -23" class="fill-none stroke-amber-900 dark:stroke-amber-700" stroke-width="2" stroke-linecap="round" />
      <circle cx="-10" cy="-25" r="9" class="fill-emerald-700 dark:fill-emerald-500" />
      <circle cx="10" cy="-26" r="9.5" class="fill-emerald-600 dark:fill-emerald-400" />
      <circle cx="0" cy="-35" r="12" class="g-glow fill-emerald-600 dark:fill-emerald-300" />
      <circle cx="-4" cy="-26" r="8" class="fill-emerald-500 dark:fill-emerald-300" />
      <circle cx="5" cy="-38" r="6" class="fill-emerald-400/70 dark:fill-emerald-200/70" />
      <circle cx="-8" cy="-37" r="4.5" class="fill-emerald-400/60 dark:fill-emerald-200/60" />
      <circle cx="-9" cy="-23" r="1.4" class="fill-red-400" /><circle cx="9" cy="-28" r="1.4" class="fill-red-400" /><circle cx="2" cy="-31" r="1.4" class="fill-red-400" />
    </template>
    <template v-else-if="kind === 'birch'">
      <path d="M-2.4 0 L -2 -34 L 2 -34 L 2.6 0 z" class="fill-stone-100 dark:fill-stone-200" />
      <path d="M-2.3 -6 h2.4 M0.5 -11 h2 M-2.2 -17 h2.6 M0.2 -23 h2.2 M-2 -29 h2" class="stroke-stone-700 dark:stroke-stone-600" stroke-width="1.2" stroke-linecap="round" />
      <path d="M0 -26 L -9 -34 M0 -22 L 9 -31" class="fill-none stroke-stone-200 dark:stroke-stone-300" stroke-width="1.6" stroke-linecap="round" />
      <ellipse cx="0" cy="-42" rx="11" ry="14" class="g-glow fill-lime-500 dark:fill-lime-300" />
      <ellipse cx="-9" cy="-33" rx="6.5" ry="9" class="fill-lime-600 dark:fill-lime-400" />
      <ellipse cx="9" cy="-31" rx="6" ry="8.5" class="fill-lime-500 dark:fill-lime-300" />
      <ellipse cx="-2" cy="-46" rx="5" ry="7" class="fill-lime-300/70 dark:fill-lime-100/60" />
      <path d="M-11 -26 q-1 5 0 8 M-5 -28 q-1 5 0 9 M10 -24 q1 4 0 7" class="fill-none stroke-lime-600 dark:stroke-lime-300" stroke-width="1" stroke-linecap="round" />
    </template>
    <template v-else-if="kind === 'pine'">
      <rect x="-2.2" y="-12" width="4.4" height="12" class="fill-amber-900 dark:fill-amber-700" />
      <path d="M0 -50 L -9 -30 H 9 Z" class="g-glow fill-teal-700 dark:fill-teal-300" />
      <path d="M0 -40 L -12 -19 H 12 Z" class="fill-teal-800 dark:fill-teal-400" />
      <path d="M0 -29 L -15 -7 H 15 Z" class="fill-teal-700 dark:fill-teal-300" />
      <path d="M0 -50 L 0 -30 L 9 -30 Z M0 -40 L 0 -19 L 12 -19 Z M0 -29 L 0 -7 L 15 -7 Z" class="fill-white/15" />
      <path d="M-6 -30 q3 2 6 0 q3 2 6 0 M-8 -19 q4 2 8 0 q4 2 8 0 M-10 -8 q5 2 10 0 q5 2 10 0" class="fill-none stroke-teal-950/40" stroke-width="0.8" stroke-linecap="round" />
    </template>

    <!-- ground pieces -->
    <template v-else-if="kind === 'mushroom'">
      <g>
        <path d="M-2 0 C -2.4 -4 -2.2 -7 -2 -9 L 2 -9 C 2.2 -7 2.4 -4 2 0 z" class="fill-stone-100 dark:fill-stone-200" />
        <path d="M-9 -9 C -9 -17 9 -17 9 -9 C 5 -7 -5 -7 -9 -9 z" class="g-glow fill-red-500 dark:fill-red-300" />
        <path d="M-9 -9 C -5 -7 5 -7 9 -9" class="fill-none stroke-red-900/40" stroke-width="0.8" />
        <circle cx="-4" cy="-13" r="1.4" class="fill-white" /><circle cx="2" cy="-14" r="1.6" class="fill-white" /><circle cx="5.5" cy="-11" r="1" class="fill-white" />
      </g>
      <g transform="translate(10 0) scale(0.6)">
        <path d="M-2 0 C -2.4 -4 -2.2 -7 -2 -9 L 2 -9 C 2.2 -7 2.4 -4 2 0 z" class="fill-stone-100 dark:fill-stone-200" />
        <path d="M-9 -9 C -9 -17 9 -17 9 -9 C 5 -7 -5 -7 -9 -9 z" class="fill-red-400 dark:fill-red-200" />
        <circle cx="-3" cy="-12.5" r="1.4" class="fill-white" /><circle cx="3" cy="-12" r="1.2" class="fill-white" />
      </g>
    </template>
    <template v-else-if="kind === 'stone'">
      <path d="M-11 0 C -12 -6 -7 -10 0 -10 C 7 -10 12 -6 11 0 z" class="fill-stone-400 dark:fill-stone-500" />
      <path d="M-8 -4 C -7 -8 -3 -10 0 -10 C -4 -8 -5 -5 -5 -3 z" class="fill-stone-300 dark:fill-stone-400" />
      <path d="M2 -2 L 5 -7 L 9 -3 z" class="fill-stone-500/60 dark:fill-stone-600/60" />
      <path d="M-11 0 C -9 -3 -5 -3 -3 -1 C -6 0.5 -9 0.5 -11 0 z" class="fill-emerald-600/80 dark:fill-emerald-400/70" />
      <path d="M3 0 C 4 -2 7 -2 9 -1 z" class="fill-emerald-600/80 dark:fill-emerald-400/70" />
      <g transform="translate(13 0)"><ellipse cx="0" cy="-2" rx="4" ry="2.6" class="fill-stone-400 dark:fill-stone-500" /><ellipse cx="-1" cy="-3" rx="1.8" ry="0.9" class="fill-stone-300 dark:fill-stone-400" /></g>
    </template>
    <template v-else-if="kind === 'clover'">
      <path d="M0 0 Q 1 -4 0 -7" class="fill-none stroke-green-700 dark:stroke-green-300" stroke-width="1.2" />
      <g v-for="a in [0, 90, 180, 270]" :key="a" :transform="`translate(0 -9) rotate(${a})`">
        <path d="M0 0 C -4 -2 -4 -7 0 -7 C 4 -7 4 -2 0 0 z" :class="a % 180 ? 'fill-green-500 dark:fill-green-300' : 'fill-green-600 dark:fill-green-200'" />
        <path d="M0 -1 L 0 -5 M-2 -4 q2 -1 4 0" class="fill-none stroke-white/50" stroke-width="0.7" stroke-linecap="round" />
      </g>
      <g transform="translate(11 0) scale(0.6)">
        <path d="M0 0 Q 1 -4 0 -7" class="fill-none stroke-green-700 dark:stroke-green-300" stroke-width="1.2" />
        <g v-for="a in [0, 120, 240]" :key="a" :transform="`translate(0 -8) rotate(${a})`"><path d="M0 0 C -4 -2 -4 -7 0 -7 C 4 -7 4 -2 0 0 z" class="fill-green-500 dark:fill-green-300" /></g>
      </g>
    </template>
    <template v-else>
      <!-- lantern: a small lit lantern with a handle, a glass pane and a flame -->
      <path d="M-4 -17 q4 -8 8 0" class="fill-none stroke-stone-700 dark:stroke-stone-300" stroke-width="1.3" />
      <rect x="-5.5" y="-17" width="11" height="2.6" rx="1" class="fill-stone-700 dark:fill-stone-300" />
      <path d="M-4.4 -14.4 H 4.4 L 5 -3 H -5 z" class="g-glow fill-amber-300 dark:fill-amber-200" />
      <path d="M0 -12.5 C -2 -9.5 -1.6 -6.5 0 -5.6 C 1.6 -6.5 2 -9.5 0 -12.5 z" class="fill-orange-500 dark:fill-orange-400" />
      <path d="M0 -4.4 V -14.4 M-4.7 -9 H 4.7" class="fill-none stroke-stone-700/70 dark:stroke-stone-300/70" stroke-width="0.7" />
      <rect x="-6" y="-3" width="12" height="3" rx="1" class="fill-stone-700 dark:fill-stone-300" />
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
/** More leaves as it grows. */
const leafCount = computed(() => 2 + Math.min(props.stage, 3));
const shadowRx = computed(() => (isPlant.value ? 8 : props.kind === 'pine' ? 14 : props.kind === 'oak' ? 15 : props.kind === 'birch' ? 10 : 9));
/** A fern is a fan of arching fronds; more of them as it grows. */
const fronds = computed(() => {
  const n = 3 + Math.min(props.stage, 3);
  const len = height.value * 0.9;
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    return { angle: t * 70, curve: t * 10 + (i % 2 ? 2 : -2), len: len * (1 - Math.abs(t) * 0.35) };
  });
});
</script>
