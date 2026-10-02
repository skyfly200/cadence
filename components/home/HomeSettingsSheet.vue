<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-end bg-stone-900/30" @click.self="$emit('close')">
    <div class="mx-auto w-full max-w-md rounded-t-[2rem] bg-white p-5 pb-8 dark:bg-[#2A2645]" role="dialog" aria-label="Display and account">
      <p class="font-serif text-xl">Display</p>

      <p class="mt-4 text-sm font-medium">How much to show</p>
      <div class="mt-1.5 grid grid-cols-3 gap-2">
        <button
          v-for="(n, i) in ['Simple', 'Balanced', 'Rich']" :key="n"
          :class="['min-h-[44px] rounded-xl border text-sm', density === i ? 'border-[#E07A45] bg-amber-50 font-semibold text-amber-900 dark:bg-white/10 dark:text-[#FFB59F]' : 'border-slate-200 dark:border-white/10']"
          @click="$emit('update:density', i as 0 | 1 | 2)"
        >{{ n }}</button>
      </div>

      <p class="mt-4 text-sm font-medium">Clock</p>
      <div class="mt-1.5 grid grid-cols-2 gap-2">
        <button
          v-for="f in [{ v: '12', l: '12-hour' }, { v: '24', l: '24-hour' }]" :key="f.v"
          :class="['min-h-[44px] rounded-xl border text-sm', timeFormat === f.v ? 'border-[#E07A45] bg-amber-50 font-semibold text-amber-900 dark:bg-white/10 dark:text-[#FFB59F]' : 'border-slate-200 dark:border-white/10']"
          @click="$emit('update:timeFormat', f.v as TimeFormat)"
        >{{ f.l }}</button>
      </div>

      <p class="mt-4 text-sm font-medium">Colours</p>
      <ClientOnly>
        <div class="mt-1.5 grid grid-cols-3 gap-2">
          <button
            v-for="m in MODES" :key="m.value"
            :class="['min-h-[44px] rounded-xl border text-sm', colorMode.preference === m.value ? 'border-[#E07A45] bg-amber-50 font-semibold text-amber-900 dark:bg-white/10 dark:text-[#FFB59F]' : 'border-slate-200 dark:border-white/10']"
            @click="colorMode.preference = m.value"
          >{{ m.label }}</button>
        </div>
      </ClientOnly>

      <p class="mt-5 font-serif text-xl">Notifications</p>

      <p v-if="pushBlocked" class="mt-3 text-sm text-slate-600 dark:text-slate-400">
        Notifications are blocked in your browser settings.
      </p>
      <p v-else-if="pushUnsupported" class="mt-3 text-sm text-slate-600 dark:text-slate-400">
        Notifications are not supported on this device.
      </p>
      <label v-else class="mt-3 flex items-center gap-3">
        <input
          type="checkbox"
          :checked="pushEnabled"
          :disabled="pushLoading"
          class="h-5 w-5 rounded disabled:opacity-50"
          @change="(e) => onTogglePush((e.target as HTMLInputElement).checked)"
        />
        <span class="text-sm">When Cadence is closed</span>
      </label>

      <p class="mt-5 font-serif text-xl">Nudges</p>

      <div class="mt-3 space-y-2">
        <label v-for="kind in NUDGE_KINDS" :key="kind" class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
          <input
            type="checkbox"
            :checked="!nudgeState.disabledKinds.has(kind)"
            class="h-5 w-5 rounded"
            @change="(e) => onToggleKind(kind, (e.target as HTMLInputElement).checked)"
          />
          <span class="text-sm">{{ kindLabel(kind) }}</span>
        </label>
      </div>

      <p class="mt-3 text-sm font-medium">Sound</p>
      <label class="mt-1.5 flex items-center gap-3">
        <input type="checkbox" :checked="!nudgeState.muted" class="h-5 w-5 rounded" @change="(e) => onToggleMute(!(e.target as HTMLInputElement).checked)" />
        <span class="text-sm">Sound on</span>
      </label>
      <div v-for="k in SOUNDS" :key="k.kind" class="mt-2 flex items-center gap-3">
        <input type="checkbox" v-model="sound[k.kind].on" :aria-label="k.label" class="h-5 w-5 rounded" @change="onSoundOn(k.kind)" />
        <label :for="`vol-${k.kind}`" class="w-14 text-sm">{{ k.label }}</label>
        <input :id="`vol-${k.kind}`" type="range" min="0" max="100" step="5" v-model.number="sound[k.kind].volume" :disabled="!sound[k.kind].on" class="flex-1" @change="onVolume(k.kind)" />
        <button class="text-xs text-blue-600 dark:text-blue-400 disabled:opacity-40" :disabled="!sound[k.kind].on" @click="preview(k.kind)">Test</button>
      </div>

      <p class="mt-4 text-sm font-medium">Music for focus</p>
      <select v-model="music.provider" class="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-[16px] dark:border-white/10 dark:bg-[#1D1A2F]" aria-label="Music app" @change="saveMusic">
        <option v-for="p in MUSIC_PROVIDERS" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <input
        v-model="music.playlist" type="url" inputmode="url" placeholder="Playlist link (optional)" aria-label="Playlist link"
        class="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-[16px] outline-none dark:border-white/10 dark:bg-[#1D1A2F]" @change="savePlaylist"
      />
      <p v-if="playlistNote" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ playlistNote }}</p>

      <div v-if="stoppedOrSilenced.length > 0" class="mt-3">
        <p class="text-sm font-medium">Muted items</p>
        <div class="mt-1.5 space-y-1">
          <div v-for="item in stoppedOrSilenced" :key="item.id" class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <span class="text-sm">{{ item.title }}</span>
            <button class="text-xs text-blue-600 dark:text-blue-400" @click="onRestore(item)">Turn back on</button>
          </div>
        </div>
      </div>

      <div class="mt-5 grid gap-2">
        <button class="min-h-[44px] rounded-xl border border-slate-200 text-sm dark:border-white/10" @click="$emit('account')">
          Account and sync <span class="text-slate-400">· {{ signedIn ? 'signed in' : 'signed out' }}</span>
        </button>
        <NuxtLink to="/classic" class="grid min-h-[44px] place-items-center rounded-xl border border-slate-200 text-sm dark:border-white/10">Classic view (the old app)</NuxtLink>
      </div>

      <button class="mt-4 min-h-[44px] w-full rounded-2xl bg-stone-100 text-sm dark:bg-white/10" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue';
