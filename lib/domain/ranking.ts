/**
 * The Now card ranking (ticket 23). On-device, deterministic, no AI: the same
 * input always gives the same output, `now` is an input, and nothing is mutated.
 *
 * Conventions
 * - Link direction: for `requires`, `fromId` is the Commitment that needs the
 *   other and `toId` is its prerequisite ("load the car" requires "cooler out":
 *   fromId = load the car, toId = cooler out). For `part_of`, fromId is the
 *   child and toId the parent (Goal). For `at`, toId is the place Thing.
 * - A Commitment is done when it has an active (not undone) `done` Occurrence.
 *
 * Tiers (the first tier that has candidates wins)
 *   1 time-critical   a fixed-time item (or a pinned habit slot) whose start-by
 *                     moment is within the next hour. Start-by = fixed time -
 *                     duration - travel. It stops being time-critical one hour
 *                     after its fixed time (no endless "late" state).
 *   2 unblockers      a ready item that (transitively) a time-critical item requires.
 *   3 due today       a deadline today (or already past), earliest first; a
 *                     habit pinned to today; a longer-period habit in its final stretch.
 *   4 goal next step  the oldest ready item under each active Goal.
 *   5 the rest        older captures first; unpinned open day habits.
 * Tie-breaks: tiers 1-3 are ordered by time, then energy (low: shortest first;
 * good: slog-tagged first). Tiers 4-5 have no urgency key, so energy chooses
 * first and age breaks the tie.
 *
 * Items that are not doable now are not candidates: not ready (a prerequisite is
 * open), outside their time window, parked, quiet (Background) unless the
 * `atRisk` hook says otherwise, or fixed-time items still more than an hour
 * from their start-by. The last group is returned as `scheduled` strip entries.
 * Shelved ("Not now") items drop out until the shelf ends, but are never lost:
 * when nothing else remains the earliest-shelved item is the Now card.
 */
import type { Commitment, Habit, Link, Node, Occurrence } from './types';
import { FINAL_STRETCH_FROM, habitProgress } from './habits';
import { localParts, localWeekday, periodProgress, periodWindow, type PeriodOptions } from './periods';
import { DEFAULT_DURATION_MIN, activeOccurrences, learnedDuration } from './estimates';
import { SHRINK_PARK_KEEP_AT, isParked, notNowCount, shelvedSince } from './shelf';

export type Tier = 1 | 2 | 3 | 4 | 5;
export type Energy = 'low' | 'ok' | 'good';

export interface RankProviders {
  /** Minutes the item takes. Return null/undefined to use the learned or default estimate. */
  duration?: (c: Commitment) => number | null | undefined;
  /** Travel minutes before the item (online routing or the offline estimate). Default 0. */
  travel?: (c: Commitment, now: Date) => number | null | undefined;
  /** Quiet (Background) items appear only when this says they are at risk. Default: never. */
  atRisk?: (n: Commitment | Habit) => boolean;
}

export interface RankInput {
  now: Date;
  nodes: readonly Node[];
  links: readonly Link[];
  occurrences: readonly Occurrence[];
  energy?: Energy;
  /** 0 Simple, 1 Balanced, 2 Rich: the strip shows 1, 3 or 5 items. Default 1. */
  density?: 0 | 1 | 2;
  /** Start of the sleep window, 'HH:mm'. Default '23:00'. */
  sleepTime?: string;
  opts?: PeriodOptions;
  providers?: RankProviders;
}

export interface RankedItem {
  node: Commitment | Habit;
  tier: Tier;
  /** True for fixed-time items that are not doable yet: shown in the strip as "At 8:00". */
  scheduled: boolean;
  startBy: Date | null;
  minutes: number;
  travelMinutes: number;
  /** Under twelve words. */
  reason: string;
  /** What finishing this unblocks, nearest first ("unblocks: Load the projector"). */
  chain: string[];
}

export interface WorkloadGuard {
  show: boolean;
  line: string | null;
  openMinutes: number;
  availableMinutes: number;
}

export interface RankResult {
  now: RankedItem | null;
  strip: RankedItem[];
  tier: Tier | null;
  reason: string | null;
  chain: string[];
  /** The fourth Not now on the same item: offer shrink, park or keep. */
  offerShrinkParkKeep: boolean;
  workloadGuard: WorkloadGuard;
}

const MIN = 60_000;
const TIME_CRITICAL_WITHIN_MIN = 60;
const LAPSE_GRACE_MIN = 60;
const HABIT_MINUTES = 10;
const HABIT_SLOT_WINDOW_MIN = 60;
const BUFFER = 0.2;
const GUARD_LINE = 'Today looks full. Want to park a few?';

