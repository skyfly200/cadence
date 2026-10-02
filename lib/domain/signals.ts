/**
 * Success signals, computed on the device from the Occurrence log and a small
 * history of settings and nudge events. Framework-free and pure.
 *
 * These are signals for the product, never for the user: nothing here is a
 * score, a streak or a failure. Lapses are counted only to improve nudges.
 * (SPEC section 11, ticket 13.)
 */
import type { Commitment, Node, Occurrence } from './types';
import { isKept } from './tally';
import { periodWindow, previousWindow, type PeriodOptions } from './periods';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// ── event history (stored on the device by lib/home/signals-state.ts) ──

/** A feature switched on or off. `key` names the mechanism, e.g. 'sound:speech'. */
export interface SettingEvent { type: 'setting'; at: string; key: string; on: boolean }
export type NudgeAction = 'shown' | 'not_now' | 'stopped';
export interface NudgeEvent { type: 'nudge'; at: string; kind: string; action: NudgeAction }
export type SignalEvent = SettingEvent | NudgeEvent;

// ── kept per week, weeks in use ─────────────────────────────────

function undoneIds(occs: readonly Occurrence[]): Set<string> {
  const undone = new Set<string>();
  for (const o of occs) if (o.type === 'undone' && o.undoes) undone.add(o.undoes);
  return undone;
}

/** Kept Occurrences that were not undone, oldest first. */
function keptList(occs: readonly Occurrence[]): Occurrence[] {
  const undone = undoneIds(occs);
  return occs.filter((o) => isKept(o) && !undone.has(o.id)).sort((a, b) => a.at.localeCompare(b.at));
}

export interface WeekCount { start: Date; kept: number }

/** The last `weeks` calendar weeks ending with the one containing `now`, oldest first. */
export function keptPerWeek(occs: readonly Occurrence[], now: Date, weeks = 8, opts: PeriodOptions = {}): WeekCount[] {
  const kept = keptList(occs);
  let w = periodWindow('week', now, opts);
  const out: WeekCount[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = w.start, end = w.end;
    out.push({ start, kept: kept.filter((o) => { const t = new Date(o.at).getTime(); return t >= start.getTime() && t < end.getTime(); }).length });
    w = previousWindow(w, opts);
  }
  return out.reverse();
}

/** Weeks with at least one kept action. */
export function weeksInUse(series: readonly WeekCount[]): number {
  return series.filter((w) => w.kept > 0).length;
}

export type Trend = 'up' | 'steady' | 'down' | 'too_early';

/** The last four weeks against the four before. Needs eight weeks of series; the current (partial) week is left out. */
export function keptTrend(series: readonly WeekCount[]): Trend {
  const done = series.slice(0, -1); // the current week is still in progress
  if (done.length < 8) return 'too_early';
  const sum = (ws: readonly WeekCount[]) => ws.reduce((t, w) => t + w.kept, 0);
  const recent = sum(done.slice(-4));
  const before = sum(done.slice(-8, -4));
  if (before === 0 && recent === 0) return 'steady';
  if (recent > before * 1.2) return 'up';
  if (recent < before * 0.8) return 'down';
  return 'steady';
}

/** Days of silence (no kept action) that count as a break. */
export const BREAK_DAYS = 7;

/**
 * Coming back after a break: the latest kept action came after at least a
 * week of none, within the last eight weeks. Returns when and how long the
 * break was, or null. Coming back is what the no-guilt promise is for.
 */
export function cameBackAfterBreak(occs: readonly Occurrence[], now: Date): { backAt: string; gapDays: number } | null {
  const kept = keptList(occs);
  const cutoff = now.getTime() - 8 * WEEK_MS;
  for (let i = kept.length - 1; i > 0; i--) {
    const at = new Date(kept[i]!.at).getTime();
    if (at < cutoff) return null;
    const gap = at - new Date(kept[i - 1]!.at).getTime();
    if (gap >= BREAK_DAYS * DAY_MS) return { backAt: kept[i]!.at, gapDays: Math.floor(gap / DAY_MS) };
  }
  return null;
}

// ── supporting signals ──────────────────────────────────────────

const HANDLED: ReadonlySet<string> = new Set(['done', 'moved', 'parked', 'skipped']);

/**
 * Fixed-time Commitments in the last `days` days that passed with no done,
 * moved, parked or skipped. Counted only to improve nudges; never shown as a failure.
 */
