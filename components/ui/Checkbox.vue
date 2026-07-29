<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="checked"
    :aria-label="ariaLabel"
    :class="cn(
      'shrink-0 rounded border shadow-sm flex items-center justify-center transition-colors',
      checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-transparent',
      props.class,
    )"
    @click.stop="$emit('change', !checked)"
  >
    <Check v-if="checked" class="size-3" />
  </button>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { cn } from '~/lib/utils';
const props = defineProps<{ checked?: boolean; ariaLabel?: string; class?: string }>();
defineEmits<{ (e: 'change', v: boolean): void }>();
</script>
