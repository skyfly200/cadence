<template>
  <div class="min-h-dvh bg-[#EEF5F3] pb-16 text-slate-800 dark:bg-[#1D1A2F] dark:text-slate-100">
    <div class="mx-auto w-full max-w-md px-4 pt-6">
      <h1 class="font-serif text-2xl font-semibold">Connect an assistant</h1>

      <p v-if="state === 'loading'" class="mt-4 text-[15px] text-slate-600 dark:text-slate-300">One moment.</p>

      <!-- sign in first, with the app's own sign-in -->
      <section v-else-if="state === 'signin'" class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#2A2645]">
        <p class="mb-3 text-[15px]">Sign in to your Cadence account to continue.</p>
        <AuthDialog @done="check" />
      </section>

      <section v-else-if="state === 'ask'" class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#2A2645]">
        <p class="text-[17px]"><strong>{{ clientName }}</strong> would like to connect to your Cadence.</p>
        <fieldset class="mt-4 space-y-2">
          <legend class="sr-only">What it may do</legend>
          <label v-if="asked.includes('write')" class="flex min-h-[44px] items-start gap-3">
            <input v-model="choice" type="radio" value="read write" class="mt-1 size-5 shrink-0" />
            <span class="text-[15px]"><span class="font-medium">See what is next, add thoughts, log habits and finish tasks</span><br /><span class="text-slate-600 dark:text-slate-400">It can never delete or edit anything, and everything it adds can be undone in the app.</span></span>
          </label>
          <label class="flex min-h-[44px] items-start gap-3">
            <input v-model="choice" type="radio" value="read" class="mt-1 size-5 shrink-0" />
            <span class="text-[15px]"><span class="font-medium">Only see what is next</span><br /><span class="text-slate-600 dark:text-slate-400">Read only.</span></span>
          </label>
        </fieldset>
        <p class="mt-3 text-sm text-slate-600 dark:text-slate-400">Items you mark Private are never shown to it. You can disconnect it any time in Settings.</p>
        <div class="mt-4 flex gap-3">
          <button class="min-h-[44px] flex-1 rounded-xl bg-teal-700 px-4 text-[15px] font-medium text-white disabled:opacity-60 dark:bg-[#B9A6FF] dark:text-[#1D1A2F]" :disabled="busy" @click="allow">Allow</button>
          <button class="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-4 text-[15px] dark:border-white/20" :disabled="busy" @click="deny">Not now</button>
        </div>
        <p v-if="note" class="mt-3 text-sm text-amber-700 dark:text-amber-300">{{ note }}</p>
      </section>

      <section v-else class="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#2A2645]">
        <p class="text-[15px]">This connection request could not be read. Start again from the assistant.</p>
        <NuxtLink to="/" class="mt-3 inline-flex min-h-[44px] items-center text-[15px] text-teal-800 underline dark:text-[#B9A6FF]">Back to Cadence</NuxtLink>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '~/stores/app';
import { approveAuthorize, describeAuthorize, type AuthorizeQuery } from '~/lib/account-client';

useHead({ title: 'Connect an assistant' });

const route = useRoute();
const app = useAppStore();
const token = () => app.session?.access_token as string | undefined;

type State = 'loading' | 'signin' | 'ask' | 'bad';
const state = ref<State>('loading');
const clientName = ref('');
const asked = ref<string[]>(['read']);
const choice = ref('read');
const busy = ref(false);
const note = ref('');

/** The authorize request: only the query values the server expects, as plain strings. */
const query = (): AuthorizeQuery => {
  const out: AuthorizeQuery = {};
  for (const k of ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'code_challenge', 'code_challenge_method']) {
    const v = route.query[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
};

async function check() {
  await app.initAuth();
  if (!app.signedIn) { state.value = 'signin'; return; }
  const r = await describeAuthorize(query(), token());
  if (r.status === 'signed_out') { state.value = 'signin'; return; }
  if (r.status !== 'ok') { state.value = 'bad'; return; }
  clientName.value = r.data.clientName;
  asked.value = r.data.scope;
  choice.value = r.data.scope.includes('write') ? 'read write' : 'read';
  state.value = 'ask';
}

async function allow() {
  busy.value = true;
  note.value = '';
  const r = await approveAuthorize(query(), choice.value, token());
  busy.value = false;
  if (r.status === 'ok') { window.location.assign(r.data.redirect); return; }
  note.value = r.status === 'signed_out' ? 'Please sign in again.' : 'That did not go through. Please try again.';
}

/** "Not now" sends the browser back with access_denied. The address was already checked by the server. */
function deny() {
  const q = query();
  try {
    const url = new URL(q.redirect_uri ?? '');
    url.searchParams.set('error', 'access_denied');
    if (q.state) url.searchParams.set('state', q.state);
    window.location.assign(url.toString());
  } catch {
    state.value = 'bad';
  }
}

onMounted(check);
</script>
