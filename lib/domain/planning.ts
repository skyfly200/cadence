/**
 * The Planning session's pure pieces (ticket 25): which Ideas to look at, the conflicts
 * worth mentioning, and the recap. Framework-free, deterministic, on-device: the AI is
 * never involved in finding a conflict, and the whole session still works with AI off.
 *
 * Tone rules: a conflict is one plain sentence with one optional fix, never an alarm. A
 * recap is at most three lines and never mentions anything missed, undone or streaked.
 */
import { formatClock, type TimeFormat } from './clock';
import { activeOccurrences, DEFAULT_DURATION_MIN } from './estimates';
import { childrenOf, descendants } from './goals';
import { habitProgress } from './habits';
import { dayKey, inWindow, localParts, periodWindow, type PeriodOptions } from './periods';
import { rankNow } from './ranking';
import { isParked } from './shelf';
import { keptInWindow } from './tally';
import type { Commitment, Goal, Habit, Idea, Link, Node, Occurrence } from './types';

// ── triage ────────────────────────────────────────────────────

/** How many Ideas one session shows. The rest wait for the next one. */
export const TRIAGE_MAX = 5;

/**
 * Ideas captured since the last finished session that have not been looked at yet, newest first.
 * `reviewed` is what the user already decided on in an unfinished session, so stopping part-way
 * keeps the progress. Backlogged Ideas are left alone until the user brings them back up.
 */
export function ideasToReview(nodes: readonly Node[], sinceIso: string | null, reviewed: Iterable<string> = [], limit = TRIAGE_MAX): Idea[] {
  const seen = new Set(reviewed);
  return nodes
    .filter((n): n is Idea => n.kind === 'idea' && !n.backlog && !seen.has(n.id) && (sinceIso === null || n.createdAt > sinceIso))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (a.id < b.id ? -1 : 1))
    .slice(0, limit);
}

/** The opt-in weekly reminder is due once a week has passed since the last finished session. */
export function planningDue(lastFinishedIso: string | null, now: Date, reminderOn: boolean): boolean {
  if (!reminderOn) return false;
  if (!lastFinishedIso) return true;
  return now.getTime() - Date.parse(lastFinishedIso) >= 7 * 24 * 60 * 60 * 1000;
}

// ── conflicts ─────────────────────────────────────────────────

/** What a suggested fix can do on tap: park an item, or open it for editing. Never automatic. */
export interface PlanFix {
  text: string;
  action?: { type: 'park' | 'edit'; id: string };
}

export interface Conflict {
  kind: 'overlap' | 'full' | 'cycle';
  line: string;
  fix: PlanFix;
}

export interface ConflictInput {
  now: Date;
  nodes: readonly Node[];
  links: readonly Link[];
  occurrences: readonly Occurrence[];
  opts?: PeriodOptions;
  sleepTime?: string;
  timeFormat?: TimeFormat;
}

/** At most this many conflicts per session: a few, not a list of everything. */
export const CONFLICTS_MAX = 2;
const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const MIN = 60_000;

const quote = (t: string) => `"${t.trim().split(/\s+/).slice(0, 6).join(' ')}"`;

/** Overlapping fixed times, a full day (the Now card's workload guard), and things that wait on each other. */
export function detectConflicts(input: ConflictInput): Conflict[] {
  const tz = input.opts?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const nowMs = input.now.getTime();
  const doneIds = new Set(activeOccurrences(input.occurrences).filter((o) => o.type === 'done').map((o) => o.nodeId));
  const open = input.nodes.filter((n): n is Commitment => n.kind === 'commitment' && !doneIds.has(n.id) && !isParked(n.id, input.occurrences));
  const minutes = (c: Commitment) => c.durationMinutes ?? DEFAULT_DURATION_MIN;
  const out: Conflict[] = [];

  // Overlapping fixed times in the next week.
  const timed = open
    .filter((c) => c.fixedTime && Number.isFinite(Date.parse(c.fixedTime)) && Date.parse(c.fixedTime) >= nowMs && Date.parse(c.fixedTime) <= nowMs + HORIZON_MS)
    .sort((a, b) => Date.parse(a.fixedTime!) - Date.parse(b.fixedTime!));
  for (let i = 0; i + 1 < timed.length; i++) {
    const a = timed[i]!;
    const b = timed[i + 1]!;
    if (Date.parse(b.fixedTime!) < Date.parse(a.fixedTime!) + minutes(a) * MIN) {
      const p = localParts(new Date(b.fixedTime!), tz);
      out.push({
        kind: 'overlap',
        line: `${quote(a.title)} and ${quote(b.title)} overlap at ${formatClock(p.h, p.mi, input.timeFormat)}.`,
        fix: { text: `Move ${quote(b.title)} to after ${quote(a.title)}?`, action: { type: 'edit', id: b.id } },
      });
    }
  }

  // A full day: the same guard the Now card uses, so the two never disagree.
  const guard = rankNow({
    now: input.now, nodes: input.nodes, links: input.links, occurrences: input.occurrences,
    opts: input.opts, sleepTime: input.sleepTime, timeFormat: input.timeFormat,
  }).workloadGuard;
  if (guard.show) {
    const today = dayKey(input.now, tz);
    const biggest = open
      .filter((c) => !c.fixedTime && c.deadline && dayKey(new Date(c.deadline), tz) <= today)
      .sort((a, b) => minutes(b) - minutes(a) || (a.id < b.id ? -1 : 1))[0];
    out.push({
      kind: 'full',
      line: 'Today looks full.',
      fix: biggest ? { text: `Park ${quote(biggest.title)} for now?`, action: { type: 'park', id: biggest.id } } : { text: 'Pick one thing to park.' },
    });
  }

  // Things that wait on each other.
  const byId = new Map(input.nodes.map((n) => [n.id, n] as const));
  const requires = new Map<string, string[]>();
  for (const l of input.links) {
    if (l.type === 'requires' && byId.has(l.fromId) && byId.has(l.toId)) (requires.get(l.fromId) ?? requires.set(l.fromId, []).get(l.fromId)!).push(l.toId);
  }
  const cycle = findCycle(requires);
  if (cycle) {
    const names = cycle.slice(0, 3).map((id) => quote(byId.get(id)!.title)).join(', ');
    out.push({ kind: 'cycle', line: `These wait on each other: ${names}.`, fix: { text: 'Remove one of the waits?', action: { type: 'edit', id: cycle[0]! } } });
  }

  return out.slice(0, CONFLICTS_MAX);
}

