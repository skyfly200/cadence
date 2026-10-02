/**
 * Device-only state for the Signals screen (SPEC section 11, ticket 13): whether it is
 * switched on (off by default), a small history of settings changes and nudge events,
 * the weekly feeling check, answered checkpoints and the running experiment.
 * Nothing here is sent anywhere. Plain localStorage, wrapped so a blocked store never
 * breaks the app.
 */
import type { Experiment, NudgeAction, SignalEvent } from '../domain/signals';

const ON_KEY = 'cadence:signalsOn';
const EVENTS_KEY = 'cadence:signalsEvents';
const FEELING_KEY = 'cadence:signalsFeeling';
const CHECKPOINTS_KEY = 'cadence:signalsCheckpoints';
const EXPERIMENT_KEY = 'cadence:signalsExperiment';
/** The event history keeps only the newest entries. */
export const EVENT_CAP = 1500;

function read(key: string): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value);
  } catch { /* storage blocked */ }
}
function readJson<T>(key: string, fallback: T): T {
  try { const v = JSON.parse(read(key) ?? 'null'); return v ?? fallback; } catch { return fallback; }
}

/** Off by default; only the author, while dog-fooding, switches it on. */
export function getSignalsOn(): boolean { return read(ON_KEY) === 'true'; }
export function setSignalsOn(on: boolean): void { write(ON_KEY, String(on)); }

// ── event history (recorded always, so an experiment has a past to compare with) ──

export function getEvents(): SignalEvent[] {
  const v = readJson<unknown>(EVENTS_KEY, []);
  return Array.isArray(v) ? (v as SignalEvent[]).filter((e) => e && (e.type === 'setting' || e.type === 'nudge') && typeof e.at === 'string') : [];
}
function push(e: SignalEvent): void { write(EVENTS_KEY, JSON.stringify([...getEvents(), e].slice(-EVENT_CAP))); }

/** A feature switched on or off. Repeats of the state it is already in are not recorded. */
export function recordSetting(key: string, on: boolean, now: Date = new Date()): void {
  const last = [...getEvents()].reverse().find((e) => e.type === 'setting' && e.key === key);
  if (last && last.type === 'setting' && last.on === on) return;
  push({ type: 'setting', at: now.toISOString(), key, on });
}
export function recordNudge(kind: string, action: NudgeAction, now: Date = new Date()): void {
  push({ type: 'nudge', at: now.toISOString(), kind, action });
}

// ── weekly feeling check ──

export type Feeling = 'lighter' | 'same' | 'heavier';
export interface FeelingCheck { week: string; value: Feeling; at: string }

export function getFeelings(): FeelingCheck[] {
  const v = readJson<unknown>(FEELING_KEY, []);
  return Array.isArray(v) ? (v as FeelingCheck[]).filter((f) => f && typeof f.week === 'string' && ['lighter', 'same', 'heavier'].includes(f.value)) : [];
}
/** The check for a week (its start as an ISO string), or null: it is asked once and can be skipped. */
export function feelingFor(week: string): Feeling | null { return getFeelings().find((f) => f.week === week)?.value ?? null; }
export function setFeeling(week: string, value: Feeling, now: Date = new Date()): void {
  write(FEELING_KEY, JSON.stringify([...getFeelings().filter((f) => f.week !== week), { week, value, at: now.toISOString() }].slice(-60)));
}

// ── checkpoints ──

export function answeredCheckpoints(): number[] {
  const v = readJson<unknown>(CHECKPOINTS_KEY, []);
  return Array.isArray(v) ? (v as unknown[]).filter((n): n is number => typeof n === 'number') : [];
}
export function markCheckpointAnswered(n: number): void { write(CHECKPOINTS_KEY, JSON.stringify([...new Set([...answeredCheckpoints(), n])])); }

// ── the running experiment ──

export function getExperiment(): Experiment | null {
  const v = readJson<Partial<Experiment> | null>(EXPERIMENT_KEY, null);
  return v && typeof v.key === 'string' && typeof v.startedAt === 'string' && typeof v.turnedOn === 'boolean' ? { key: v.key, startedAt: v.startedAt, turnedOn: v.turnedOn } : null;
}
export function setExperiment(e: Experiment | null): void { write(EXPERIMENT_KEY, e ? JSON.stringify(e) : null); }
