<template>
  <div class="min-h-dvh bg-sage pb-16 text-slate-800 dark:bg-dusk dark:text-slate-100">
    <div class="mx-auto w-full max-w-xl px-4 pt-4">
      <NuxtLink to="/" class="inline-flex min-h-[44px] items-center text-[15px] text-teal-800 underline dark:text-lavender">‹ Back to Cadence</NuxtLink>
      <h1 class="mt-2 font-serif text-2xl font-semibold">What Cadence knows and does</h1>
      <p class="mt-2 text-[15px] text-slate-600 dark:text-slate-300">Plain answers about where your things live, what is ever sent anywhere, and the switches that are yours.</p>

      <!-- AI switch -->
      <section class="mt-5 rounded-3xl bg-white p-5 shadow-sm dark:bg-dusk-card">
        <h2 class="font-serif text-lg">AI</h2>
        <label class="mt-2 flex min-h-[44px] items-start gap-3">
          <input type="checkbox" class="mt-1 size-5 shrink-0" :checked="aiOn" :disabled="aiBusy" @change="toggleAi(($event.target as HTMLInputElement).checked)" />
          <span class="text-[15px]"><span class="font-medium">Use AI</span><br /><span class="text-slate-600 dark:text-slate-400">Off, Cadence still works fully: it ranks and reminds on your device, and what you capture stays an Idea until you sort it.</span></span>
        </label>
        <p v-if="aiNote" class="mt-1 text-sm text-amber-700 dark:text-amber-300">{{ aiNote }}</p>
      </section>

      <!-- Where things live -->
      <section class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-dusk-card">
        <h2 class="font-serif text-lg">Where your things live</h2>
        <ul class="mt-2 list-disc space-y-2 pl-5 text-[15px]">
          <li><strong>On this device:</strong> everything you capture and plan, plus your display, sound and clock choices. Signed out, nothing leaves the device.</li>
          <li><strong>In your account (when signed in):</strong> the same items, so your devices stay in step. Only you can read them.</li>
          <li><strong>Google Calendar (if you connected it):</strong> the sign-in token is kept on the server, encrypted, and never in your browser.</li>
          <li><strong>Google data (Calendar and Docs):</strong> Cadence only reads it, and only to show your events or to import when you press Import. A Doc you pick is read once so its text can be turned into suggestions you choose to keep, and the document itself is not stored. Nothing from your Google account is shared with anyone else or used to train AI models, and Cadence never changes anything in your Google account. Disconnect Google in Settings at any time, and you can also remove Cadence at <a class="underline" href="https://myaccount.google.com/permissions" rel="noopener" target="_blank">myaccount.google.com/permissions</a>.</li>
          <li><strong>Notifications:</strong> a reminder is written on your device; the server only holds the time it should arrive and your browser's push address.</li>
          <li><strong>Voice:</strong> tap-to-talk uses your browser's own speech recognition.</li>
        </ul>
      </section>

      <!-- What each feature sends -->
      <section class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-dusk-card">
        <h2 class="font-serif text-lg">What each feature sends</h2>
        <ul class="mt-2 list-disc space-y-2 pl-5 text-[15px]">
          <li><strong>Capture, Now, Plan, Habits:</strong> nothing to any AI. The ranking and the Why now lines run on your device.</li>
          <li><strong>Polished Why now line:</strong> when AI is on, the title of your current item and its Why now line go to the AI to be reworded. Private items are never sent.</li>
          <li><strong>AI wording and sorting (when used):</strong> only the few items it needs, sent to the AI provider to answer, on a paid plan with retention off where the provider allows. <strong>Private</strong> items are never included.</li>
          <li><strong>Analytics:</strong> none.</li>
        </ul>
        <p class="mt-3 text-sm text-slate-600 dark:text-slate-400">To keep any single item away from the AI, open it with Edit and turn on <strong>Private</strong>.</p>
      </section>

      <!-- Export -->
      <section class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-dusk-card">
        <h2 class="font-serif text-lg">Export everything</h2>
        <p class="mt-2 text-[15px] text-slate-600 dark:text-slate-400">One file with everything on this device: your Home items and history, and the classic view's data.</p>
        <button class="mt-3 min-h-[44px] rounded-2xl bg-ember px-5 font-semibold text-white" @click="exportData">Download my data</button>
      </section>

      <!-- Delete -->
      <section class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-dusk-card">
        <h2 class="font-serif text-lg">Delete everything</h2>
        <template v-if="deletion.pending">
          <p class="mt-2 text-[15px]">Your data will be deleted on <strong>{{ purgeDate }}</strong>. Until then it is hidden on your devices and nothing new is saved. Changed your mind? You can undo.</p>
          <button class="mt-3 min-h-[44px] rounded-2xl bg-ember px-5 font-semibold text-white disabled:opacity-50" :disabled="deleteBusy" @click="undoDelete">Undo, keep my data</button>
        </template>
        <template v-else-if="app.signedIn">
          <p class="mt-2 text-[15px] text-slate-600 dark:text-slate-400">This clears your items and history from this device and from your account. You have 7 days to undo it, then it is gone for good. Your sign-in stays, so you can start fresh.</p>
          <button v-if="!confirming" class="mt-3 min-h-[44px] rounded-2xl border border-red-300 px-5 font-semibold text-red-700 dark:border-red-900 dark:text-red-300" @click="confirming = true">Delete everything…</button>
          <div v-else class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <p class="text-sm">Delete everything now? You can undo for 7 days.</p>
            <div class="mt-2 flex gap-2">
              <button class="min-h-[44px] flex-1 rounded-xl bg-white px-3 text-sm dark:bg-white/10" @click="confirming = false">Keep it</button>
              <button class="min-h-[44px] flex-1 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="deleteBusy" @click="requestDelete">Delete everything</button>
            </div>
          </div>
        </template>
        <template v-else>
          <p class="mt-2 text-[15px] text-slate-600 dark:text-slate-400">You are not signed in, so everything is only on this device. Deleting it here cannot be undone.</p>
          <button v-if="!confirming" class="mt-3 min-h-[44px] rounded-2xl border border-red-300 px-5 font-semibold text-red-700 dark:border-red-900 dark:text-red-300" @click="confirming = true">Delete from this device…</button>
          <div v-else class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <p class="text-sm">This cannot be undone.</p>
            <div class="mt-2 flex gap-2">
              <button class="min-h-[44px] flex-1 rounded-xl bg-white px-3 text-sm dark:bg-white/10" @click="confirming = false">Keep it</button>
              <button class="min-h-[44px] flex-1 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white" @click="wipeHere">Delete from this device</button>
            </div>
          </div>
        </template>
        <p v-if="deleteNote" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ deleteNote }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useAppStore } from '~/stores/app';
