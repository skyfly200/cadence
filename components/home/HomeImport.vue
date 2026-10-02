<template>
  <div>
    <p class="mt-5 font-serif text-xl">Import</p>
    <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
      Bring things in from Google. It is read-only: Cadence never changes anything in Google, and nothing is added from a document until you tap Keep.
      For Google Keep, copy a note and paste it into Add.
    </p>

    <p v-if="!signedIn" class="mt-2 text-sm text-slate-600 dark:text-slate-300">Sign in to import.</p>
    <p v-else-if="status && !status.configured" class="mt-2 text-sm text-slate-600 dark:text-slate-300">Google is not set up on this server yet.</p>
    <template v-else-if="status">
      <button v-if="!status.connected || needsReconnect" class="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 text-sm dark:border-white/10" :disabled="busy" @click="connect">
        {{ status.connected ? 'Reconnect Google to import' : 'Connect Google' }}
      </button>
      <template v-if="status.connected">
        <button class="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 text-sm disabled:opacity-50 dark:border-white/10" :disabled="busy || !status.canImportTasks" @click="importTasks">Import my open Google Tasks as ideas</button>
        <button class="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 text-sm disabled:opacity-50 dark:border-white/10" :disabled="busy || !status.canImportDocs" @click="importDoc">Pick a Google Doc to read for ideas</button>
      </template>
    </template>
    <p v-else class="mt-2 text-sm text-slate-500 dark:text-slate-400">One moment…</p>

    <p v-if="note" class="mt-2 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">{{ note }}</p>
    <ProposalCards v-if="docProposals.length" class="mt-3" :proposals="docProposals" :kept="kept" @keep="keep" />
  </div>
</template>

<script setup lang="ts">
/**
 * Settings: the Google imports. Tasks become Ideas (skipping ones already imported); a Doc picked with the
 * Google Picker is read on the server and run through extraction, and each proposal waits for a tap. Read-only.
 */
import { computed, reactive, ref, watch } from 'vue';
import { aiFetch } from '~/lib/ai-client';
import { fetchGoogleDoc, fetchGoogleTasks, getGoogleStatus, startGoogleConnect, type GoogleStatus } from '~/lib/google-import-client';
import { pickGoogleDoc } from '~/lib/google-picker';
import { importLine } from '~/lib/home/import';
import type { KeepChoice, LinkProposal, NodeProposal } from '~/lib/home/proposals';
import { useAppStore } from '~/stores/app';
import { useGraphStore } from '~/stores/graph';

const props = defineProps<{ signedIn: boolean }>();
const app = useAppStore();
const graph = useGraphStore();
const cfg = useRuntimeConfig();

const status = ref<GoogleStatus | null>(null);
const busy = ref(false);
const note = ref('');
const reconnectNeeded = ref(false);
const docProposals = ref<NodeProposal[]>([]);
const kept = reactive(new Map<string, string>());

const needsReconnect = computed(() => reconnectNeeded.value || (!!status.value?.connected && !(status.value.canImportTasks && status.value.canImportDocs)));
const token = () => app.session?.access_token;

// The session can arrive after the sheet opens (right after Google sends the user back), so load when it does.
watch(() => props.signedIn, async (signedIn) => {
  if (!signedIn) return;
  const r = await getGoogleStatus(token());
  status.value = r.status === 'ok' ? r.data : { configured: false, connected: false, email: null, canImportTasks: false, canImportDocs: false };
}, { immediate: true });

/** Send the browser to Google's consent screen (the server builds the URL and asks for every scope). */
async function connect() {
  busy.value = true;
  note.value = '';
  const r = await startGoogleConnect(token());
  busy.value = false;
  if (r.status === 'ok') { window.location.href = r.data.url; return; }
  note.value = r.status === 'failed' ? r.message : 'Sign in first.';
}

async function importTasks() {
  busy.value = true;
  note.value = '';
  const r = await fetchGoogleTasks(token());
  busy.value = false;
  if (r.status === 'ok') { note.value = importLine(graph.importTasks(r.data.tasks)); return; }
  if (r.status === 'reconnect') { reconnectNeeded.value = true; note.value = r.message; return; }
  note.value = r.status === 'failed' ? r.message : 'Sign in first.';
}

async function importDoc() {
  const apiKey = String(cfg.public.googlePickerApiKey || '');
  const clientId = String(cfg.public.googleClientId || '');
  if (!apiKey || !clientId) { note.value = 'Reading documents needs a Google Picker API key on this server.'; return; }
  busy.value = true;
  note.value = '';
  docProposals.value = [];
  kept.clear();
  try {
    const fileId = await pickGoogleDoc({ clientId, apiKey });
    if (!fileId) return;
    const doc = await fetchGoogleDoc(fileId, token());
    if (doc.status === 'reconnect') { reconnectNeeded.value = true; note.value = doc.message; return; }
    if (doc.status !== 'ok') { note.value = doc.status === 'failed' ? doc.message : 'Sign in first.'; return; }
    const r = await aiFetch<{ ok: true; nodes: NodeProposal[]; links: LinkProposal[] }>('/api/ai/extract', { text: doc.data.text }, { accessToken: token() });
    if (r.status === 'off') { note.value = 'AI is switched off, so documents cannot be read for ideas.'; return; }
    if (r.status !== 'ok') { note.value = 'The AI is not available right now.'; return; }
    docProposals.value = r.data.nodes;
    const first = doc.data.truncated ? 'It was a long document, so only the first part was read. ' : '';
    note.value = r.data.nodes.length
      ? `${first}Here is what I found. Nothing is saved unless you keep it.`
      : `${first}Nothing clear to propose from that document.`;
  } catch {
    note.value = 'Google could not open the picker. Check your connection and try again.';
  } finally {
    busy.value = false;
  }
}

function keep(p: NodeProposal, choice: KeepChoice) {
  const id = graph.keepProposedNode(p, choice);
  if (id) kept.set(p.ref, id);
}
</script>
