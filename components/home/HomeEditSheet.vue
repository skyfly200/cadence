<template>
  <div v-if="open && node" class="fixed inset-0 z-50 flex items-end bg-stone-900/30" @click.self="$emit('close')">
    <div class="mx-auto w-full max-w-md rounded-t-[2rem] bg-white p-5 pb-8 dark:bg-[#2A2645]" role="dialog" :aria-label="`Edit ${node.title}`">
      <p class="font-serif text-xl">Edit</p>

      <!-- Title -->
      <div class="mt-4">
        <label class="text-sm font-medium">Title</label>
        <input
          v-model="draft.title"
          type="text"
          class="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
          placeholder="Title"
        />
      </div>

      <!-- Fixed time (if commitment) -->
      <div v-if="node.kind === 'commitment'" class="mt-4">
        <label class="text-sm font-medium">Date and time</label>
        <div class="mt-1 flex gap-2">
          <input
            v-model="draft.fixedTime"
            type="datetime-local"
            class="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
          />
          <button
            v-if="draft.fixedTime"
            type="button"
            aria-label="Clear date and time"
            class="min-h-[44px] min-w-[44px] rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-white/15"
            @click="draft.fixedTime = ''"
          >
            <X class="size-4 mx-auto" />
          </button>
        </div>
      </div>

      <!-- Deadline (if commitment) -->
      <div v-if="node.kind === 'commitment'" class="mt-4">
        <label class="text-sm font-medium">Deadline</label>
        <div class="mt-1 flex gap-2">
          <input
            v-model="draft.deadline"
            type="datetime-local"
            class="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
          />
          <button
            v-if="draft.deadline"
            type="button"
            aria-label="Clear deadline"
            class="min-h-[44px] min-w-[44px] rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-white/15"
            @click="draft.deadline = ''"
          >
            <X class="size-4 mx-auto" />
          </button>
        </div>
      </div>

      <!-- Duration (if commitment) -->
      <div v-if="node.kind === 'commitment'" class="mt-4">
        <label class="text-sm font-medium">Duration (minutes)</label>
        <input
          v-model.number="draft.durationMinutes"
          type="number"
          min="1"
          class="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
          placeholder="30"
        />
      </div>

      <!-- Location (if commitment) -->
      <div v-if="node.kind === 'commitment'" class="mt-4">
        <label class="text-sm font-medium">Location</label>
        <div class="mt-1 flex gap-2">
          <input
            v-model="draft.location"
            type="text"
            class="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
            placeholder="Place name"
          />
          <button
            v-if="draft.location"
            type="button"
            aria-label="Clear location"
            class="min-h-[44px] min-w-[44px] rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-white/15"
            @click="draft.location = ''"
          >
            <X class="size-4 mx-auto" />
          </button>
        </div>
      </div>

      <!-- Link (commitment or habit) -->
      <div v-if="node.kind === 'commitment' || node.kind === 'habit'" class="mt-4">
        <label class="text-sm font-medium">Link</label>
        <input
          v-model="draft.link"
          type="url"
          inputmode="url"
          class="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
          placeholder="GitHub, Netlify, Docs, Notion, Trello…"
        />
        <p v-if="linkError" class="mt-1 text-sm text-amber-700 dark:text-amber-300">{{ linkError }}</p>
      </div>

      <!-- Dependency (if commitment) -->
      <div v-if="node.kind === 'commitment'" class="mt-4">
        <label class="text-sm font-medium">Depends on</label>
        <div class="mt-1 space-y-2">
          <select
            v-model="draft.dependencyId"
            class="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]"
          >
            <option value="">None</option>
            <option v-for="other in availableDependencies" :key="other.id" :value="other.id">
              {{ other.title }}
            </option>
          </select>
          <p v-if="dependencyError" class="text-xs text-red-600 dark:text-red-400">{{ dependencyError }}</p>
        </div>
      </div>

      <!-- Delete button -->
      <div class="mt-6 flex gap-2">
        <button
          type="button"
          class="min-h-[44px] rounded-xl bg-red-100 px-4 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
          @click="startDelete"
        >
          Delete
        </button>
      </div>

      <!-- Delete confirmation -->
      <div v-if="confirming" class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
        <p class="text-sm text-red-900 dark:text-red-300">Are you sure? This cannot be undone.</p>
        <div class="mt-2 flex gap-2">
          <button
            type="button"
            class="min-h-[44px] flex-1 rounded-xl bg-stone-100 text-sm font-medium dark:bg-white/10"
            @click="confirming = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="min-h-[44px] flex-1 rounded-xl bg-red-600 text-sm font-medium text-white hover:bg-red-700"
            @click="confirmDelete"
          >
            Yes, delete
          </button>
        </div>
      </div>

      <!-- Close button -->
      <div v-if="!confirming" class="mt-4 flex gap-2">
        <button
          type="button"
          class="min-h-[44px] flex-1 rounded-2xl bg-stone-100 text-sm dark:bg-white/10"
          @click="$emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="min-h-[44px] flex-1 rounded-2xl bg-[#E07A45] text-sm font-semibold text-white"
          @click="save"
        >
          Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, reactive } from 'vue';
