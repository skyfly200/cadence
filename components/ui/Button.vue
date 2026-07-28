<template>
  <button :class="classes" :disabled="disabled" :type="type" :aria-label="ariaLabel" :title="title">
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '~/lib/utils';

const props = withDefaults(defineProps<{
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  size?: 'default' | 'sm' | 'icon';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  title?: string;
  class?: string;
}>(), {
  variant: 'default',
  size: 'default',
  type: 'button',
});

const variants: Record<string, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-border bg-background hover:bg-muted/50',
  ghost: 'hover:bg-muted/60',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  destructive: 'bg-destructive text-white hover:bg-destructive/90',
};
const sizes: Record<string, string> = {
  default: 'h-9 px-4 py-2 text-sm gap-1.5',
  sm: 'h-8 px-3 text-xs gap-1',
  icon: 'size-9',
};

const classes = computed(() => cn(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 whitespace-nowrap',
  variants[props.variant],
  sizes[props.size],
  props.class,
));
</script>
