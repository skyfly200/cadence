<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :min="min"
    :max="max"
    :step="step"
    :aria-label="ariaLabel"
    :class="cn(
      'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50',
      props.class,
    )"
    @input="onInput"
    @keydown="$emit('keydown', $event)"
  />
</template>

<script setup lang="ts">
import { cn } from '~/lib/utils';

const props = withDefaults(defineProps<{
  modelValue?: string | number;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  ariaLabel?: string;
  class?: string;
}>(), { type: 'text' });

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void;
  (e: 'keydown', ev: KeyboardEvent): void;
}>();

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
</script>