export function lapsedTimeCritical(nodes: readonly Node[], occs: readonly Occurrence[], now: Date, days = 28): number {
  const undone = undoneIds(occs);
  const handled = new Set(occs.filter((o) => HANDLED.has(o.type) && !undone.has(o.id)).map((o) => o.nodeId));
  const since = now.getTime() - days * DAY_MS;
  return nodes.filter((n): n is Commitment => {
    if (n.kind !== 'commitment' || !n.fixedTime) return false;
    const t = new Date(n.fixedTime).getTime();
    return t >= since && t < now.getTime() && !handled.has(n.id);
  }).length;
}

/**
 * How quickly captures get looked at: the median hours from a node's
 * 'captured' Occurrence to its first later Occurrence of any other kind.
 * `waiting` is how many captures have none yet. Null median until one is triaged.
 */
export function triageSpeed(occs: readonly Occurrence[]): { medianHours: number | null; waiting: number } {
  const captured = new Map<string, number>();
  for (const o of occs) if (o.type === 'captured') captured.set(o.nodeId, new Date(o.at).getTime());
  const first = new Map<string, number>();
  for (const o of occs) {
    if (o.type === 'captured' || o.type === 'undone') continue;
    const t = new Date(o.at).getTime();
    const c = captured.get(o.nodeId);
    if (c === undefined || t < c) continue;
    if (!first.has(o.nodeId) || t < first.get(o.nodeId)!) first.set(o.nodeId, t);
  }
  const hours = [...first.entries()].map(([id, t]) => (t - captured.get(id)!) / 3_600_000).sort((a, b) => a - b);
  const waiting = captured.size - first.size;
  if (!hours.length) return { medianHours: null, waiting };
  const mid = Math.floor(hours.length / 2);
  return { medianHours: hours.length % 2 ? hours[mid]! : (hours[mid - 1]! + hours[mid]!) / 2, waiting };
}

// ── nudge health (report only) ──────────────────────────────────

export interface NudgeHealth { kind: string; shown: number; notNow: number; stopped: number }

export function nudgeHealth(events: readonly SignalEvent[], kinds: readonly string[]): NudgeHealth[] {
  return kinds.map((kind) => {
    const mine = events.filter((e): e is NudgeEvent => e.type === 'nudge' && e.kind === kind);
    const n = (a: NudgeAction) => mine.filter((e) => e.action === a).length;
    return { kind, shown: n('shown'), notNow: n('not_now'), stopped: n('stopped') };
  });
}

// ── experiments ─────────────────────────────────────────────────

/** An experiment lasts one to two weeks; it can be read once a full week has passed. */
export const EXPERIMENT_READY_DAYS = 7;
export const EXPERIMENT_MAX_DAYS = 14;

export interface Experiment { key: string; startedAt: string; turnedOn: boolean }

export interface ExperimentResult {
  ready: boolean;
  daysAfter: number;
  keptPerWeekBefore: number;
  keptPerWeekAfter: number;
  notNowPerWeekBefore: number;
  notNowPerWeekAfter: number;
}

/**
 * Compares the same number of days before and after the change (up to two
 * weeks each). Only reads; never changes anything. Rates are per week.
 */
export function compareExperiment(occs: readonly Occurrence[], events: readonly SignalEvent[], exp: Experiment, now: Date): ExperimentResult {
  const start = new Date(exp.startedAt).getTime();
  const daysAfter = Math.max(0, (now.getTime() - start) / DAY_MS);
  const span = Math.min(Math.max(daysAfter, 1), EXPERIMENT_MAX_DAYS) * DAY_MS;
  const afterEnd = Math.min(now.getTime(), start + span);
  const beforeStart = start - span;
  const kept = keptList(occs).map((o) => new Date(o.at).getTime());
  const notNow = events.filter((e): e is NudgeEvent => e.type === 'nudge' && e.action === 'not_now').map((e) => new Date(e.at).getTime());
  const count = (ts: number[], a: number, b: number) => ts.filter((t) => t >= a && t < b).length;
  const perWeek = (n: number) => Math.round((n / (span / WEEK_MS)) * 10) / 10;
  return {
    ready: daysAfter >= EXPERIMENT_READY_DAYS,
    daysAfter: Math.floor(daysAfter),
    keptPerWeekBefore: perWeek(count(kept, beforeStart, start)),
    keptPerWeekAfter: perWeek(count(kept, start, afterEnd)),
    notNowPerWeekBefore: perWeek(count(notNow, beforeStart, start)),
    notNowPerWeekAfter: perWeek(count(notNow, start, afterEnd)),
  };
}

