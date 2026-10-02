/**
 * Nudge delivery: plan nudges, fire notifications and audio, and persist feedback.
 * Runs in Home only (mounted in HomeShell.vue).
 */

import { onMounted, onBeforeUnmount, ref } from 'vue';
import { getSupabase } from '~/lib/supabase';
import { syncNudgesToQueue } from '~/lib/home/nudge-queue-sync';
import { planNudges, planningDue, type Nudge, type NudgeSettings } from '~/lib/domain';
import { addMentioned, getMentioned, getPlanningFinished, getPlanningNudged, getPlanningReminder, setPlanningNudged, speechLevel, toneLevel } from '~/lib/home/prefs';
import { recordNudge, recordSetting } from '~/lib/home/signals-state';
import { showNotification } from '~/lib/notifications';
import {
  loadState,
  saveState,
  dueNudges,
  prunedIssued,
  markIssued,
  applyNotNow,
  applyStopNode,
  applyStopKind,
  restoreNode,
  restoreKind,
  setMuted,
  setDisclosed,
  type NudgeState,
} from '~/lib/home/nudge-state';
import { useGraphStore } from '~/stores/graph';
import { useAppStore } from '~/stores/app';

const DISCLOSURE = 'Cadence can speak short nudges while it\'s open. You can mute it anytime.';
const TICK_MS = 60_000; // Check every minute
let tickTimer: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;

function createAudioContext(): AudioContext {
  const Ctor = (typeof window !== 'undefined' && window.AudioContext) || (typeof window !== 'undefined' && (window as any).webkitAudioContext);
  if (!Ctor) throw new Error('AudioContext not supported');
  return new Ctor();
}

function resumeAudioContext(): void {
  if (!audioContext) {
    try {
      audioContext = createAudioContext();
    } catch {
      return;
    }
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {
      /* ignore */
    });
  }
}

function playTone(freq = 650, durationMs = 250, gainLevel = toneLevel()): void {
  if (gainLevel <= 0) return;
  if (!audioContext) return;
  try {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioContext.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch {
    /* ignore audio errors */
  }
}

function speak(text: string): void {
  if (!('speechSynthesis' in window) || speechLevel() <= 0) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = speechLevel();
    window.speechSynthesis.speak(utterance);
  } catch {
    /* ignore speech errors */
  }
}

function inQuietHours(ms: number, wakeTime: string, sleepTime: string, tz: string): boolean {
  const sleep = parseInt(sleepTime.split(':')[0]!, 10) * 60 + parseInt(sleepTime.split(':')[1]!, 10);
  const wake = parseInt(wakeTime.split(':')[0]!, 10) * 60 + parseInt(wakeTime.split(':')[1]!, 10);
  if (sleep === wake) return false;
  const d = new Date(ms);
  const parts = d.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).split(':');
  const cur = parseInt(parts[0]!, 10) * 60 + parseInt(parts[1]!, 10);
  return sleep < wake ? cur >= sleep && cur < wake : cur >= sleep || cur < wake;
}

