/**
 * The nudge planner: which nudges should exist today, when, and with what words.
 * Pure and deterministic; it runs on the device and the AI is never involved
 * (SPEC section 6). The caller enqueues the result and delivers it; this file
 * decides nothing about delivery.
 *
 * Kinds: leave_by (a fixed time or deadline coming up), at_risk (a Background
 * item the caller says is slipping), transition (heads-up five minutes before
 * a block over 30 minutes ends, then one cue at the end) and habit_summary
 * (open day-period habits, with at most one final-stretch mention of a longer
 * one). The first three share a daily cap; the summary sits outside it.
 *
 * Rules applied here: quiet hours (a nudge inside them moves to the wake time
 * if still useful, else is dropped); one nudge per Node per day (a transition's
 * heads-up and cue count as one); "Not now" reschedules once and a second one
 * silences the Node; "Stop these" silences a kind or a Node. Nothing is ever a
 * failure: a late nudge is simply dropped.
 */
import type { Commitment, Habit, Node, Occurrence } from './types';
import { activeOccurrences } from './estimates';
import { formatClock, type TimeFormat } from './clock';
import { finalStretchMention, homeHabitsPiece } from './habits';
import { localParts, periodWindow, type PeriodOptions } from './periods';
import { isParked } from './shelf';

export type NudgeKind = 'leave_by' | 'at_risk' | 'transition' | 'habit_summary';

export const NUDGE_KINDS: readonly NudgeKind[] = ['leave_by', 'at_risk', 'transition', 'habit_summary'];

/** The cap counts these; the habit summary is outside it. */
const CAPPED: readonly NudgeKind[] = ['leave_by', 'at_risk', 'transition'];

export const DEFAULT_DAILY_CAP = 5;
/** How long before the leave time a leave-by nudge arrives. */
export const LEAVE_LEAD_MIN = 10;
export const HEADS_UP_MIN = 5;
/** Only blocks longer than this get a heads-up. */
export const HEADS_UP_BLOCK_OVER_MIN = 30;
/** A "Not now" brings the nudge back this much later (once). */
export const NOT_NOW_RESCHEDULE_MIN = 30;
/** The habit summary is dropped this long after its time. */
const SUMMARY_USEFUL_MIN = 180;
/** A transition cue stays useful this long after the block ends. */
const TRANSITION_USEFUL_MIN = 15;
const AT_RISK_USEFUL_MIN = 120;

const MIN = 60_000;

export interface NudgeSettings {
  /** 'HH:mm'. Quiet hours run from sleepTime to wakeTime. */
  wakeTime: string;
  sleepTime: string;
  /** Daily cap on leave_by + at_risk + transition. Default 5. */
  dailyCap?: number;
  /** 'HH:mm' the habit summary is sent. Default '18:00'. */
  habitSummaryTime?: string;
}

/** What the user told us with "Not now" and "Stop these". Synced, so every device agrees. */
export interface NudgeFeedback {
  stoppedKinds: readonly NudgeKind[];
  stoppedNodes: readonly string[];
  /** Per Node: how many times a nudge was dismissed with "Not now", and the last time. */
  notNow: Readonly<Record<string, { count: number; lastAt: string }>>;
}

export const NO_FEEDBACK: NudgeFeedback = { stoppedKinds: [], stoppedNodes: [], notNow: {} };

/** A nudge already enqueued or delivered today (by any device); counts against the caps. */
export interface IssuedNudge {
  id: string;
  kind: NudgeKind;
  nodeId: string | null;
  /** Local day 'YYYY-MM-DD' it belongs to. */
  day: string;
}

export interface Nudge {
  /** Deterministic: the same nudge planned on two devices has the same id. */
  id: string;
  kind: NudgeKind;
  nodeId: string | null;
  /** Local day 'YYYY-MM-DD'. */
  day: string;
  fireAt: string;
  /** After this instant the nudge is no longer useful and is dropped, never sent late. */
  dropAfter: string;
  title: string;
  body: string;
  /** Notification tag, so the in-app and the push copy replace each other. */
  tag: string;
  /** For habit_summary: final-stretch window keys to record as mentioned once it is sent. */
  mentions?: string[];
}

export interface PlanInput {
  now: Date;
  nodes: readonly Node[];
  occurrences: readonly Occurrence[];
  settings: NudgeSettings;
  feedback?: NudgeFeedback;
  issued?: readonly IssuedNudge[];
  /** `habitId|windowKey` pairs already given their one final-stretch mention (as lib/home/prefs stores them). */
  mentioned?: readonly string[];
  /** Kinds the user has switched off in settings. */
  disabledKinds?: readonly NudgeKind[];
  /** Travel minutes before a Commitment (the same provider the Now card uses). Default 0. */
  travel?: (c: Commitment, now: Date) => number | null | undefined;
  /** Quiet (Background) items that are slipping. Default: none. */
  atRisk?: (n: Commitment | Habit) => boolean;
  opts?: PeriodOptions;
  /** How clock times in the wording read. Default '12'. */
  timeFormat?: TimeFormat;
}

