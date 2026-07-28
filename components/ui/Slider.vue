<template>
  <input
    type="range"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :class="cn('cadence-slider w-full', props.class)"
    @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
  />
</template>

<script setup lang="ts">
import { cn } from '~/lib/utils';
const props = withDefaults(defineProps<{
  modelValue?: number; min?: number; max?: number; step?: number; class?: string;
}>(), { modelValue: 0, min: 0, max: 100, step: 1 });
defineEmits<{ (e: 'update:modelValue', v: number): void }>();
</script>

<style>
.cadence-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 9999px;
  background: var(--muted);
  cursor: pointer;
}
.cadence-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: var(--primary);
  border: 2px solid var(--background);
}
.cadence-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: var(--primary);
  border: 2px solid var(--background);
}
</style>