import type { TimeFormat } from '~/lib/domain';
import { MUSIC_PROVIDERS, parsePlaylist } from '~/lib/home/music';
import { getMusic, getSoundOn, getVolume, setMusic, setSoundOn, setVolume, speechVolume, toneGain, type Density, type SoundKind } from '~/lib/home/prefs';
import type { NudgeKind } from '~/lib/domain';
import { useGraphStore } from '~/stores/graph';
import { useAppStore } from '~/stores/app';
import { enablePush, disablePush } from '~/lib/push-client';
import { getSupabase } from '~/lib/supabase';

interface StoppedItem {
  id: string;
  title: string;
  type: 'node' | 'kind';
  kind?: NudgeKind;
}

const props = defineProps<{ open: boolean; density: Density; timeFormat: TimeFormat; signedIn: boolean; nudgeState: any; muted: boolean }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:density', d: Density): void;
  (e: 'update:timeFormat', f: TimeFormat): void;
  (e: 'account'): void;
  (e: 'toggle-kind', kind: NudgeKind, enabled: boolean): void;
  (e: 'toggle-mute', muted: boolean): void;
  (e: 'restore-node', nodeId: string): void;
  (e: 'restore-kind', kind: NudgeKind): void;
}>();

const colorMode = useColorMode();
const graph = useGraphStore();
const app = useAppStore();

const pushEnabled = ref(false);
const pushBlocked = ref(false);
const pushUnsupported = ref(false);
const pushLoading = ref(false);
const MODES = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const NUDGE_KINDS: NudgeKind[] = ['leave_by', 'at_risk', 'transition', 'habit_summary'];

function kindLabel(kind: NudgeKind): string {
  if (kind === 'leave_by') return 'Time reminders';
  if (kind === 'at_risk') return 'At-risk alerts';
  if (kind === 'transition') return 'Transition cues';
  if (kind === 'habit_summary') return 'Habit summary';
  return kind;
}