/** The first cycle in a directed graph (ids in loop order), or null. Visits each node once. */
function findCycle(edges: Map<string, string[]>): string[] | null {
  const state = new Map<string, 1 | 2>(); // 1 on the current path, 2 finished
  const path: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 1);
    path.push(id);
    for (const next of edges.get(id) ?? []) {
      if (state.get(next) === 1) return path.slice(path.indexOf(next));
      if (!state.has(next)) {
        const found = visit(next);
        if (found) return found;
      }
    }
    path.pop();
    state.set(id, 2);
    return null;
  };
  for (const id of [...edges.keys()].sort()) {
    if (!state.has(id)) {
      const found = visit(id);
      if (found) return found;
    }
  }
  return null;
}

// ── recap ─────────────────────────────────────────────────────

export type RecapPeriod = 'week' | 'month' | 'quarter';

export interface RecapInput {
  nodes: readonly Node[];
  links: readonly Link[];
  occurrences: readonly Occurrence[];
  at: Date;
  period: RecapPeriod;
  opts?: PeriodOptions;
}

const THIS: Record<RecapPeriod, string> = { week: 'this week', month: 'this month', quarter: 'this quarter' };
const ADJ: Record<RecapPeriod, string> = { week: 'weekly', month: 'monthly', quarter: 'quarterly' };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * At most three lines: what was kept, how the habits of that period are going, and one Goal that moved.
 * Only good news and neutral facts: nothing missed, undone, or counted as a streak.
 */
export function recapLines(input: RecapInput): string[] {
  const window = periodWindow(input.period, input.at, input.opts);
  const lines: string[] = [];

  const kept = keptInWindow([...input.occurrences], window);
  if (kept > 0) lines.push(`${plural(kept, 'thing')} kept ${THIS[input.period]}.`);

  const habits = input.nodes.filter((n): n is Habit => n.kind === 'habit' && !n.quiet && n.recurrence.period === input.period);
  if (habits.length > 0) {
    const met = habits.filter((h) => habitProgress(h, [...input.occurrences], input.at, input.opts).met).length;
    lines.push(`${met} of ${habits.length} ${ADJ[input.period]} ${habits.length === 1 ? 'habit' : 'habits'} met so far.`);
  }

  const moved = goalThatMoved(input.nodes, input.links, input.occurrences, window);
  if (moved) lines.push(`${moved.goal.title.trim()} moved forward: ${plural(moved.steps, 'step')} done.`);

  return lines.slice(0, 3);
}

/** The Goal with the most steps finished inside the window (oldest wins a tie), or null if none moved. */
function goalThatMoved(nodes: readonly Node[], links: readonly Link[], occs: readonly Occurrence[], window: ReturnType<typeof periodWindow>): { goal: Goal; steps: number } | null {
  const children = childrenOf(links);
  const doneInWindow = new Set(activeOccurrences([...occs]).filter((o) => o.type === 'done' && inWindow(window, new Date(o.at))).map((o) => o.nodeId));
  let best: { goal: Goal; steps: number } | null = null;
  const goals = nodes.filter((n): n is Goal => n.kind === 'goal').sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : 1));
  for (const goal of goals) {
    const steps = descendants(goal.id, children).filter((id) => doneInWindow.has(id)).length;
    if (steps > 0 && (!best || steps > best.steps)) best = { goal, steps };
  }
  return best;
}
