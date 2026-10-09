<template>
  <button
    type="button"
    :aria-pressed="on"
    :aria-label="on ? 'Replies are spoken. Tap for text only' : 'Replies are text only. Tap to hear them too'"
    :title="on ? 'Spoken replies on' : 'Spoken replies off'"
    class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-white/15"
    @click="toggle"
  >
    <Volume2 v-if="on" class="size-5" />
    <VolumeX v-else class="size-5" />
  </button>
</template>

<script setup lang="ts">
import { Volume2, VolumeX } from 'lucide-vue-next';
import { setSpeakReplies } from '~/lib/home/prefs';

/** Spoken replies on or off; remembered on this device. */
const on = defineModel<boolean>({ required: true });

function toggle() {
  on.value = !on.value;
  setSpeakReplies(on.value);
  if (!on.value) window.speechSynthesis?.cancel();
}
</script>
