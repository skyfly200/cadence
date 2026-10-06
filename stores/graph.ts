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
import { activeOccurrences, gardenState, goalRows, habitProgress, habitTap, homeHabitsPiece, keepDeleted, parseCapture, pressSeason, pressedBook, rankNow, weeklyKept } from '~/lib/domain';
import { getPressedPages, getSeasonDraft, resolveHemisphere, savePressedPages, saveSeasonDraft } from '~/lib/home/garden-state';
import type { Hemisphere } from '~/lib/domain';
import { attachable, movedOrder, newGoal, newStep, partOf } from '~/lib/home/goal-edit';
import { importedTaskIds } from '~/lib/home/import';
import { matchTag, openBlockers } from '~/lib/home/heap';
import { getTags } from '~/lib/home/prefs';
import { acceptLink, defaultChoice, nodeFromProposal, type KeepChoice, type LinkProposal, type NodeProposal } from '~/lib/home/proposals';
import type { ParsedCapture, TimeFormat } from '~/lib/domain';
import { postCapture } from '~/lib/capture-client';
import type { Commitment, Habit, Idea, Link, Node, Occurrence, Period } from '~/lib/domain';
import { heapItems, keptToday, nodeState, reorderIds, stackDays, stopRecords } from '~/lib/home/derive';
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
  /** Which hemisphere the season names follow (from the time zone unless chosen in Settings). */
  const hemisphere = ref<Hemisphere>(resolveHemisphere());
  /** What the last action appended, so it can be undone (every action is undoable). */
  const lastAction = ref<{ label: string; occurrences: Occurrence[]; addedNodeIds: string[] } | null>(null);

  function load() {
    nodes.value = getGraphNodes();
    links.value = getGraphLinks();
    occurrences.value = getGraphOccurrences();
    asOf.value = new Date();
    loaded.value = true;
    adoptDated();
    tendBook();
  }

  /**
   * Keep the Pressed book: press any past season not yet pressed, and refresh the rolling draft of this
   * season so a habit deleted mid-season still appears on its page when the season turns. Device-only.
   */
  function tendBook() {
    const now = asOf.value;
    const draft = getSeasonDraft();
    const opts = { hemisphere: hemisphere.value };
    savePressedPages(pressedBook(nodes.value, links.value, occurrences.value, now, getPressedPages(), opts, draft).fresh);
    const current = gardenState(nodes.value, links.value, occurrences.value, now, opts).season;
    saveSeasonDraft(keepDeleted(pressSeason(nodes.value, links.value, occurrences.value, current, opts), draft?.key === current.key ? draft : undefined, nodes.value));
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
  const heap = computed(() => heapItems(nodes.value, occurrences.value, links.value));
  /** What each item still waits on (open `requires` targets), by item id. */
  const blockers = computed(() => openBlockers(nodes.value, links.value, occurrences.value));
  /** The Stack: this week's open Commitments by day. */
  const stack = computed(() => stackDays(nodes.value, occurrences.value, asOf.value));
  const kept = computed(() => keptToday(nodes.value, occurrences.value, asOf.value));
  const habits = computed(() => nodes.value.filter((n): n is Habit => n.kind === 'habit'));
  const habitsPiece = computed(() => homeHabitsPiece(habits.value, occurrences.value, asOf.value));
  const weeklyTally = computed(() => weeklyKept(occurrences.value, asOf.value));
  const habitRows = computed(() => habits.value.map((habit) => ({ habit, progress: habitProgress(habit, occurrences.value, asOf.value) })));
  const goalList = computed(() => goalRows(nodes.value, links.value, occurrences.value, asOf.value));
  /** This season's garden, grown from everything kept. */
  const garden = computed(() => gardenState(nodes.value, links.value, occurrences.value, asOf.value, { hemisphere: hemisphere.value }));
  /** The Pressed book: pages kept on this device, plus any past season not yet pressed. Newest first. */
  const pressed = () => pressedBook(nodes.value, links.value, occurrences.value, asOf.value, getPressedPages(), { hemisphere: hemisphere.value }, getSeasonDraft()).seasons;
  /** Open Commitments that could still be attached under a Goal or milestone. */
  const attachableTo = (parentId: string) => attachable(nodes.value, links.value, parentId, new Set(activeOccurrences(occurrences.value).filter((o) => o.type === 'done').map((o) => o.nodeId)));
  const currentState = computed(() => (rank.value.now ? nodeState(rank.value.now.node.id, occurrences.value) : null));

  // ── actions ──────────────────────────────────────────
  const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: timeFormat.value === '12' });

  function nodeFromCapture(id: string, p: ParsedCapture, now: Date): Node {
    const t = now.toISOString();
    const category = matchTag(p.title, getTags());
    if (p.kind === 'idea') return { id, kind: 'idea', title: p.title, private: false, category, createdAt: t, updatedAt: t };
    return {
      id, kind: 'commitment', title: p.title, notes: p.text !== p.title ? p.text : null, private: false, category, createdAt: t, updatedAt: t,
      fixedTime: p.fixedAt ?? null, deadline: p.deadline ?? null, windowStart: p.windowStart ?? null, windowEnd: p.windowEnd ?? null,
      durationMinutes: p.durationMinutes ?? null, slog: false, quiet: false,
    };
  }

  /**
   * Save a Capture. Signed in and online: through /api/capture (it stores the Idea; we keep the same id here).
   * Otherwise (signed out, offline, or the request failed): saved on this device and carried up by the normal sync.
   * Text with a date or time becomes a Commitment; everything else stays an Idea.
   */
  async function capture(text: string, opts: { private?: boolean } = {}): Promise<{ ok: true; reply: string } | { ok: false; message: string }> {
    const title = text.trim();
    if (!title) return { ok: false, message: 'Nothing to add yet.' };
    if (title.length > MAX_CAPTURE) return { ok: false, message: 'That is a bit long to add at once. Try splitting it.' };
    const now = new Date();
    const parsed = parseCapture(title, { now, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

    let id: string = uid();
    let viaServer = false;
    const token = app.session?.access_token;
    if (token) {
      const r = await postCapture(title, { accessToken: token, private: opts.private });
      if (r.status === 'saved') { id = r.id; viaServer = true; }
      else if (r.status === 'rejected') return { ok: false, message: r.message };
      // signed_out, queued or failed: fall through and keep it on this device.
    }

    const reply = parsed.kind === 'commitment'
      ? `Got it. ${parsed.fixedAt ? when(parsed.fixedAt) : parsed.deadline ? `by ${when(parsed.deadline)}` : 'Added'}.${parsed.ambiguous ? ' I guessed the time.' : ''}`
      : 'Got it, in the heap.';

    if (nodes.value.some((n) => n.id === id)) return { ok: true, reply }; // a replayed or duplicate capture

    const node = nodeFromCapture(id, parsed, now);
    nodes.value = [...nodes.value, opts.private ? { ...node, private: true } : node];
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
  /** Finish something from the Plan: an Idea becomes a Commitment and a parked one comes back first, then it is done. */
  function finish(id: string) {
    const node = nodes.value.find((n) => n.id === id);
    if (!node || (node.kind !== 'idea' && node.kind !== 'commitment')) return;
    if (node.kind === 'idea') promote(id);
    else bringBack(id);
    complete(id);
  }
  const park = (id: string) => act(id, 'parked', 'Sent to the heap');
  const notNow = (id: string) => act(id, 'moved', 'Moved to later');

  /**
   * Put a Heap item on the Stack on a local day ('YYYY-MM-DD'), or take its planned day off with null.
   * An Idea becomes a Commitment; a parked Commitment is brought back first.
   */
  function plan(id: string, day: string | null, beforeId: string | null = null) {
    const node = nodes.value.find((n) => n.id === id);
    if (!node || (node.kind !== 'idea' && node.kind !== 'commitment')) return;
    if (node.kind === 'idea') promote(id);
    else bringBack(id);
    const now = new Date();
    nodes.value = nodes.value.map((n) => (n.id === id && n.kind === 'commitment' ? { ...n, plannedFor: day, dayOrder: null, backlog: false, updatedAt: now.toISOString() } : n));
    if (day) {
      // Place it among the day's untimed items: before `beforeId`, or last.
      const items = stackDays(nodes.value, occurrences.value, now).find((d) => d.key === day)?.items ?? [];
      const ids = reorderIds(items.filter((i) => !i.time || i.id === id).map((i) => i.id), id, beforeId);
      const at = new Map(ids.map((x, i) => [x, i] as const));
      nodes.value = nodes.value.map((n) => (n.kind === 'commitment' && at.has(n.id) ? { ...n, dayOrder: at.get(n.id)! } : n));
    }
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

  /** A new Goal, or (with a parent) a milestone under it. Returns the new Goal's id. */
  function createGoal(title: string, parentId: string | null = null): string | null {
    const now = new Date();
    const g = newGoal(title, now, uid(), parentId !== null);
    if (!g) return null;
    nodes.value = [...nodes.value, g];
    persistNodes();
    if (parentId) attachTo(g.id, parentId);
    asOf.value = now;
    return g.id;
  }

  /** Make an existing Commitment or milestone part of a Goal or milestone (a stated Link). */
  function attachTo(childId: string, parentId: string): boolean {
    const now = new Date();
    const l = partOf(links.value, childId, parentId, now, uid());
    if (!l) return false;
    links.value = [...links.value, l];
    persistLinks();
    asOf.value = now;
    return true;
  }

  /** Save a connection the AI proposed and the user tapped "Connect" on (origin proposed_accepted). */
  function acceptConnection(p: LinkProposal): boolean {
    const now = new Date();
    const l = acceptLink(p, links.value, now, uid());
    if (!l) return false;
    links.value = [...links.value, l];
    persistLinks();
    asOf.value = now;
    return true;
  }

  /** Save a Node the AI proposed in Discuss and the user tapped "Keep" on. Returns its id, or null if it had no title. */
  function keepProposedNode(p: NodeProposal, choice: KeepChoice = defaultChoice(p)): string | null {
    const now = new Date();
    const node = nodeFromProposal(p, now, uid(), choice);
    if (!node) return null;
    nodes.value = [...nodes.value, node];
    persistNodes();
    const o = occ(node.id, 'captured', now);
    append([o]);
    asOf.value = now;
    return node.id;
  }

  /** How many Ideas came from the old Google Tasks import. */
  const importedTaskCount = computed(() => importedTaskIds(nodes.value).size);

  /** Remove the Ideas the old Google Tasks import added (they were never part of anything else, unless planned). */
  function removeImportedTasks(): number {
    const ids = importedTaskIds(nodes.value);
    if (ids.size === 0) return 0;
    nodes.value = nodes.value.filter((n) => !ids.has(n.id));
    links.value = links.value.filter((l) => !ids.has(l.fromId) && !ids.has(l.toId));
    persistNodes();
    persistLinks();
    lastAction.value = null;
    asOf.value = new Date();
    return ids.size;
  }

  /** Send a Heap item to the bottom of the Heap, or bring it back up. */
  function setBacklog(id: string, on: boolean) {
    edit(id, { backlog: on });
  }

  /** Give untagged Heap items a tag when a tag's name appears in the title. Returns how many were tagged. */
  function autoTagHeap(): number {
    const tags = getTags();
    const ids = new Map<string, string>();
    for (const h of heap.value) {
      const n = nodes.value.find((x) => x.id === h.id);
      const hit = n && !n.category ? matchTag(n.title, tags) : null;
      if (hit) ids.set(h.id, hit);
    }
    if (ids.size === 0) return 0;
    const stamp = new Date().toISOString();
    nodes.value = nodes.value.map((n) => (ids.has(n.id) ? { ...n, category: ids.get(n.id)!, updatedAt: stamp } : n));
    persistNodes();
    asOf.value = new Date();
    return ids.size;
  }

  /**
   * Apply what the heap AI answered: a tag and a time guess only where the item has none, so nothing the user
   * set is overwritten. Returns how many tags and estimates were added.
   */
  function applyHeapAi(answers: { id: string; category: string | null; minutes: number | null }[]): { tagged: number; estimated: number } {
    const stamp = new Date().toISOString();
    let tagged = 0;
    let estimated = 0;
    const by = new Map(answers.map((a) => [a.id, a] as const));
    nodes.value = nodes.value.map((n) => {
      const a = by.get(n.id);
      if (!a || n.private) return n;
      const next = { ...n };
      if (a.category && !n.category) { next.category = a.category; tagged++; }
      const has = n.kind === 'commitment' ? (n.durationMinutes ?? n.estimateMinutes) : n.estimateMinutes;
      if (a.minutes && !has) { next.estimateMinutes = a.minutes; estimated++; }
      return next === n || (next.category === n.category && next.estimateMinutes === n.estimateMinutes) ? n : { ...next, updatedAt: stamp };
    });
    if (tagged || estimated) { persistNodes(); asOf.value = new Date(); }
    return { tagged, estimated };
  }

  /** Move a goal one place up (-1) or down (1) in the Goals list. */
  function moveGoal(id: string, dir: -1 | 1) {
    const order = movedOrder(goalList.value.map((r) => r.goal.id), id, dir);
    if (order.size === 0) return;
    const stamp = new Date().toISOString();
    nodes.value = nodes.value.map((n) => (n.kind === 'goal' && order.has(n.id) ? { ...n, order: order.get(n.id)!, updatedAt: stamp } : n));
    persistNodes();
    asOf.value = new Date();
  }

  /** A new open step (Commitment) under a Goal or milestone. */
  function addStep(title: string, parentId: string): boolean {
    const now = new Date();
    const step = newStep(title, now, uid());
    if (!step) return false;
    nodes.value = [...nodes.value, step];
    persistNodes();
    attachTo(step.id, parentId);
    asOf.value = now;
    return true;
  }

  /** One tap on a habit: logs one, or (at or past the target) undoes back to zero. Returns whether it is now met, and whether the tap logged (an undo is not a reward moment). */
  function tapHabit(id: string): { met: boolean; logged: boolean } | null {
    const habit = habits.value.find((h) => h.id === id);
    if (!habit) return null;
    const now = new Date();
    const added = habitTap(habit, occurrences.value, now, 'app', uid);
    append(added);
    asOf.value = now;
    lastAction.value = { label: 'Habit', occurrences: added, addedNodeIds: [] };
    return { met: habitProgress(habit, occurrences.value, now).met, logged: added.some((o) => o.type === 'logged') };
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
    nodes, links, occurrences, asOf, loaded, lastAction, density, timeFormat, hemisphere,
    rank, heap, blockers, stack, kept, habits, habitsPiece, weeklyTally, habitRows, currentState, goalList, garden, pressed, attachableTo,
    load, refresh, capture, promote, plan, start, stop, complete, finish, park, notNow, bringBack, undoLast, createHabit, createGoal, attachTo, acceptConnection, keepProposedNode, importedTaskCount, removeImportedTasks, setBacklog, moveGoal, autoTagHeap, applyHeapAi, addStep, tapHabit, edit, removeNode,
  };
});
