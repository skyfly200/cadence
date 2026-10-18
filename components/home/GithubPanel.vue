<template>
  <section aria-labelledby="github-panel" class="rounded-2xl bg-white p-4 dark:bg-dusk-card">
    <div class="flex items-center justify-between gap-3">
      <p id="github-panel" class="font-serif text-xl">GitHub</p>
      <button v-if="status?.connected" class="min-h-[44px] rounded-xl px-3 text-sm text-slate-500 hover:bg-stone-100 dark:text-slate-400 dark:hover:bg-white/10" :disabled="loading" @click="loadDigest">Refresh</button>
    </div>

    <p v-if="!app.authReady" class="mt-1 text-sm text-slate-500 dark:text-slate-400">One moment.</p>
    <p v-else-if="!app.signedIn" class="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to connect GitHub. The token is kept encrypted on the server, not in this browser.</p>
    <p v-else-if="!status" class="mt-1 text-sm text-slate-500 dark:text-slate-400">One moment.</p>
    <p v-else-if="!status.configured" class="mt-1 text-sm text-slate-500 dark:text-slate-400">GitHub is not set up on the server yet (it needs CADENCE_TOKEN_KEY and SUPABASE_SERVICE_ROLE_KEY).</p>

    <template v-else-if="!status.connected">
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">See pull requests waiting on you, your own pull requests with their checks, and issues assigned to you, in one place. Cadence only reads.</p>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Make a
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" class="text-teal-700 underline underline-offset-2 dark:text-lavender">fine-grained token</a>
        with access to all repositories and read-only Pull requests, Issues and Commit statuses, then paste it here.
      </p>
      <form class="mt-2 flex gap-2" @submit.prevent="connect">
        <input v-model="token" type="password" autocomplete="off" placeholder="github_pat_…" aria-label="GitHub token"
          class="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[16px] outline-none dark:border-white/10 dark:bg-dusk" />
        <button type="submit" class="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-lavender dark:text-dusk" :disabled="busy || !token.trim()">Connect</button>
      </form>
    </template>

    <template v-else>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Linked as {{ status.login }}</p>
      <p v-if="loading && !digest" class="mt-3 text-sm text-slate-500 dark:text-slate-400">Looking at GitHub.</p>
      <div v-else-if="digest" class="mt-3 space-y-4">
        <div v-for="g in groups" :key="g.k">
          <h3 class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-lavender">{{ g.n }} <span class="font-normal text-slate-400">{{ digest[g.k].count }}</span></h3>
          <ul v-if="digest[g.k].items.length" class="mt-1.5 space-y-1">
            <li v-for="i in digest[g.k].items" :key="i.url">
              <a :href="i.url" target="_blank" rel="noopener noreferrer" class="flex min-h-[44px] flex-col justify-center rounded-xl px-2 hover:bg-stone-100 dark:hover:bg-white/5">
                <span class="text-[15px]">{{ i.title }}</span>
                <span class="text-xs text-slate-500 dark:text-slate-400">
                  {{ i.repo }}#{{ i.number }}<template v-if="g.k === 'reviewRequested' && i.author"> · {{ i.author }}</template>
                  <template v-for="s in states(i)" :key="s.t"> · <span :class="s.warn ? 'text-amber-700 dark:text-amber-300' : ''">{{ s.t }}</span></template>
                </span>
              </a>
            </li>
          </ul>
          <p v-else class="mt-1 text-sm text-slate-400">Nothing here.</p>
        </div>
      </div>
      <button class="mt-4 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm dark:border-white/10" :disabled="busy" @click="disconnect">Unlink GitHub</button>
    </template>

    <p v-if="note" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ note }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useAppStore } from '~/stores/app';
import { connectGithub, disconnectGithub, getGithubDigest, getGithubStatus, type GithubDigest, type GithubItem, type GithubStatus } from '~/lib/github-client';

const app = useAppStore();
const status = ref<GithubStatus | null>(null);
const digest = ref<GithubDigest | null>(null);
const token = ref('');
const loading = ref(false);
const busy = ref(false);
const note = ref('');
const auth = () => app.session?.access_token as string | undefined;

const groups: { k: 'reviewRequested' | 'myPullRequests' | 'assigned'; n: string }[] = [
  { k: 'reviewRequested', n: 'Waiting on your review' },
  { k: 'myPullRequests', n: 'Your pull requests' },
  { k: 'assigned', n: 'Assigned to you' },
];

function states(i: GithubItem): { t: string; warn: boolean }[] {
  const out: { t: string; warn: boolean }[] = [];
  if (i.draft) out.push({ t: 'draft', warn: false });
  if (i.checks === 'failing') out.push({ t: 'checks failing', warn: true });
  else if (i.checks === 'pending') out.push({ t: 'checks running', warn: false });
  else if (i.checks === 'passing') out.push({ t: 'checks pass', warn: false });
  if (i.conflict) out.push({ t: 'merge conflict', warn: true });
  if (i.review === 'changes_requested') out.push({ t: 'changes requested', warn: true });
  else if (i.review === 'approved') out.push({ t: 'approved', warn: false });
  return out;
}

async function loadStatus() {
  if (!app.signedIn) return;
  const r = await getGithubStatus(auth());
  if (r.status === 'ok') {
    status.value = r.data;
    if (r.data.connected) await loadDigest();
  } else note.value = r.status === 'signed_out' ? 'Please sign in again.' : r.status === 'failed' ? r.message : '';
}

async function loadDigest() {
  loading.value = true;
  note.value = '';
  const r = await getGithubDigest(auth());
  loading.value = false;
  if (r.status === 'ok') digest.value = r.data.digest;
  else if (r.status === 'not_connected') {
    status.value = { configured: true, connected: false, login: null };
    digest.value = null;
    note.value = r.message;
  } else note.value = r.status === 'failed' ? r.message : 'Please sign in again.';
}

async function connect() {
  busy.value = true;
  note.value = '';
  const r = await connectGithub(token.value.trim(), auth());
  busy.value = false;
  if (r.status !== 'ok') { note.value = r.status === 'signed_out' ? 'Please sign in again.' : r.message; return; }
  token.value = '';
  status.value = { configured: true, connected: true, login: r.data.login };
  await loadDigest();
}

async function disconnect() {
  busy.value = true;
  const r = await disconnectGithub(auth());
  busy.value = false;
  if (r.status !== 'ok') { note.value = r.status === 'failed' ? r.message : 'Please sign in again.'; return; }
  status.value = { configured: true, connected: false, login: null };
  digest.value = null;
  note.value = 'Unlinked. You can also delete the token on GitHub.';
}

onMounted(async () => {
  // Opened straight from a link or a reload, the session is not restored yet.
  if (!app.authReady) await app.initAuth();
  await loadStatus();
});
watch(() => app.signedIn, loadStatus);
</script>
