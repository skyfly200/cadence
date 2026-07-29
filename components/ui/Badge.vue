<template>
  <span :class="cn(
    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
    variant === 'outline' ? 'border-border' : 'border-transparent bg-secondary text-secondary-foreground',
    props.class,
  )">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { cn } from '~/lib/utils';
const props = withDefaults(defineProps<{ variant?: 'default' | 'outline'; class?: string }>(), { variant: 'default' });
const { variant } = props;
</script>