// ── time helpers ────────────────────────────────────────────────────────

const minutesOfDay = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function clock(ms: number, tz: string, format: TimeFormat): string {
  const p = localParts(new Date(ms), tz);
  return formatClock(p.h, p.mi, format);
}

function inQuiet(ms: number, s: NudgeSettings, tz: string): boolean {
  const sleep = minutesOfDay(s.sleepTime);
  const wake = minutesOfDay(s.wakeTime);
  if (sleep === wake) return false;
  const p = localParts(new Date(ms), tz);
  const cur = p.h * 60 + p.mi;
  return sleep < wake ? cur >= sleep && cur < wake : cur >= sleep || cur < wake;
}

/** The first instant at or after `ms` that is not in quiet hours. */
function afterQuiet(ms: number, s: NudgeSettings, tz: string): number {
  if (!inQuiet(ms, s, tz)) return ms;
  const p = localParts(new Date(ms), tz);
  const delta = (minutesOfDay(s.wakeTime) - (p.h * 60 + p.mi) + 1440) % 1440;
  return ms - p.s * 1000 + delta * MIN;
}

// ── the planner ─────────────────────────────────────────────────────────

interface Draft {
  kind: NudgeKind;
  nodeId: string | null;
  /** Nudges sharing a group count once toward the cap and the one-per-Node rule. */
  group: string;
  suffix: string;
  fireMs: number;
  dropMs: number;
  title: string;
  body: string;
  mentions?: string[];
}

