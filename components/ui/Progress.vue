<template>
  <div :class="cn('relative w-full overflow-hidden rounded-full bg-muted', props.class)">
    <div
      class="h-full transition-all"
      :class="barClass || 'bg-primary'"
      :style="{ width: `${Math.max(0, Math.min(100, value))}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '~/lib/utils';
const props = withDefaults(defineProps<{ value?: number; class?: string; barClass?: string }>(), { value: 0 });
const { value, barClass } = props;
</script>
