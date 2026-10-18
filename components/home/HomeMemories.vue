<template>
  <div>
    <p class="mt-4 text-sm font-medium">What Cadence remembers</p>
    <p class="text-sm text-slate-600 dark:text-slate-300">Things you said in Discuss that Cadence keeps for next time. Only the few that fit a conversation are sent with it. Private ones are never sent.</p>
    <p v-if="!graph.memoryList.length" class="mt-2 text-sm text-slate-500 dark:text-slate-400">Nothing yet. Say "remember that…" in Discuss, or keep one it offers.</p>
    <ul v-else class="mt-2 space-y-2">
      <li v-for="m in graph.memoryList" :key="m.id" class="rounded-xl border border-slate-200 p-2 dark:border-white/10">
        <textarea
          v-if="editing === m.id" v-model="draft" rows="2" maxlength="300" aria-label="Memory"
          class="w-full rounded-lg border border-stone-200 bg-stone-50 p-2 text-[16px] dark:border-white/10 dark:bg-dusk"
        />
        <p v-else class="break-words text-sm">{{ m.text }}</p>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <label class="flex min-h-[36px] items-center gap-2">
            <input type="checkbox" class="size-4" :checked="m.private" @change="graph.editMemoryText(m.id, { private: ($event.target as HTMLInputElement).checked })" />
            Private
          </label>
          <span class="flex-1" />
          <template v-if="editing === m.id">
            <button type="button" class="min-h-[36px] rounded-lg px-2" @click="editing = null">Cancel</button>
            <button type="button" class="min-h-[36px] rounded-lg bg-stone-100 px-3 font-medium dark:bg-white/10" @click="save(m.id)">Save</button>
          </template>
          <template v-else>
            <button type="button" class="min-h-[36px] rounded-lg px-2 underline" @click="editing = m.id; draft = m.text">Edit</button>
            <button type="button" class="min-h-[36px] rounded-lg px-2 underline" @click="graph.forget(m.id)">Forget</button>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useGraphStore } from '~/stores/graph';

/** The memory list in Settings: read, edit, mark Private, forget. */
const graph = useGraphStore();
const editing = ref<string | null>(null);
const draft = ref('');

function save(id: string) {
  graph.editMemoryText(id, { text: draft.value });
  editing.value = null;
}
</script>
