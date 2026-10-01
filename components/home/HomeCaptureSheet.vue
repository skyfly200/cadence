<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-end bg-stone-900/30" @click.self="$emit('close')">
    <div class="mx-auto w-full max-w-md rounded-t-[2rem] bg-white p-5 pb-8 dark:bg-[#2A2645]" role="dialog" aria-label="Capture">
      <p class="font-serif text-xl">What's on your mind?</p>
      <textarea
        ref="box" v-model="draft" rows="3" maxlength="4000"
        class="mt-3 w-full rounded-2xl border border-stone-200 bg-stone-50 p-3 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
        placeholder="Say it or type it. I'll park it." @keydown.ctrl.enter="add" @keydown.meta.enter="add"
      />
      <p v-if="error" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ error }}</p>
      <div class="mt-3 flex gap-2">
        <button class="min-h-[44px] rounded-2xl bg-stone-100 px-4 text-sm dark:bg-white/10" @click="$emit('close')">Close</button>
        <button class="min-h-[44px] flex-1 rounded-2xl bg-[#E07A45] font-semibold text-white disabled:opacity-50" :disabled="!draft.trim() || busy" @click="add">{{ busy ? 'Adding…' : 'Add' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useGraphStore } from '~/stores/graph';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'said', msg: string): void }>();
const graph = useGraphStore();
const draft = ref('');
const error = ref('');
const busy = ref(false);
const box = ref<HTMLTextAreaElement | null>(null);

watch(() => props.open, async (o) => {
  if (o) { error.value = ''; await nextTick(); box.value?.focus(); }
});

async function add() {
  if (busy.value) return;
  busy.value = true;
  const r = await graph.capture(draft.value);
  busy.value = false;
  if (!r.ok) { error.value = r.message; return; }
  draft.value = '';
  emit('close');
  emit('said', r.reply);
}
</script>
