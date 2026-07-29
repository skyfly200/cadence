<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="dialog">
        <div
          v-if="open"
          class="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('update:open', false)" />
          <div
            :class="cn(
              'relative z-10 w-full my-8 sm:my-0 rounded-xl border bg-background p-4 shadow-xl',
              contentClass || 'max-w-md',
            )"
            role="dialog"
            aria-modal="true"
            @keydown="$emit('keydown', $event)"
          >
            <button
              class="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              aria-label="Close"
              @click="$emit('update:open', false)"
            >
              <X class="size-4" />
            </button>
            <slot />
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { cn } from '~/lib/utils';

defineProps<{ open?: boolean; contentClass?: string }>();
defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'keydown', ev: KeyboardEvent): void;
}>();
</script>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.15s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