const PERIOD_WORD: Record<string, string> = {
  day: 'today', week: 'this week', month: 'this month', quarter: 'this quarter',
  four_months: 'these 4 months', six_months: 'these 6 months', year: 'this year',
};

const short = (title: string, words = 5) => title.trim().split(/\s+/).slice(0, words).join(' ');
const minutesOfDay = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

interface Cand {
  node: Commitment | Habit;
  tier: Tier;
  scheduled: boolean;
  key: number;
  created: number;
  slog: boolean;
  minutes: number;
  travel: number;
  startBy: Date | null;
  reason: string;
}

export function rankNow(input: RankInput): RankResult {
  const { now } = input;
  const nowMs = now.getTime();
  const opts = input.opts ?? {};
  const tz = opts.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const energy: Energy = input.energy ?? 'ok';
  const density = input.density ?? 1;
  const prov = input.providers ?? {};
  const rawOccs = input.occurrences;
  const day = periodWindow('day', now, opts);
  const fmt = (ms: number) => {
    const p = localParts(new Date(ms), tz);
    return `${p.h % 12 || 12}:${String(p.mi).padStart(2, '0')}`;
  };

  const doneIds = new Set(activeOccurrences(rawOccs).filter((o) => o.type === 'done').map((o) => o.nodeId));
  const byId = new Map(input.nodes.map((n) => [n.id, n] as const));
  const history = { nodes: input.nodes, links: input.links, occurrences: rawOccs };

  const durationOf = (c: Commitment): number => {
    const p = prov.duration?.(c);
    if (typeof p === 'number' && p > 0) return p;
    return c.durationMinutes ?? learnedDuration(c, history) ?? DEFAULT_DURATION_MIN;
  };
  const travelOf = (c: Commitment): number => Math.max(0, prov.travel?.(c, now) ?? 0);

  // ── Commitments in play ───────────────────────────────────────────────
  const open = input.nodes.filter((n): n is Commitment => n.kind === 'commitment'
    && !doneIds.has(n.id) && !isParked(n.id, rawOccs) && (!n.quiet || prov.atRisk?.(n) === true));

  const prereqs = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  for (const l of input.links) {
    if (l.type !== 'requires') continue;
    (prereqs.get(l.fromId) ?? prereqs.set(l.fromId, []).get(l.fromId)!).push(l.toId);
    (dependents.get(l.toId) ?? dependents.set(l.toId, []).get(l.toId)!).push(l.fromId);
  }
  const openById = new Map(open.map((c) => [c.id, c] as const));
  const ready = (c: Commitment) => (prereqs.get(c.id) ?? []).every((id) => {
    const t = byId.get(id);
    return !t || t.kind !== 'commitment' || doneIds.has(id);
  });

  const fixedMs = (c: Commitment) => (c.fixedTime ? Date.parse(c.fixedTime) : NaN);
  const startByMs = (c: Commitment) => fixedMs(c) - (durationOf(c) + travelOf(c)) * MIN;
  const fixedActive = (c: Commitment) => Number.isFinite(fixedMs(c)) && fixedMs(c) + LAPSE_GRACE_MIN * MIN >= nowMs;
  const timeCritical = (c: Commitment) => fixedActive(c) && startByMs(c) <= nowMs + TIME_CRITICAL_WITHIN_MIN * MIN;

  // earliest start-by among time-critical items reachable through dependents (including the item itself)
  const critMemo = new Map<string, number | null>();
  const criticalStart = (id: string, seen = new Set<string>()): number | null => {
    if (critMemo.has(id)) return critMemo.get(id)!;
    if (seen.has(id)) return null;
    seen.add(id);
    const c = openById.get(id);
    let best: number | null = c && timeCritical(c) ? startByMs(c) : null;
    for (const d of dependents.get(id) ?? []) {
      const s = criticalStart(d, seen);
      if (s !== null && (best === null || s < best)) best = s;
    }
    critMemo.set(id, best);
    return best;
  };

  const inWindowNow = (c: Commitment): boolean => {
    if (!c.windowStart && !c.windowEnd) return true;
    const p = localParts(now, tz);
    const cur = p.h * 60 + p.mi;
    const a = c.windowStart ? minutesOfDay(c.windowStart) : 0;
    const b = c.windowEnd ? minutesOfDay(c.windowEnd) : 24 * 60;
    return a <= b ? cur >= a && cur <= b : cur >= a || cur <= b;
  };

  // ── candidate set ─────────────────────────────────────────────────────
  const eligible: Commitment[] = [];
  const scheduledItems: Cand[] = [];
  for (const c of open) {
    const tc = timeCritical(c);
    const futureFixed = fixedActive(c) && !tc;
    if (futureFixed || (!ready(c) && fixedActive(c))) {
      if (fixedMs(c) < day.end.getTime()) {
        scheduledItems.push({
          node: c, tier: 5, scheduled: true, key: fixedMs(c), created: Date.parse(c.createdAt), slog: c.slog,
          minutes: durationOf(c), travel: travelOf(c), startBy: new Date(startByMs(c)), reason: `At ${fmt(fixedMs(c))}`,
        });
      }
      continue;
    }
    if (!ready(c) || !inWindowNow(c)) continue;
    eligible.push(c);
  }

  // next step per active Goal: the oldest eligible descendant, first Goal to claim it wins
  const children = new Map<string, string[]>();
  for (const l of input.links) if (l.type === 'part_of') (children.get(l.toId) ?? children.set(l.toId, []).get(l.toId)!).push(l.fromId);
  const eligibleById = new Map(eligible.map((c) => [c.id, c] as const));
  const goalStep = new Map<string, string>(); // commitment id -> goal title
  const goals = input.nodes.filter((n) => n.kind === 'goal')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : 1));
  for (const g of goals) {
    const found: Commitment[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const child of children.get(id) ?? []) {
        const e = eligibleById.get(child);
        if (e) found.push(e);
        walk(child);
      }
    };
    walk(g.id);
    found.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : 1));
    const step = found.find((c) => !goalStep.has(c.id));
    if (step) goalStep.set(step.id, g.title);
  }

  const cands: Cand[] = [];
  const deadlineMs = (c: Commitment) => (c.deadline ? Date.parse(c.deadline) : NaN);
  const nearestDependent = (id: string): Commitment | null => {
    let best: Commitment | null = null;
    let bestS = Infinity;
    for (const d of dependents.get(id) ?? []) {
      const dep = openById.get(d);
      const s = criticalStart(d);
      if (dep && s !== null && s < bestS) { best = dep; bestS = s; }
    }
    return best;
  };
  for (const c of eligible) {
    const base = { node: c, scheduled: false, created: Date.parse(c.createdAt), slog: c.slog, minutes: durationOf(c), travel: travelOf(c) };
    if (timeCritical(c)) {
      cands.push({ ...base, tier: 1, key: startByMs(c), startBy: new Date(startByMs(c)), reason: `Leave by ${fmt(startByMs(c))}, so this comes first` });
      continue;
    }
    const crit = criticalStart(c.id);
    if (crit !== null) {
      const dep = nearestDependent(c.id);
      cands.push({ ...base, tier: 2, key: crit, startBy: null, reason: `It unblocks ${short(dep?.title ?? 'what is next')}` });
      continue;
    }
    const dl = deadlineMs(c);
    if (Number.isFinite(dl) && dl < day.end.getTime()) {
      cands.push({ ...base, tier: 3, key: dl, startBy: null, reason: "It's due today" });
      continue;
    }
    const goalTitle = goalStep.get(c.id);
    if (goalTitle !== undefined) {
      cands.push({ ...base, tier: 4, key: 0, startBy: null, reason: `The next step for ${short(goalTitle)}` });
      continue;
    }
    cands.push({ ...base, tier: 5, key: 0, startBy: null, reason: 'Up next' });
  }

  // ── habits ────────────────────────────────────────────────────────────
  const weekday = localWeekday(now, opts);
  for (const h of input.nodes) {
    if (h.kind !== 'habit') continue;
    if (h.quiet && prov.atRisk?.(h) !== true) continue;
    if (isParked(h.id, rawOccs)) continue;
    const p = habitProgress(h, rawOccs, now, opts);
    if (p.met) continue;
    const base = { node: h, scheduled: false, created: Date.parse(h.createdAt), slog: false, minutes: HABIT_MINUTES, travel: 0 };
    const days = h.pin?.weekdays;
    const slots = h.pin?.timesOfDay;
    if (days && days.length > 0 && !days.includes(weekday)) continue;
    if (slots && slots.length > 0) {
      let best: number | null = null;
      for (const s of slots) {
        const ms = day.start.getTime() + minutesOfDay(s) * MIN;
        if (Math.abs(ms - nowMs) <= HABIT_SLOT_WINDOW_MIN * MIN && (best === null || Math.abs(ms - nowMs) < Math.abs(best - nowMs))) best = ms;
      }
      if (best !== null) cands.push({ ...base, tier: 1, key: best, startBy: new Date(best), reason: `Right on time for ${short(h.title)}` });
      continue;
    }
    if (days && days.length > 0) {
      cands.push({ ...base, tier: 3, key: day.end.getTime(), startBy: null, reason: "It's due today" });
    } else if (h.recurrence.period === 'day') {
      cands.push({ ...base, tier: 5, key: 0, startBy: null, reason: 'Up next' });
    } else if (periodProgress(p.window, now) >= FINAL_STRETCH_FROM) {
      cands.push({ ...base, tier: 3, key: p.window.end.getTime(), startBy: null, reason: `Still open ${PERIOD_WORD[h.recurrence.period] ?? 'this period'}` });
    }
  }

  // ── ordering ──────────────────────────────────────────────────────────
  const energyCmp = (a: Cand, b: Cand): number => {
    if (energy === 'low') return a.minutes - b.minutes;
    if (energy === 'good') return (a.slog ? 0 : 1) - (b.slog ? 0 : 1);
    return 0;
  };
  const cmp = (a: Cand, b: Cand): number => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const e = energyCmp(a, b);
    if (a.tier <= 3) {
      if (a.key !== b.key) return a.key - b.key;
      if (e) return e;
    } else if (e) return e;
    if (a.created !== b.created) return a.created - b.created;
    return a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0;
  };

  const shelved = new Map<string, number>();
  const live: Cand[] = [];
  const shelvedCands: Cand[] = [];
  for (const c of cands) {
    const since = shelvedSince(c.node.id, rawOccs, now);
    // an item whose time to go has already come is never shelved away
    const overdueStart = c.tier === 1 && c.startBy !== null && c.startBy.getTime() <= nowMs;
    if (since && !overdueStart) { shelved.set(c.node.id, since.getTime()); shelvedCands.push(c); } else live.push(c);
  }
  live.sort(cmp);
  shelvedCands.sort((a, b) => shelved.get(a.node.id)! - shelved.get(b.node.id)! || cmp(a, b));
  scheduledItems.sort((a, b) => a.key - b.key || (a.node.id < b.node.id ? -1 : 1));

  // ── chains (what finishing this unblocks) ─────────────────────────────
  const chainOf = (id: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>([id]);
    let frontier = [id];
    while (frontier.length > 0 && out.length < 3) {
      const next: string[] = [];
      for (const f of frontier) {
        for (const d of dependents.get(f) ?? []) {
          const dep = openById.get(d);
          if (!dep || seen.has(d)) continue;
          seen.add(d);
          out.push(`unblocks: ${dep.title}`);
          next.push(d);
        }
      }
      frontier = next;
    }
    return out.slice(0, 3);
  };
  const toItem = (c: Cand): RankedItem => ({
    node: c.node, tier: c.tier, scheduled: c.scheduled, startBy: c.startBy, minutes: c.minutes,
    travelMinutes: c.travel, reason: c.reason, chain: c.node.kind === 'commitment' ? chainOf(c.node.id) : [],
  });

  const ordered = [...live, ...shelvedCands];
  const nowCand = ordered[0] ?? null;
  const nowItem = nowCand ? toItem(nowCand) : null;

  const stripBase = density === 0 ? 1 : density === 1 ? 3 : 5;
  const stripCount = energy === 'low' ? Math.min(stripBase, 2) : stripBase;
  const strip = [...ordered.slice(1), ...scheduledItems].slice(0, stripCount).map(toItem);

  // ── workload guard ────────────────────────────────────────────────────
  const sleepMs = day.start.getTime() + minutesOfDay(input.sleepTime ?? '23:00') * MIN;
  let fixedMinutes = 0;
  let openMinutes = 0;
  for (const c of open) {
    if (fixedActive(c) && fixedMs(c) < day.end.getTime() && fixedMs(c) >= nowMs - LAPSE_GRACE_MIN * MIN) {
      fixedMinutes += durationOf(c) + travelOf(c);
    } else if (!Number.isFinite(fixedMs(c)) || !fixedActive(c)) {
      const dl = deadlineMs(c);
      if (Number.isFinite(dl) && dl < day.end.getTime()) openMinutes += durationOf(c);
    }
  }
  const availableMinutes = Math.max(0, ((sleepMs - nowMs) / MIN - fixedMinutes) * (1 - BUFFER));
  const show = openMinutes > 0 && openMinutes > availableMinutes;
  const workloadGuard: WorkloadGuard = {
    show, line: show ? GUARD_LINE : null,
    openMinutes: Math.round(openMinutes), availableMinutes: Math.round(availableMinutes),
  };

  return {
    now: nowItem,
    strip,
    tier: nowItem ? nowItem.tier : null,
    reason: nowItem ? nowItem.reason : null,
    chain: nowItem ? nowItem.chain : [],
    offerShrinkParkKeep: nowItem ? notNowCount(nowItem.node.id, rawOccs) >= SHRINK_PARK_KEEP_AT : false,
    workloadGuard,
  };
}