const stoppedOrSilenced = computed(() => {
  const items: StoppedItem[] = [];
  // Add stopped nodes
  for (const nodeId of props.nudgeState.feedback.stoppedNodes) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (node) {
      items.push({ id: nodeId, title: node.title, type: 'node' });
    }
  }
  // Add stopped kinds (show once per kind)
  for (const kind of props.nudgeState.feedback.stoppedKinds) {
    if (!items.find((i) => i.type === 'kind' && i.kind === kind)) {
      items.push({ id: kind, title: kindLabel(kind), type: 'kind', kind });
    }
  }
  return items;
});

function onToggleKind(kind: NudgeKind, enabled: boolean): void {
  emit('toggle-kind', kind, enabled);
}

const music = reactive(getMusic());
const playlistNote = ref('');
function saveMusic(): void { setMusic({ ...music }); }
/** A pasted link picks its own app; one that is not a known player is not kept. */
function savePlaylist(): void {
  const text = music.playlist.trim();
  if (!text) { music.playlist = ''; playlistNote.value = 'Opens the app itself.'; saveMusic(); return; }
  const parsed = parsePlaylist(text);
  if (!parsed) { playlistNote.value = 'That is not a YouTube Music, Spotify or SoundCloud link.'; music.playlist = ''; saveMusic(); return; }
  music.playlist = parsed.url;
  music.provider = parsed.provider.id;
  playlistNote.value = `Opens this playlist in ${parsed.provider.name}.`;
  saveMusic();
}

const SOUNDS: { kind: SoundKind; label: string }[] = [{ kind: 'tone', label: 'Tone' }, { kind: 'speech', label: 'Speech' }];
const sound = reactive({
  tone: { on: getSoundOn('tone'), volume: getVolume('tone') },
  speech: { on: getSoundOn('speech'), volume: getVolume('speech') },
});
function onSoundOn(kind: SoundKind): void { setSoundOn(kind, sound[kind].on); }
function onVolume(kind: SoundKind): void { setVolume(kind, sound[kind].volume); }

/** A short sample at the chosen volume (a tap, so the browser allows it). */
function preview(kind: SoundKind): void {
  setVolume(kind, sound[kind].volume);
  try {
    if (kind === 'speech') {
      const u = new SpeechSynthesisUtterance('This is how speech will sound.');
      u.volume = speechVolume(sound.speech.volume);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return;
    }
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 650;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(toneGain(sound.tone.volume), now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
    osc.onended = () => { void ctx.close(); };
  } catch { /* no audio here */ }
}

function onToggleMute(muted: boolean): void {
  emit('toggle-mute', muted);
}

function onRestore(item: StoppedItem): void {
  if (item.type === 'node') {
    emit('restore-node', item.id);
  } else {
    emit('restore-kind', item.kind!);
  }
}

async function checkPushStatus(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    pushUnsupported.value = true;
    pushBlocked.value = false;
    return;
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    pushBlocked.value = true;
    pushUnsupported.value = false;
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      pushUnsupported.value = true;
      return;
    }
    const subscription = await registration.pushManager.getSubscription();
    pushEnabled.value = !!subscription;
  } catch {
    pushUnsupported.value = true;
  }
}

async function onTogglePush(enable: boolean): Promise<void> {
  if (!props.signedIn) return;
  pushLoading.value = true;

  const cfg = useRuntimeConfig();
  const token = app.session?.access_token;
  const vapidKey = cfg.public.vapidPublicKey as string;

  try {
    if (enable) {
      const result = await enablePush({ accessToken: token, vapidPublicKey: vapidKey });
      pushEnabled.value = result.status === 'subscribed' || result.status === 'already_subscribed';
    } else {
      const result = await disablePush({ accessToken: token, vapidPublicKey: vapidKey });
      pushEnabled.value = false;
    }
  } catch {
    // Revert on error
    await checkPushStatus();
  } finally {
    pushLoading.value = false;
  }
}

onMounted(async () => {
  await checkPushStatus();
});
</script>
