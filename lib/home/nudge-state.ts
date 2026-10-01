/**
 * Nudge state management: feedback, issued nudges, and persistence.
 * Pure functions for deciding what to stop, reschedule, or keep.
 */

import type { IssuedNudge, Nudge, NudgeFeedback, NudgeKind } from '~/lib/domain';

export interface NudgeState {
  feedback: NudgeFeedback;
  issued: IssuedNudge[];
  disabledKinds: Set<NudgeKind>;
  muted: boolean;
  disclosed: boolean;
}

// ── Persistence ────────────────────────────────────────────────────

function read(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}

const FEEDBACK_KEY = 'cadence:nudgeFeedback';
const ISSUED_KEY = 'cadence:nudgeIssued';
const DISABLED_KEY = 'cadence:nudgeDisabledKinds';
const MUTED_KEY = 'cadence:nudgeMuted';
const DISCLOSED_KEY = 'cadence:nudgeDisclosed';

export function loadState(): NudgeState {
  let feedback: NudgeFeedback = { stoppedKinds: [], stoppedNodes: [], notNow: {} };
  try {
    const raw = read(FEEDBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      feedback = {
        stoppedKinds: Array.isArray(parsed.stoppedKinds) ? parsed.stoppedKinds : [],
        stoppedNodes: Array.isArray(parsed.stoppedNodes) ? parsed.stoppedNodes : [],
        notNow: typeof parsed.notNow === 'object' && parsed.notNow !== null ? parsed.notNow : {},
      };
    }
  } catch {
    /* invalid JSON */
  }

  let issued: IssuedNudge[] = [];
  try {
    const raw = read(ISSUED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) issued = parsed;
    }
  } catch {
    /* invalid JSON */
  }

  let disabledKinds = new Set<NudgeKind>();
  try {
    const raw = read(DISABLED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) disabledKinds = new Set(parsed);
    }
  } catch {
    /* invalid JSON */
  }

  const muted = read(MUTED_KEY) === 'true';
  const disclosed = read(DISCLOSED_KEY) === 'true';

  return { feedback, issued, disabledKinds, muted, disclosed };
}

export function saveState(state: NudgeState): void {
  write(FEEDBACK_KEY, JSON.stringify(state.feedback));
  write(ISSUED_KEY, JSON.stringify(state.issued));
  write(DISABLED_KEY, JSON.stringify(Array.from(state.disabledKinds)));
  write(MUTED_KEY, String(state.muted));
  write(DISCLOSED_KEY, String(state.disclosed));
}

// ── Filtering ──────────────────────────────────────────────────────

export function dueNudges(planned: Nudge[], now: Date): Nudge[] {
  const nowMs = now.getTime();
  return planned.filter((n) => {
    const fireMs = new Date(n.fireAt).getTime();
    const dropMs = new Date(n.dropAfter).getTime();
    return fireMs <= nowMs && nowMs <= dropMs;
  });
}

export function prunedIssued(issued: IssuedNudge[], day: string): IssuedNudge[] {
  return issued.filter((i) => i.day === day);
}

// ── Feedback mutations ─────────────────────────────────────────────

export function applyNotNow(
  state: NudgeState,
  nudge: Nudge,
  now: Date
): NudgeState {
  if (!nudge.nodeId) return state;

  const fb = state.feedback;
  const nn = fb.notNow[nudge.nodeId] ?? { count: 0, lastAt: '' };
  const count = nn.count + 1;

  return {
    ...state,
    feedback: {
      ...fb,
      notNow: {
        ...fb.notNow,
        [nudge.nodeId]: { count, lastAt: now.toISOString() },
      },
    },
    // Remove from issued so it can be rescheduled
    issued: state.issued.filter((i) => i.id !== nudge.id),
  };
}

export function applyStopNode(state: NudgeState, nodeId: string): NudgeState {
  const stopped = new Set(state.feedback.stoppedNodes);
  stopped.add(nodeId);
  return {
    ...state,
    feedback: {
      ...state.feedback,
      stoppedNodes: Array.from(stopped),
    },
  };
}

export function applyStopKind(state: NudgeState, kind: NudgeKind): NudgeState {
  const stopped = new Set(state.feedback.stoppedKinds);
  stopped.add(kind);
  return {
    ...state,
    feedback: {
      ...state.feedback,
      stoppedKinds: Array.from(stopped),
    },
  };
}

export function restoreNode(state: NudgeState, nodeId: string): NudgeState {
  const stopped = new Set(state.feedback.stoppedNodes);
  stopped.delete(nodeId);
  const notNow = { ...state.feedback.notNow };
  delete notNow[nodeId];
  return {
    ...state,
    feedback: {
      ...state.feedback,
      stoppedNodes: Array.from(stopped),
      notNow,
    },
  };
}

export function restoreKind(state: NudgeState, kind: NudgeKind): NudgeState {
  const stopped = new Set(state.feedback.stoppedKinds);
  stopped.delete(kind);
  return {
    ...state,
    feedback: {
      ...state.feedback,
      stoppedKinds: Array.from(stopped),
    },
  };
}

export function markIssued(state: NudgeState, nudges: Nudge[], now: Date = new Date()): NudgeState {
  const today = now.toISOString().split('T')[0]!;
  // Keep old issued nudges but prune to today
  const kept = state.issued.filter((i) => i.day === today);
  const issued = [
    ...kept,
    ...nudges.map((n) => ({
      id: n.id,
      kind: n.kind,
      nodeId: n.nodeId,
      day: n.day,
    })),
  ];
  return { ...state, issued };
}

export function setMuted(state: NudgeState, muted: boolean): NudgeState {
  return { ...state, muted };
}

export function setDisclosed(state: NudgeState, disclosed: boolean): NudgeState {
  return { ...state, disclosed };
}
