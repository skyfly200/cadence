/**
 * The Home's store: the Life graph (Nodes, Links, Occurrences) held locally and
 * synced by the existing engine. Local-first on purpose: capture works offline
 * and signed out, and the sync (lib/graph-sync.ts) carries it to the cloud.
 *
 * Decision to confirm: the app saves captures here directly instead of posting
 * to /api/capture, so capture works offline. The endpoint stays for assistant
 * channels (Phase 5).
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { appendGraphOccurrences, getGraphLinks, getGraphNodes, getGraphOccurrences, saveGraphNodes, saveGraphOccurrences } from '~/lib/graph-storage';
import { habitProgress, habitTap, homeHabitsPiece, weeklyKept } from '~/lib/domain';
import type { Commitment, Habit, Idea, Link, Node, Occurrence, Period } from '~/lib/domain';
import { keptToday, nodeState, parkedItems, pickNow, shelfNote } from '~/lib/home/derive';
import { useAppStore } from './app';

const MAX_CAPTURE = 4000; // same limit as the server route
const uid = () => globalThis.crypto.randomUUID();

export const useGraphStore = defineStore('graph', () => {
  const app = useAppStore();
  const nodes = ref<Node[]>([]);
  const links = ref<Link[]>([]);
  const occurrences = ref<Occurrence[]>([]);
  /** "Now" for derivations. Refreshed when Home opens and after each action, never on a timer. */
  const asOf = ref(new Date());
  const loaded = ref(false);
  /** What the last action appended, so it can be undone (every action is undoable). */
  const lastAction = ref<{ label: string; occurrences: Occurrence[]; addedNodeIds: string[] } | null>(null);

  function load() {
    nodes.value = getGraphNodes();
    links.value = getGraphLinks();
    occurrences.value = getGraphOccurrences();
    asOf.value = new Date();
    loaded.value = true;
  }

  function persistNodes() {
    saveGraphNodes(nodes.value);
    app.queuePush();
  }
  function append(list: Occurrence[]) {
    if (!list.length) return;
    appendGraphOccurrences(list);
    occurrences.value = getGraphOccurrences();
    app.queuePush();
  }
  const occ = (nodeId: string, type: Occurrence['type'], now: Date, extra: Partial<Occurrence> = {}): Occurrence =>
    ({ id: uid(), nodeId, type, at: now.toISOString(), source: 'app', ...extra });

  // ── derived ──────────────────────────────────────────
  const pick = computed(() => pickNow(nodes.value, occurrences.value, asOf.value, 8));
  const parked = computed(() => parkedItems(nodes.value, occurrences.value));
  const kept = computed(() => keptToday(nodes.value, occurrences.value, asOf.value));
  const habits = computed(() => nodes.value.filter((n): n is Habit => n.kind === 'habit'));
  const habitsPiece = computed(() => homeHabitsPiece(habits.value, occurrences.value, asOf.value));
  const weeklyTally = computed(() => weeklyKept(occurrences.value, asOf.value));
  const habitRows = computed(() => habits.value.map((habit) => ({ habit, progress: habitProgress(habit, occurrences.value, asOf.value) })));
  const currentState = computed(() => (pick.value.now ? nodeState(pick.value.now.id, occurrences.value) : null));

  // ── actions ──────────────────────────────────────────
  /** Save a Capture as an Idea (instantly, offline-safe). Returns the calm reply, or an error string. */
  function capture(text: string): { ok: true; reply: string } | { ok: false; message: string } {
    const title = text.trim();
    if (!title) return { ok: false, message: 'Nothing to add yet.' };
    if (title.length > MAX_CAPTURE) return { ok: false, message: 'That is a bit long to add at once. Try splitting it.' };
    const now = new Date();
    const idea: Idea = { id: uid(), kind: 'idea', title, private: false, createdAt: now.toISOString(), updatedAt: now.toISOString() };
    nodes.value = [...nodes.value, idea];
    persistNodes();
    const o = occ(idea.id, 'captured', now);
    append([o]);
    asOf.value = now;
    lastAction.value = { label: 'Added', occurrences: [o], addedNodeIds: [idea.id] };
    return { ok: true, reply: 'Got it, parked.' };
  }

  /** "Do this today": turn a parked Idea into a Commitment (no bucket questions). */
  function promote(id: string) {
    const now = new Date();
    nodes.value = nodes.value.map((n) => {
      if (n.id !== id || n.kind !== 'idea') return n;
      const c: Commitment = { ...n, kind: 'commitment', slog: false, quiet: false, updatedAt: now.toISOString() };
      return c;
    });
    persistNodes();
    asOf.value = now;
  }

  function act(id: string, type: Occurrence['type'], label: string, extra: Partial<Occurrence> = {}) {
    const now = new Date();
    const o = occ(id, type, now, extra);
    append([o]);
    asOf.value = now;
    lastAction.value = { label, occurrences: [o], addedNodeIds: [] };
  }
  const start = (id: string) => act(id, 'started', 'Started');
  const complete = (id: string) => act(id, 'done', 'Done');
  const park = (id: string) => act(id, 'parked', 'Parked');
  function notNow(id: string) {
    const now = new Date();
    act(id, 'moved', 'Moved to later', { note: shelfNote(now) });
  }

  /** Bring a parked Commitment back (cancels the parked record) or promote a parked Idea. */
  function bringBack(id: string) {
    const node = nodes.value.find((n) => n.id === id);
    if (!node) return;
    if (node.kind === 'idea') return promote(id);
    const parkedOcc = [...occurrences.value].reverse().find((o) => o.nodeId === id && o.type === 'parked'
      && !occurrences.value.some((u) => u.type === 'undone' && u.undoes === o.id));
    if (parkedOcc) act(id, 'undone', 'Brought back', { undoes: parkedOcc.id });
  }

  /** Undo the most recent action: cancel what it appended, and drop a just-added Idea. */
  function undoLast(): string | null {
    const last = lastAction.value;
    if (!last) return null;
    const now = new Date();
    const cancels = last.occurrences.map((o) => occ(o.nodeId, 'undone', now, { undoes: o.id }));
    append(cancels);
    if (last.addedNodeIds.length) {
      nodes.value = nodes.value.filter((n) => !last.addedNodeIds.includes(n.id));
      persistNodes();
    }
    asOf.value = now;
    lastAction.value = null;
    return last.label;
  }

  function createHabit(input: { title: string; period: Period; target: number }): boolean {
    const title = input.title.trim();
    if (!title) return false;
    const now = new Date().toISOString();
    const habit: Habit = {
      id: uid(), kind: 'habit', title, private: false, createdAt: now, updatedAt: now,
      recurrence: { period: input.period, target: Math.max(1, Math.round(input.target)) }, pin: null, quiet: false,
    };
    nodes.value = [...nodes.value, habit];
    persistNodes();
    asOf.value = new Date();
    return true;
  }

  /** One tap on a habit: logs one, or (at or past the target) undoes back to zero. Returns whether it is now met. */
  function tapHabit(id: string): { met: boolean } | null {
    const habit = habits.value.find((h) => h.id === id);
    if (!habit) return null;
    const now = new Date();
    const added = habitTap(habit, occurrences.value, now, 'app', uid);
    append(added);
    asOf.value = now;
    lastAction.value = { label: 'Habit', occurrences: added, addedNodeIds: [] };
    return { met: habitProgress(habit, occurrences.value, now).met };
  }

  function refresh() { asOf.value = new Date(); }

  return {
    nodes, links, occurrences, asOf, loaded, lastAction,
    pick, parked, kept, habits, habitsPiece, weeklyTally, habitRows, currentState,
    load, refresh, capture, promote, start, complete, park, notNow, bringBack, undoLast, createHabit, tapHabit,
  };
});
