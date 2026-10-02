<template>
  <section aria-labelledby="connected-assistants">
    <p id="connected-assistants" class="mt-5 font-serif text-xl">Connected assistants</p>
    <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Assistants you have allowed to see what is next, and to add thoughts, log habits and finish tasks. Private items are never shown to them.</p>

    <p v-if="!app.signedIn" class="mt-2 text-sm text-slate-500 dark:text-slate-400">Sign in to connect an assistant.</p>
    <template v-else>
      <p v-if="loading" class="mt-2 text-sm text-slate-500 dark:text-slate-400">One moment.</p>
      <p v-else-if="!items.length" class="mt-2 text-sm text-slate-500 dark:text-slate-400">None connected. In Claude, add a custom connector with the address below.</p>
      <ul v-else class="mt-2 space-y-2">
        <li v-for="c in items" :key="c.id" class="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ c.name }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ c.scope.includes('write') ? 'Can add and finish things' : 'Read only' }} · {{ lastUsed(c) }}</p>
          </div>
          <button class="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm dark:border-white/10" :disabled="busyId === c.id" @click="revoke(c.id)">Revoke</button>
        </li>
      </ul>
      <p v-if="note" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ note }}</p>
      <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">Connector address: <code class="break-all">{{ address }}</code></p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAppStore } from '~/stores/app';
import { listAssistants, revokeAssistant, type AssistantConnection } from '~/lib/account-client';

const app = useAppStore();
const config = useRuntimeConfig();
const items = ref<AssistantConnection[]>([]);
const loading = ref(false);
const busyId = ref('');
const note = ref('');
const token = () => app.session?.access_token as string | undefined;
const address = computed(() => `${String(config.public.siteUrl || '').replace(/\/+$/, '')}/mcp`);

const lastUsed = (c: AssistantConnection) =>
  c.lastUsedAt ? `last used ${new Date(c.lastUsedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'not used yet';

async function load() {
  if (!app.signedIn) return;
  loading.value = true;
  const r = await listAssistants(token());
  loading.value = false;
  if (r.status === 'ok') items.value = r.data.connections;
  else note.value = r.status === 'failed' ? r.message : '';
}

async function revoke(id: string) {
  busyId.value = id;
  note.value = '';
  const r = await revokeAssistant(id, token());
  busyId.value = '';
  if (r.status === 'ok') items.value = items.value.filter((c) => c.id !== id);
  else note.value = r.status === 'failed' ? r.message : 'Please sign in again.';
}

onMounted(load);
watch(() => app.signedIn, load);
</script>
