/**
 * Life graph domain types. Framework-free (no Vue/Nuxt imports).
 * Vocabulary follows CONTEXT.md: five Node kinds, typed Links with an origin,
 * and an append-only Occurrence log. Timestamps are ISO strings, like lib/types.ts.
 */

// ── Periods ─────────────────────────────────────────────────────────────

/** Calendar periods a Habit is counted within. */
export type Period = 'day' | 'week' | 'month' | 'quarter' | 'four_months' | 'six_months' | 'year';

export const PERIODS: readonly Period[] = ['day', 'week', 'month', 'quarter', 'four_months', 'six_months', 'year'];

/** A period plus a target count within it, e.g. { period: 'week', target: 3 }. target >= 1. */
export interface Recurrence {
  period: Period;
  target: number;
}

// ── Nodes ───────────────────────────────────────────────────────────────

export type NodeKind = 'goal' | 'habit' | 'commitment' | 'idea' | 'thing';

interface NodeBase {
  id: string;
  kind: NodeKind;
  title: string;
  notes?: string | null;
  /** Private Nodes are never sent to the AI or returned to an assistant. */
  private: boolean;
  createdAt: string;
  updatedAt: string;
}

/** An outcome. Nests through part-of Links; a Project is a Goal with a finish line. */
export interface Goal extends NodeBase {
  kind: 'goal';
  /** A Project: a Goal with a finish line. */
  finishLine: boolean;
  /** A milestone: a Goal marked as a checkpoint (done when its parts are done). */
  checkpoint: boolean;
}

/** Optional pinning of a Habit. Flexible by default: no pin means any day/time in the period. */
export interface HabitPin {
  /** 0 = Sunday … 6 = Saturday (same convention as lib/types.ts Habit.days). */
  weekdays?: number[];
  /** 'HH:mm' times of day, e.g. ['08:00', '20:00'] for a twice-daily habit. */
  timesOfDay?: string[];
}

/** A recurring behaviour the user is building or keeping. */
export interface Habit extends NodeBase {
  kind: 'habit';
  recurrence: Recurrence;
  pin?: HabitPin | null;
  /** A link to open for this habit (e.g. its app or site); https only. */
  link?: string | null;
  /** Background: appears in no Lens unless at risk of slipping. */
  quiet: boolean;
}

/** A todo or an event, with or without a time. */
export interface Commitment extends NodeBase {
  kind: 'commitment';
  fixedTime?: string | null;      // ISO datetime it happens at
  deadline?: string | null;       // ISO datetime it must be done by
  windowStart?: string | null;    // 'HH:mm' earliest it can be done
  windowEnd?: string | null;      // 'HH:mm' latest it can be done
  durationMinutes?: number | null;
  /** Local day 'YYYY-MM-DD' the user placed it on in the Stack. A fixed time or deadline still rules. */
  plannedFor?: string | null;
  /** Where it sits among the untimed items of its day in the Stack (lower first); the user's drag order. */
  dayOrder?: number | null;
  /** A fixed-time repeat obligation (a recurring Commitment). */
  repeat?: Recurrence | null;
  /** The user tagged this as a slog: a bigger reward and a "just start" ritual. */
  slog: boolean;
  /** Background visibility, as for Habits. */
  quiet: boolean;
  /** A link to open for this item (a project, doc or board); https only. */
  link?: string | null;
  /** Mirror Node for an external item (e.g. a Google Calendar event). */
  external?: { system: string; id: string } | null;
}

/** A Capture not yet classified into another kind. */
export interface Idea extends NodeBase {
  kind: 'idea';
}

export type ThingType = 'person' | 'place' | 'object';

/** A person, place or object that Commitments need, happen at, or involve. */
export interface Thing extends NodeBase {
  kind: 'thing';
  thingType: ThingType;
  lat?: number | null;
  lon?: number | null;
}

export type Node = Goal | Habit | Commitment | Idea | Thing;

// ── Links ───────────────────────────────────────────────────────────────

export type LinkType = 'requires' | 'needs' | 'part_of' | 'at' | 'with';

/** stated: the user said it (never decays). proposed_accepted: Cadence proposed, user used it. inferred: learned. */
export type LinkOrigin = 'stated' | 'proposed_accepted' | 'inferred';

export interface Link {
  id: string;
  type: LinkType;
  fromId: string;
  toId: string;
  origin: LinkOrigin;
  /** 0..1. Stated links are 1. */
  confidence: number;
  /** Occurrence ids or short notes behind the link ("took the cooler out 3 times"). */
  evidence: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Occurrences (append-only log) ───────────────────────────────────────

/**
 * done: a Commitment finished. logged: a Habit logged. started: Start pressed.
 * skipped / parked / moved: neutral, never failures. captured: a Capture arrived.
 * undone: cancels an earlier Occurrence (see `undoes`); the log itself is never edited.
 */
export type OccurrenceType = 'done' | 'skipped' | 'parked' | 'moved' | 'started' | 'captured' | 'logged' | 'undone';

export type OccurrenceSource = 'app' | 'claude' | 'gemini' | 'grok';

/** Immutable. To reverse one, append an 'undone' Occurrence that points at it. */
export interface Occurrence {
  readonly id: string;
  readonly nodeId: string;
  readonly type: OccurrenceType;
  /** ISO datetime it happened (may be back-dated). */
  readonly at: string;
  readonly source: OccurrenceSource;
  /** For type 'undone': the id of the Occurrence being cancelled. */
  readonly undoes?: string;
  readonly note?: string | null;
}
