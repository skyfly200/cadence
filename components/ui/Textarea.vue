<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    :class="cn(
      'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50',
      props.class,
    )"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

<script setup lang="ts">
import { cn } from '~/lib/utils';
const props = withDefaults(defineProps<{
  modelValue?: string; placeholder?: string; rows?: number; disabled?: boolean; class?: string;
}>(), { rows: 3 });
defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>