export function useNudges() {
  const graph = useGraphStore();
  const app = useAppStore();
  const state = ref<NudgeState>(loadState());
  const firedNudges = ref<Set<string>>(new Set()); // Track which nudges we've fired this session
  const currentNudge = ref<Nudge | null>(null); // The nudge currently shown in the toast
  let interacted = false;

  function handleInteraction(): void {
    if (!interacted) {
      interacted = true;
      resumeAudioContext();
    }
  }

  function updateState(newState: NudgeState): void {
    state.value = newState;
    saveState(newState);
  }

  function notifyNudge(nudge: Nudge): void {
    // Show in-app notification via showNotification
    void showNotification(nudge.title, { body: nudge.body, tag: nudge.tag });

    // Show in the toast
    currentNudge.value = nudge;

    // Show the disclosure once
    if (!state.value.disclosed) {
      const newState = setDisclosed(state.value, true);
      updateState(newState);
    }

    // Play audio only after first interaction, not muted, not in quiet hours
    if (interacted && !state.value.muted) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const settings = app.settings ?? { wakeTime: '07:00', sleepTime: '23:00' };
      if (!inQuietHours(Date.now(), settings.wakeTime, settings.sleepTime, tz)) {
        playTone();
        // Speak the title and a bit of the body
        if (nudge.body) {
          speak(`${nudge.title}. ${nudge.body}`);
        } else {
          speak(nudge.title);
        }
      }
    }
  }

  let lastSyncedIds = new Set<string>();

  function tick(): void {
    if (!graph.loaded) return;

    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const settings = app.settings ?? { wakeTime: '07:00', sleepTime: '23:00' };

    // Plan nudges
    const allPlanned = planNudges({
      now,
      nodes: graph.nodes,
      occurrences: graph.occurrences,
      settings: settings as NudgeSettings,
      feedback: state.value.feedback,
      issued: prunedIssued(state.value.issued, now.toISOString().split('T')[0]!),
      mentioned: getMentioned(),
      disabledKinds: Array.from(state.value.disabledKinds),
      planningDue: planningDue(getPlanningFinished(), now, getPlanningReminder()),
      opts: { timeZone: tz },
      timeFormat: graph.timeFormat,
    });

    // The weekly Planning invitation is shown on this device once a week (its id carries the week).
    const nudgedPlanning = getPlanningNudged();
    const planned = allPlanned.filter((n) => !(n.kind === 'planning' && n.id === nudgedPlanning));

    // Queue them for Web Push so they also arrive when the app is closed (signed-in only)
    const ids = new Set(planned.map((n) => n.id));
    void syncNudgesToQueue(planned, getSupabase(), now, lastSyncedIds).then((synced) => { if (synced) lastSyncedIds = ids; }).catch(() => {});

    // Filter to due nudges
    const due = dueNudges(planned, now);

    // Fire and mark issued
    for (const nudge of due) {
      if (!firedNudges.value.has(nudge.id)) {
        firedNudges.value.add(nudge.id);
        notifyNudge(nudge);
        recordNudge(nudge.kind, 'shown');
        const newState = markIssued(state.value, [nudge]);
        updateState(newState);
        if (nudge.kind === 'planning') setPlanningNudged(nudge.id);
        // Record habit mentions
        if (nudge.mentions?.length) {
          addMentioned(nudge.mentions);
        }
      }
    }
  }

  function onNotNow(nudge: Nudge): void {
    recordNudge(nudge.kind, 'not_now');
    const newState = applyNotNow(state.value, nudge, new Date());
    updateState(newState);
  }

  function onStopNode(nodeId: string): void {
    const newState = applyStopNode(state.value, nodeId);
    updateState(newState);
  }

  function onStopKind(kind: string): void {
    recordNudge(kind, 'stopped');
    recordSetting(`nudge:${kind}`, false);
    const newState = applyStopKind(state.value, kind as any);
    updateState(newState);
  }

  function onToggleMute(muted: boolean): void {
    recordSetting('nudge:sound', !muted);
    const newState = setMuted(state.value, muted);
    updateState(newState);
  }

  function onRestoreNode(nodeId: string): void {
    const newState = restoreNode(state.value, nodeId);
    updateState(newState);
  }

  function onRestoreKind(kind: string): void {
    recordSetting(`nudge:${kind}`, true);
    const newState = restoreKind(state.value, kind as any);
    updateState(newState);
  }

  let onVisibilityChange: (() => void) | null = null;
  let onInteract: (() => void) | null = null;

  onMounted(() => {
    // Tick on mount, then every minute
    tick();
    tickTimer = setInterval(tick, TICK_MS);

    // Tick on visibility change
    onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Resume audio context on first interaction
    onInteract = () => {
      handleInteraction();
      document.removeEventListener('pointerdown', onInteract!);
      document.removeEventListener('keydown', onInteract!);
    };
    document.addEventListener('pointerdown', onInteract, { once: true });
    document.addEventListener('keydown', onInteract, { once: true });
  });

  onBeforeUnmount(() => {
    if (tickTimer) clearInterval(tickTimer);
    if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
    if (onInteract) {
      document.removeEventListener('pointerdown', onInteract);
      document.removeEventListener('keydown', onInteract);
    }
  });

  return {
    state,
    currentNudge,
    onNotNow,
    onStopNode,
    onStopKind,
    onToggleMute,
    onRestoreNode,
    onRestoreKind,
  };
}
