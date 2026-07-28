<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="fixed bottom-3 right-3 z-[100] flex flex-col gap-2 w-[calc(100%-1.5rem)] max-w-sm">
        <TransitionGroup name="toast">
          <div
            v-for="t in toasts"
            :key="t.id"
            :class="cn(
              'rounded-md border shadow-lg px-3 py-2 bg-background text-foreground text-sm',
              t.variant === 'destructive' && 'border-destructive/50 bg-destructive/5',
            )"
            role="status"
          >
            <p v-if="t.title" class="font-medium text-xs sm:text-sm">{{ t.title }}</p>
            <p v-if="t.description" class="text-[11px] text-muted-foreground mt-0.5">{{ t.description }}</p>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { cn } from '~/lib/utils';
import { useToast } from '~/composables/useToast';

const { toasts } = useToast();
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