// ── checkpoints ─────────────────────────────────────────────────

export const CHECKPOINT_WEEKS: readonly number[] = [2, 4, 6, 8, 12];

/** The earliest checkpoint week reached since first use and not yet answered, or null. */
export function checkpointDue(firstUseIso: string | null, now: Date, answered: readonly number[]): number | null {
  if (!firstUseIso) return null;
  const weeks = Math.floor((now.getTime() - new Date(firstUseIso).getTime()) / WEEK_MS);
  return CHECKPOINT_WEEKS.find((n) => weeks >= n && !answered.includes(n)) ?? null;
}

/** First use: the earliest node or Occurrence on this device. */
export function firstUse(nodes: readonly Node[], occs: readonly Occurrence[]): string | null {
  const times = [...nodes.map((n) => n.createdAt), ...occs.map((o) => o.at)].filter(Boolean).sort();
  return times[0] ?? null;
}

// ── keep-or-cut rule of thumb ───────────────────────────────────

/** Whether a mechanism was on at a moment, from its recorded switches. Before any record it is `defaultOn`. */
export function wasOn(events: readonly SignalEvent[], key: string, defaultOn: boolean, at: Date): boolean {
  const mine = events.filter((e): e is SettingEvent => e.type === 'setting' && e.key === key).sort((a, b) => a.at.localeCompare(b.at));
  if (!mine.length) return defaultOn;
  let state = !mine[0]!.on;
  for (const e of mine) { if (new Date(e.at).getTime() > at.getTime()) break; state = e.on; }
  return state;
}

export type Verdict = 'keep' | 'rework' | 'undecided' | 'too_early';

export interface MechanismRule {
  /** Weeks (of the last twelve since first use) the mechanism was on at the end of the week. */
  weeksOn: number;
  weeksTotal: number;
  /** "Stop these" taps in the last two weeks rose against the two before. */
  stopsRose: boolean;
  /** It was switched off within two weeks of being on. */
  switchedOffQuickly: boolean;
}

/**
 * Keep a mechanism if it was on in at least half the weeks and "Stop these"
 * did not rise; cut or rework it if it was switched off within two weeks.
 * Guidance for the author, never an automatic change.
 */
export function mechanismVerdict(r: MechanismRule): Verdict {
  if (r.weeksTotal < 2) return 'too_early';
  if (r.switchedOffQuickly) return 'rework';
  if (r.weeksOn * 2 >= r.weeksTotal && !r.stopsRose) return 'keep';
  return 'undecided';
}

/** Build the rule inputs for one mechanism from the event history. `nudgeKind` ties it to a nudge type's "Stop these" taps. */
export function ruleFor(events: readonly SignalEvent[], key: string, defaultOn: boolean, firstUseIso: string | null, now: Date, nudgeKind?: string): MechanismRule {
  const first = firstUseIso ? new Date(firstUseIso) : now;
  const weeksTotal = Math.min(12, Math.max(0, Math.floor((now.getTime() - first.getTime()) / WEEK_MS)));
  let weeksOn = 0;
  for (let i = 1; i <= weeksTotal; i++) {
    if (wasOn(events, key, defaultOn, new Date(first.getTime() + i * WEEK_MS))) weeksOn++;
  }
  const mine = events.filter((e): e is SettingEvent => e.type === 'setting' && e.key === key).sort((a, b) => a.at.localeCompare(b.at));
  // Before its first recorded switch the mechanism had the opposite of that switch (or its default).
  let onSince: number | null = (mine.length ? !mine[0]!.on : defaultOn) ? first.getTime() : null;
  let switchedOffQuickly = false;
  for (const e of mine) {
    const t = new Date(e.at).getTime();
    if (e.on) onSince = t;
    else { if (onSince !== null && t - onSince <= 2 * WEEK_MS) switchedOffQuickly = true; onSince = null; }
  }
  const n = now.getTime();
  const stops = (a: number, b: number) => events.filter((e) => e.type === 'nudge' && e.kind === nudgeKind && e.action === 'stopped' && new Date(e.at).getTime() >= a && new Date(e.at).getTime() < b).length;
  const stopsRose = nudgeKind ? stops(n - 2 * WEEK_MS, n) > stops(n - 4 * WEEK_MS, n - 2 * WEEK_MS) : false;
  return { weeksOn, weeksTotal, stopsRose, switchedOffQuickly };
}