import { X } from 'lucide-vue-next';
import { useGraphStore } from '~/stores/graph';
import type { Commitment, Idea, Node } from '~/lib/domain';
import { wouldCreateCycle } from '~/lib/home/edit';
import { cleanLink } from '~/lib/home/apps';

const props = defineProps<{ open: boolean; nodeId: string | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'deleted'): void }>();

const graph = useGraphStore();
const confirming = ref(false);
const dependencyError = ref('');

const node = computed(() => (props.nodeId ? graph.nodes.find((n) => n.id === props.nodeId) : null));

const draft = reactive({
  title: '',
  fixedTime: '',
  deadline: '',
  durationMinutes: null as number | null,
  location: '',
  dependencyId: '',
  link: '',
});
const linkError = ref('');

// Available commitments for dependency (excluding self, ideas, and those that would create cycles)
const availableDependencies = computed(() => {
  if (!node.value || node.value.kind !== 'commitment') return [];
  return graph.nodes.filter(
    (n) =>
      n.kind === 'commitment' &&
      n.id !== node.value!.id &&
      !wouldCreateCycle(graph.links, node.value!.id, n.id),
  );
});

watch(
  () => [props.open, node.value],
  () => {
    if (!props.open || !node.value) return;
    confirming.value = false;
    dependencyError.value = '';

    const c = node.value as Commitment | Idea;
    draft.title = c.title;
    linkError.value = '';
    draft.link = node.value.kind === 'commitment' || node.value.kind === 'habit' ? node.value.link ?? '' : '';

    if (c.kind === 'commitment') {
      draft.fixedTime = c.fixedTime ? toDatetimeLocal(c.fixedTime) : '';
      draft.deadline = c.deadline ? toDatetimeLocal(c.deadline) : '';
      draft.durationMinutes = c.durationMinutes ?? null;

      // Get current location from links
      const atLink = graph.links.find((l) => l.type === 'at' && l.fromId === c.id);
      const place = atLink ? graph.nodes.find((n) => n.id === atLink.toId) : null;
      draft.location = place && place.kind === 'thing' ? place.title : '';

      // Get current dependency from links
      const reqLink = graph.links.find((l) => l.type === 'requires' && l.fromId === c.id);
      draft.dependencyId = reqLink?.toId ?? '';
    }
  },
  { deep: false },
);

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  // Format as YYYY-MM-DDTHH:mm
  return d.toISOString().slice(0, 16);
}

function startDelete() {
  confirming.value = true;
}

function confirmDelete() {
  if (props.nodeId) {
    graph.removeNode(props.nodeId);
    emit('deleted');
    emit('close');
  }
}

watch(
  () => draft.dependencyId,
  (newVal) => {
    if (!node.value || node.value.kind !== 'commitment') return;
    if (!newVal) {
      dependencyError.value = '';
      return;
    }
    if (wouldCreateCycle(graph.links, node.value.id, newVal)) {
      dependencyError.value = 'This would create a cycle.';
    } else {
      dependencyError.value = '';
    }
  },
);

function save() {
  if (!node.value) return;
  const c = node.value as Commitment | Idea;

  const input: any = { title: draft.title };
  if (node.value.kind === 'commitment' || node.value.kind === 'habit') {
    const text = draft.link.trim();
    const cleaned = text ? cleanLink(text) : null;
    if (text && !cleaned) { linkError.value = 'That needs to be a link starting with https://'; return; }
    input.link = cleaned;
  }
  if (c.kind === 'commitment') {
    input.fixedTime = draft.fixedTime ? new Date(draft.fixedTime).toISOString() : null;
    input.deadline = draft.deadline ? new Date(draft.deadline).toISOString() : null;
    input.durationMinutes = draft.durationMinutes;
    input.location = draft.location || null;
    input.dependencyId = draft.dependencyId || null;
  }

  graph.edit(node.value.id, input);
  emit('close');
}

defineExpose({ save });
</script>