import { exportAllData } from '~/lib/local-storage';
import { buildExport, exportFilename } from '~/lib/export';
import { sendDeletionAction, type DeletionState } from '~/lib/account-client';
import { useAiSwitch } from '~/composables/useAiSwitch';
import { wipeLocalCache } from '~/lib/deletion';

useHead({ title: 'What Cadence knows and does' });

const app = useAppStore();
const token = () => app.session?.access_token as string | undefined;

const { aiOn, aiBusy, aiNote, toggleAi, loadAi } = useAiSwitch();
const deletion = reactive<DeletionState>({ pending: false, requestedAt: null, purgeAt: null });
const deleteBusy = ref(false);
const deleteNote = ref('');
const confirming = ref(false);

const purgeDate = computed(() => (deletion.purgeAt ? new Date(deletion.purgeAt).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : ''));

function exportData() {
  const doc = buildExport(exportAllData());
  const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFilename();
  a.click();
  URL.revokeObjectURL(url);
}

function apply(d: DeletionState) { deletion.pending = d.pending; deletion.requestedAt = d.requestedAt; deletion.purgeAt = d.purgeAt; }

async function requestDelete() {
  deleteBusy.value = true;
  deleteNote.value = '';
  const r = await sendDeletionAction('request', token());
  deleteBusy.value = false;
  if (r.status !== 'ok') { deleteNote.value = r.status === 'failed' ? r.message : 'Sign in again to do this.'; return; }
  apply(r.data);
  confirming.value = false;
  wipeLocalCache(); // hidden here right away; the server copy waits out the 7 days
}

async function undoDelete() {
  deleteBusy.value = true;
  deleteNote.value = '';
  const r = await sendDeletionAction('cancel', token());
  deleteBusy.value = false;
  if (r.status !== 'ok') { deleteNote.value = r.status === 'failed' ? r.message : 'Sign in again to do this.'; return; }
  apply(r.data);
  deleteNote.value = 'Kept. Your items will come back the next time Cadence syncs.';
}

function wipeHere() {
  wipeLocalCache();
  confirming.value = false;
  deleteNote.value = 'Deleted from this device.';
}

onMounted(async () => {
  await app.initAuth();
  const [r] = await Promise.all([app.signedIn ? sendDeletionAction('status', token()) : null, loadAi()]);
  if (r?.status === 'ok') apply(r.data);
});
</script>