export function planNudges(input: PlanInput): Nudge[] {
  const { now, settings } = input;
  const opts = input.opts ?? {};
  const tz = opts.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tf = input.timeFormat ?? '12';
  const fb = input.feedback ?? NO_FEEDBACK;
  const nowMs = now.getTime();
  const today = periodWindow('day', now, opts);
  const dayEndMs = today.end.getTime();
  const day = today.key.slice(today.key.indexOf(':') + 1);
  const cap = Math.max(0, settings.dailyCap ?? DEFAULT_DAILY_CAP);
  const disabled = new Set(input.disabledKinds ?? []);
  const stoppedKinds = new Set(fb.stoppedKinds);
  const stoppedNodes = new Set(fb.stoppedNodes);

  const live = activeOccurrences(input.occurrences);
  const doneIds = new Set(live.filter((o) => o.type === 'done').map((o) => o.nodeId));
  const travelOf = (c: Commitment) => Math.max(0, input.travel?.(c, now) ?? 0);

  const drafts: Draft[] = [];

  // ── per Commitment ──────────────────────────────────────────────────
  for (const c of input.nodes) {
    if (c.kind !== 'commitment') continue;
    if (doneIds.has(c.id) || isParked(c.id, input.occurrences)) continue;
    const fixed = c.fixedTime ? Date.parse(c.fixedTime) : NaN;
    const deadline = c.deadline ? Date.parse(c.deadline) : NaN;
    const duration = c.durationMinutes ?? 0;

    if (c.quiet) {
      if (input.atRisk?.(c) === true) {
        drafts.push({
          kind: 'at_risk', nodeId: c.id, group: `at_risk|${c.id}`, suffix: '',
          fireMs: nowMs, dropMs: nowMs + AT_RISK_USEFUL_MIN * MIN,
          title: c.title, body: 'This one could use a look when you have a moment.',
        });
      }
      continue;
    }

    if (Number.isFinite(fixed)) {
      const travel = travelOf(c);
      const leaveMs = fixed - travel * MIN;
      drafts.push({
        kind: 'leave_by', nodeId: c.id, group: `leave_by|${c.id}`, suffix: '',
        fireMs: leaveMs - LEAVE_LEAD_MIN * MIN, dropMs: travel > 0 ? leaveMs : fixed,
        title: travel > 0 ? `Leave by ${clock(leaveMs, tz, tf)}` : `${c.title} is at ${clock(fixed, tz, tf)}`,
        body: travel > 0 ? `${c.title} is at ${clock(fixed, tz, tf)}.` : '',
      });
      if (duration > 0) {
        const endMs = fixed + duration * MIN;
        const group = `transition|${c.id}`;
        if (duration > HEADS_UP_BLOCK_OVER_MIN) {
          drafts.push({
            kind: 'transition', nodeId: c.id, group, suffix: 'heads_up',
            fireMs: endMs - HEADS_UP_MIN * MIN, dropMs: endMs,
            title: `${c.title} wraps up in ${HEADS_UP_MIN} minutes`, body: 'A good moment to find a stopping point.',
          });
        }
        drafts.push({
          kind: 'transition', nodeId: c.id, group, suffix: 'next',
          fireMs: endMs, dropMs: endMs + TRANSITION_USEFUL_MIN * MIN,
          title: 'Time for the next thing', body: 'Your Now card has what comes next.',
        });
      }
    } else if (Number.isFinite(deadline)) {
      const startBy = deadline - (duration > 0 ? duration : 0) * MIN - travelOf(c) * MIN;
      drafts.push({
        kind: 'leave_by', nodeId: c.id, group: `leave_by|${c.id}`, suffix: '',
        fireMs: startBy - LEAVE_LEAD_MIN * MIN, dropMs: deadline,
        title: `${c.title}: start by ${clock(startBy, tz, tf)}`, body: `It is due at ${clock(deadline, tz, tf)}.`,
      });
    }
  }

  // ── habits: at risk, and the daily summary ──────────────────────────
  for (const h of input.nodes) {
    if (h.kind !== 'habit' || !h.quiet || input.atRisk?.(h) !== true) continue;
    drafts.push({
      kind: 'at_risk', nodeId: h.id, group: `at_risk|${h.id}`, suffix: '',
      fireMs: nowMs, dropMs: nowMs + AT_RISK_USEFUL_MIN * MIN,
      title: h.title, body: 'This one could use a look when you have a moment.',
    });
  }

  const habits = input.nodes.filter((n): n is Habit => n.kind === 'habit');
  const open = homeHabitsPiece(habits, input.occurrences, now, opts).habits.filter((r) => !r.done).map((r) => r.habit.title);
  const mentions: string[] = [];
  for (const h of habits) {
    const seen = (input.mentioned ?? []).filter((m) => m.startsWith(`${h.id}|`)).map((m) => m.split('|')[1]!);
    const key = finalStretchMention(h, input.occurrences, now, seen, opts);
    if (key) { open.push(h.title); mentions.push(`${h.id}|${key}`); }
  }
  if (open.length > 0) {
    const at = today.start.getTime() + minutesOfDay(settings.habitSummaryTime ?? '18:00') * MIN;
    drafts.push({
      kind: 'habit_summary', nodeId: null, group: 'habit_summary|', suffix: '',
      fireMs: at, dropMs: at + SUMMARY_USEFUL_MIN * MIN,
      title: 'Habits still open today', body: open.join(', '),
      ...(mentions.length ? { mentions } : {}),
    });
  }

  // ── filters, in order of fire time ──────────────────────────────────
  drafts.sort((a, b) => a.fireMs - b.fireMs || (a.group + a.suffix < b.group + b.suffix ? -1 : 1));

  const issued = input.issued ?? [];
  const issuedIds = new Set(issued.map((i) => i.id));
  // one nudge per Node per kind per day; a transition's heads-up and cue are one group
  const usedGroups = new Set(issued.filter((i) => i.day === day).map((i) => `${i.kind}|${i.nodeId ?? ''}`));
  let capped = issued.filter((i) => i.day === day && CAPPED.includes(i.kind)).length;
  const out: Nudge[] = [];

  for (const d of drafts) {
    if (disabled.has(d.kind) || stoppedKinds.has(d.kind)) continue;
    if (d.nodeId && stoppedNodes.has(d.nodeId)) continue;

    let fireMs = d.fireMs;
    const nn = d.nodeId ? fb.notNow[d.nodeId] : undefined;
    if (nn && nn.count >= 2) continue; // a second "Not now" silences the Node
    if (nn && nn.count === 1) {
      const last = Date.parse(nn.lastAt);
      if (last >= fireMs && last < dayEndMs) fireMs = Math.max(fireMs, last + NOT_NOW_RESCHEDULE_MIN * MIN);
    }
    // a nudge that is due now but was planned late still goes; one past its useful life does not
    fireMs = Math.max(fireMs, nowMs);
    fireMs = afterQuiet(fireMs, settings, tz);
    if (fireMs > d.dropMs || fireMs >= dayEndMs) continue;

    const id = `${d.kind}|${d.nodeId ?? '-'}|${day}${d.suffix ? `|${d.suffix}` : ''}`;
    if (issuedIds.has(id)) continue;

    if (!usedGroups.has(d.group)) {
      if (CAPPED.includes(d.kind)) {
        if (capped >= cap) continue;
        capped += 1;
      }
      usedGroups.add(d.group);
    } else if (d.suffix === '') continue;

    out.push({
      id, kind: d.kind, nodeId: d.nodeId, day,
      fireAt: new Date(fireMs).toISOString(), dropAfter: new Date(d.dropMs).toISOString(),
      title: d.title, body: d.body, tag: id,
      ...(d.mentions ? { mentions: d.mentions } : {}),
    });
  }
  return out;
}
