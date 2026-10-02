/**
 * The Home's store: the Life graph (Nodes, Links, Occurrences) held locally and
 * synced by the existing engine. Local-first on purpose: capture works offline
 * and signed out, and the sync (lib/graph-sync.ts) carries it to the cloud.
 *
 * Capture uses the shared capture endpoint when signed in and online (dedupe, rate limits). Offline or
 * signed out it saves here and the normal sync carries it up. A capture with a date or time becomes a
 * Commitment (on-device parser); everything else stays an Idea.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { appendGraphOccurrences, getGraphLinks, getGraphNodes, getGraphOccurrences, saveGraphNodes, saveGraphOccurrences, saveGraphLinks } from '~/lib/graph-storage';
import { habitProgress, habitTap, homeHabitsPiece, parseCapture, rankNow, weeklyKept } from '~/lib/domain';
import type { ParsedCapture, TimeFormat } from '~/lib/domain';
import { postCapture } from '~/lib/capture-client';
import type { Commitment, Habit, Idea, Link, Node, Occurrence, Period } from '~/lib/domain';
import { heapItems, keptToday, nodeState, stackDays, stopRecords } from '~/lib/home/derive';
import type { Density } from '~/lib/home/prefs';
import { applyEdit, deleteNode, type EditInput } from '~/lib/home/edit';
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
  /** How much Home shows (the strip length); set by the Home screen from its preference. */
  const density = ref<Density>(1);
  /** 12 or 24 hour clock for every time shown or spoken. */
  const timeFormat = ref<TimeFormat>('12');
  /** What the last action appended, so it can be undone (every action is undoable). */
  const lastAction = ref<{ label: string; occurrences: Occurrence[]; addedNodeIds: string[] } | null>(null);

  function load() {
    nodes.value = getGraphNodes();
    links.value = getGraphLinks();
    occurrences.value = getGraphOccurrences();
    asOf.value = new Date();
    loaded.value = true;
    adoptDated();
  }

  /**
   * An Idea whose text carries a date or time (for example one saved by the server, which does not parse)
   * is really a Commitment: it goes on the Stack, not into the Heap.
   */
  function adoptDated() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let changed = false;
    nodes.value = nodes.value.map((n) => {
      if (n.kind !== 'idea') return n;
      const p = parseCapture(n.title, { now: new Date(n.createdAt), timeZone: tz });
      if (p.kind !== 'commitment') return n;
      changed = true;
      return { ...nodeFromCapture(n.id, p, new Date(n.createdAt)), createdAt: n.createdAt, updatedAt: new Date().toISOString() };
    });
    if (changed) persistNodes();
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
  const rankInput = (d: Density) => ({ now: asOf.value, nodes: nodes.value, links: links.value, occurrences: occurrences.value, density: d, timeFormat: timeFormat.value });
  /** The Now card and strip (ticket 23). */
  const rank = computed(() => rankNow(rankInput(density.value)));
  /** The Today lens list: always the fullest strip. */
  /** The Heap: unsorted Ideas and parked Commitments. */
  const heap = computed(() => heapItems(nodes.value, occurrences.value));
  /** The Stack: this week's open Commitments by day. */
  const stack = computed(() => stackDays(nodes.value, occurrences.value, asOf.value));
  const kept = computed(() => keptToday(nodes.value, occurrences.value, asOf.value));
  const habits = computed(() => nodes.value.filter((n): n is Habit => n.kind === 'habit'));
  const habitsPiece = computed(() => homeHabitsPiece(habits.value, occurrences.value, asOf.value));
  const weeklyTally = computed(() => weeklyKept(occurrences.value, asOf.value));
  const habitRows = computed(() => habits.value.map((habit) => ({ habit, progress: habitProgress(habit, occurrences.value, asOf.value) })));
  const currentState = computed(() => (rank.value.now ? nodeState(rank.value.now.node.id, occurrences.value) : null));

  // ── actions ──────────────────────────────────────────
  const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: timeFormat.value === '12' });

  function nodeFromCapture(id: string, p: ParsedCapture, now: Date): Node {
    const t = now.toISOString();
    if (p.kind === 'idea') return { id, kind: 'idea', title: p.title, private: false, createdAt: t, updatedAt: t };
    return {
      id, kind: 'commitment', title: p.title, notes: p.text !== p.title ? p.text : null, private: false, createdAt: t, updatedAt: t,
      fixedTime: p.fixedAt ?? null, deadline: p.deadline ?? null, windowStart: p.windowStart ?? null, windowEnd: p.windowEnd ?? null,
      durationMinutes: p.durationMinutes ?? null, slog: false, quiet: false,
    };
  }

  /**
   * Save a Capture. Signed in and online: through /api/capture (it stores the Idea; we keep the same id here).
   * Otherwise (signed out, offline, or the request failed): saved on this device and carried up by the normal sync.
   * Text with a date or time becomes a Commitment; everything else stays an Idea.
   */
  async function capture(text: string): Promise<{ ok: true; reply: string } | { ok: false; message: string }> {
    const title = text.trim();
    if (!title) return { ok: false, message: 'Nothing to add yet.' };
    if (title.length > MAX_CAPTURE) return { ok: false, message: 'That is a bit long to add at once. Try splitting it.' };
    const now = new Date();
    const parsed = parseCapture(title, { now, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

    let id: string = uid();
    let viaServer = false;
    const token = app.session?.access_token;
    if (token) {
      const r = await postCapture(title, { accessToken: token });
      if (r.status === 'saved') { id = r.id; viaServer = true; }
      else if (r.status === 'rejected') return { ok: false, message: r.message };
      // signed_out, queued or failed: fall through and keep it on this device.
    }

    const reply = parsed.kind === 'commitment'
      ? `Got it. ${parsed.fixedAt ? when(parsed.fixedAt) : parsed.deadline ? `by ${when(parsed.deadline)}` : 'Added'}.${parsed.ambiguous ? ' I guessed the time.' : ''}`
      : 'Got it, in the heap.';

    if (nodes.value.some((n) => n.id === id)) return { ok: true, reply }; // a replayed or duplicate capture

    nodes.value = [...nodes.value, nodeFromCapture(id, parsed, now)];
    persistNodes();
    if (viaServer) {
      // The server already wrote the captured record and cannot be undone from here.
      lastAction.value = null;
    } else {
      const o = occ(id, 'captured', now);
      append([o]);
      lastAction.value = { label: 'Added', occurrences: [o], addedNodeIds: [id] };
    }
    asOf.value = now;
    return { ok: true, reply };
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
  /** Stop something started and not finished: cancels its 'started' records (the log itself is never edited). */
  function stop(id: string) {
    const now = new Date();
    const cancels = stopRecords(id, occurrences.value, (nodeId, undoes) => occ(nodeId, 'undone', now, { undoes }));
    if (cancels.length === 0) return;
    append(cancels);
    asOf.value = now;
    lastAction.value = null;
  }
  const complete = (id: string) => act(id, 'done', 'Done');
  const park = (id: string) => act(id, 'parked', 'Sent to the heap');
  const notNow = (id: string) => act(id, 'moved', 'Moved to later');

  /**
   * Put a Heap item on the Stack on a local day ('YYYY-MM-DD'), or take its planned day off with null.
   * An Idea becomes a Commitment; a parked Commitment is brought back first.
   */
  function plan(id: string, day: string | null) {
    const node = nodes.value.find((n) => n.id === id);
    if (!node || (node.kind !== 'idea' && node.kind !== 'commitment')) return;
    if (node.kind === 'idea') promote(id);
    else bringBack(id);
    const now = new Date();
    nodes.value = nodes.value.map((n) => (n.id === id && n.kind === 'commitment' ? { ...n, plannedFor: day, updatedAt: now.toISOString() } : n));
    persistNodes();
    lastAction.value = null;
    asOf.value = now;
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

  function persistLinks() {
    saveGraphLinks(links.value);
    app.queuePush();
  }

  function edit(nodeId: string, input: EditInput) {
    const createdNodes: Node[] = [];
    const createdLinks: Link[] = [];

    const result = applyEdit(nodeId, input, nodes.value, links.value, (n) => createdNodes.push(n), (l) => createdLinks.push(l));

    nodes.value = result.nodes;
    links.value = result.links;
    persistNodes();
    persistLinks();
    asOf.value = new Date();
  }

  function removeNode(nodeId: string) {
    const result = deleteNode(nodeId, nodes.value, links.value);
    nodes.value = result.nodes;
    links.value = result.links;
    persistNodes();
    persistLinks();
    lastAction.value = null;
    asOf.value = new Date();
  }

  return {
    nodes, links, occurrences, asOf, loaded, lastAction, density, timeFormat,
    rank, heap, stack, kept, habits, habitsPiece, weeklyTally, habitRows, currentState,
    load, refresh, capture, promote, plan, start, stop, complete, park, notNow, bringBack, undoLast, createHabit, tapHabit, edit, removeNode,
  };
});
