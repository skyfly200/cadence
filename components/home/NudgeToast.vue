<template>
  <Teleport to="body">
    <div v-if="nudge" class="fixed inset-x-0 bottom-40 z-40 mx-auto flex w-fit max-w-sm flex-col gap-2 rounded-2xl bg-white p-4 shadow-lg dark:bg-dusk-card" role="alert">
      <div>
        <p class="font-semibold text-slate-900 dark:text-slate-100">{{ nudge.title }}</p>
        <p v-if="nudge.body" class="mt-1 text-sm text-slate-700 dark:text-slate-300">{{ nudge.body }}</p>
      </div>
      <div v-if="disclosure && !disclosed" class="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
        {{ disclosure }}
      </div>
      <div class="mt-2 flex gap-2">
        <button
          class="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300"
          @click="onNotNow"
        >
          Not now
        </button>
        <button
          class="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300"
          @click="openStop"
        >
          Stop these
        </button>
        <button
          v-if="!muted"
          class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300"
          title="Mute sound and speech"
          @click="onMute"
        >
          🔇
        </button>
        <button
          v-else
          class="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
          title="Unmute sound and speech"
          @click="onUnmute"
        >
          🔊
        </button>
      </div>

      <Transition name="slide">
        <div v-if="showStopMenu" class="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
          <p class="text-xs font-medium text-slate-600 dark:text-slate-400">Stop</p>
          <button
            class="mt-2 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm dark:border-white/10 dark:bg-white/5"
            @click="onStopKind"
          >
            All {{ kindLabel }}
          </button>
          <button
            v-if="nudge.nodeId && nodeTitle"
            class="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm dark:border-white/10 dark:bg-white/5"
            @click="onStopNode"
          >
            Just &quot;{{ nodeTitle }}&quot;
          </button>
          <button class="mt-2 text-xs text-slate-500 dark:text-slate-400" @click="showStopMenu = false">
            Cancel
          </button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Nudge } from '~/lib/domain';
import { useGraphStore } from '~/stores/graph';

defineProps<{
  nudge: Nudge | null;
  disclosed: boolean;
  muted: boolean;
}>();

const emit = defineEmits<{
  (e: 'not-now'): void;
  (e: 'stop-node'): void;
  (e: 'stop-kind'): void;
  (e: 'toggle-mute'): void;
}>();

const graph = useGraphStore();
const showStopMenu = ref(false);

const disclosure = 'Cadence can speak short nudges while it\'s open. You can mute it anytime.';

const kindLabel = computed(() => {
  if (!props.nudge) return '';
  const kind = props.nudge.kind;
  if (kind === 'leave_by') return 'time reminders';
  if (kind === 'at_risk') return 'at-risk alerts';
  if (kind === 'transition') return 'transition cues';
  if (kind === 'habit_summary') return 'habit summaries';
  if (kind === 'planning') return 'planning invitations';
  return kind;
});

const nodeTitle = computed(() => {
  if (!props.nudge?.nodeId) return '';
  const node = graph.nodes.find((n) => n.id === props.nudge!.nodeId);
  return node?.title ?? '';
});

function onNotNow(): void {
  emit('not-now');
}

function onStopNode(): void {
  emit('stop-node');
  showStopMenu.value = false;
}

function onStopKind(): void {
  emit('stop-kind');
  showStopMenu.value = false;
}

function onMute(): void {
  emit('toggle-mute');
}

function onUnmute(): void {
  emit('toggle-mute');
}

function openStop(): void {
  showStopMenu.value = !showStopMenu.value;
}
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
