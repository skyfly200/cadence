<template>
  <div class="space-y-3">
    <!-- Signed in -->
    <template v-if="store.signedIn">
      <div class="flex items-center gap-2">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white">
          <UserRound class="size-4" />
        </div>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold truncate">{{ store.user?.email || 'Signed in' }}</h2>
          <p class="text-[11px] text-muted-foreground flex items-center gap-1">
            <component :is="syncIcon" :class="cn('size-3', store.syncStatus === 'syncing' && 'animate-spin', store.syncStatus === 'error' && 'text-destructive', store.syncStatus === 'idle' && 'text-emerald-500')" />
            {{ syncLabel }}
          </p>
        </div>
      </div>

      <div class="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
        Your tasks, timeline, trips, habits and stats sync across every device you sign in on. Changes made elsewhere appear here live.
      </div>

      <div class="space-y-1.5">
        <Button variant="outline" class="w-full h-8 text-xs gap-1.5" :disabled="store.syncStatus === 'syncing'" @click="doSync">
          <RefreshCw :class="cn('size-3.5', store.syncStatus === 'syncing' && 'animate-spin')" /> Sync now
        </Button>
        <Button variant="outline" class="w-full h-8 text-xs gap-1.5" :disabled="busy" @click="addPasskey">
          <KeyRound class="size-3.5" /> {{ passkeyCount > 0 ? `Add another passkey (${passkeyCount})` : 'Add a passkey' }}
        </Button>
        <Button variant="ghost" class="w-full h-8 text-xs gap-1.5 text-destructive hover:text-destructive" @click="doSignOut">
          <LogOut class="size-3.5" /> Sign out
        </Button>
      </div>
      <p v-if="msg" :class="cn('text-[11px]', msgError ? 'text-destructive' : 'text-emerald-600')">{{ msg }}</p>
    </template>

    <!-- Signed out -->
    <template v-else>
      <div>
        <h2 class="flex items-center gap-2 text-sm font-semibold"><CloudUpload class="size-4 text-primary" /> Sign in to sync</h2>
        <p class="text-[11px] text-muted-foreground mt-0.5">Keep your plan in sync across all your devices. Your data stays private to your account.</p>
      </div>

      <!-- Google -->
      <Button variant="outline" class="w-full h-9 text-xs gap-2" :disabled="busy" @click="google">
        <svg class="size-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
        Continue with Google
      </Button>

      <div class="flex items-center gap-2 text-[10px] text-muted-foreground"><div class="h-px bg-border flex-1" /> or <div class="h-px bg-border flex-1" /></div>

      <!-- Email -->
      <div class="flex gap-1 rounded-md bg-muted p-0.5 text-[11px]">
        <button v-for="m in ['link', 'password'] as const" :key="m" type="button"
          :class="cn('flex-1 rounded px-2 py-1 transition-colors', mode === m ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')"
          @click="mode = m; msg = ''">
          {{ m === 'link' ? 'Magic link' : 'Password' }}
        </button>
      </div>

      <div class="space-y-1.5">
        <Input v-model="email" type="email" placeholder="you@example.com" class="h-8 text-xs" autocomplete="email" @keydown.enter="submit" />
        <Input v-if="mode === 'password'" v-model="password" type="password" placeholder="password (min 6 chars)" class="h-8 text-xs" autocomplete="current-password" @keydown.enter="submit" />

        <Button v-if="mode === 'link'" class="w-full h-8 text-xs gap-1.5" :disabled="busy || !email" @click="submit">
          <Mail class="size-3.5" /> Email me a sign-in link
        </Button>
        <div v-else class="flex gap-1.5">
          <Button class="flex-1 h-8 text-xs" :disabled="busy || !email || !password" @click="submit">Sign in</Button>
          <Button variant="outline" class="flex-1 h-8 text-xs" :disabled="busy || !email || !password" @click="signup">Create account</Button>
        </div>
      </div>

      <p v-if="msg" :class="cn('text-[11px]', msgError ? 'text-destructive' : 'text-emerald-600')">{{ msg }}</p>
      <p class="text-[10px] text-muted-foreground flex items-center gap-1"><KeyRound class="size-3" /> After signing in you can add a passkey for fast, passwordless access next time.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { UserRound, CloudUpload, Mail, KeyRound, LogOut, RefreshCw, CloudOff, Cloud, CloudCog, LoaderCircle } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { cn } from '~/lib/utils';

const store = useAppStore();
const emit = defineEmits<{ (e: 'done'): void }>();

const mode = ref<'link' | 'password'>('link');
const email = ref('');
const password = ref('');
const busy = ref(false);
const msg = ref('');
const msgError = ref(false);
const passkeyCount = ref(0);

function say(text: string, isError = false) { msg.value = text; msgError.value = isError; }

const syncIcon = computed(() => {
  switch (store.syncStatus) {
    case 'syncing': return LoaderCircle;
    case 'error': return CloudOff;
    case 'off': return CloudCog;
    default: return Cloud;
  }
});
const syncLabel = computed(() => {
  switch (store.syncStatus) {
    case 'syncing': return 'Syncing…';
    case 'error': return store.syncError || 'Sync error — will retry';
    case 'off': return 'Connecting…';
    default: return 'Synced across your devices';
  }
});

async function submit() {
  if (busy.value || !email.value) return;
  busy.value = true;
  try {
    if (mode.value === 'link') {
      const { error } = await store.signInWithEmailLink(email.value.trim());
      say(error || 'Check your inbox for a sign-in link.', !!error);
    } else {
      if (!password.value) return;
      const { error } = await store.signInWithPassword(email.value.trim(), password.value);
      if (error) say(error, true); else emit('done');
    }
  } finally { busy.value = false; }
}
async function signup() {
  if (busy.value || !email.value || !password.value) return;
  busy.value = true;
  try {
    const { error } = await store.signUpWithPassword(email.value.trim(), password.value);
    if (error) say(error, true);
    else say('Account created. If email confirmation is on, check your inbox; otherwise you’re signed in.');
  } finally { busy.value = false; }
}
async function google() {
  busy.value = true;
  const { error } = await store.signInWithGoogle();
  if (error) { say(error, true); busy.value = false; }
  // On success the browser redirects to Google.
}
async function doSync() { await store.syncNow(); }
async function doSignOut() { await store.signOut(); say(''); emit('done'); }
async function addPasskey() {
  busy.value = true;
  try {
    const { error } = await store.enrollPasskey();
    if (error) say(error, true);
    else { say('Passkey added.'); passkeyCount.value = await store.listPasskeys(); }
  } finally { busy.value = false; }
}

onMounted(async () => { if (store.signedIn) passkeyCount.value = await store.listPasskeys(); });
</script>
