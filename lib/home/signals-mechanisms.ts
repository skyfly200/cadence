/**
 * The mechanisms the Signals screen reports on and the author can run an
 * experiment with (ticket 13). Each has the key used in the settings history,
 * its default, and (for the simple per-device switches) a way to read and flip it.
 * Nudge types are report-only here: they are switched in Settings, and their
 * "Stop these" taps feed the keep-or-cut rule.
 */
import { NUDGE_KINDS } from '../domain/nudges';
import { getPlanningReminder, getRecapOn, getSoundOn, setPlanningReminder, setRecapOn, setSoundOn } from './prefs';

export interface Mechanism {
  key: string;
  label: string;
  defaultOn: boolean;
  /** The nudge type whose "Stop these" taps count against it. */
  nudgeKind?: string;
  /** Measured by real use rather than a switch (so it has no setting history and cannot be flipped in an experiment). */
  usage?: 'slog_finished';
  /** Present for switches an experiment can flip. */
  isOn?: () => boolean;
  set?: (on: boolean) => void;
}

export const NUDGE_KIND_LABELS: Record<string, string> = {
  leave_by: 'Time reminders',
  at_risk: 'At-risk alerts',
  transition: 'Transition cues',
  habit_summary: 'Habit summary',
};

export const MECHANISMS: readonly Mechanism[] = [
  { key: 'sound:speech', label: 'Spoken nudges', defaultOn: true, isOn: () => getSoundOn('speech'), set: (on) => setSoundOn('speech', on) },
  { key: 'sound:tone', label: 'Soft tone', defaultOn: true, isOn: () => getSoundOn('tone'), set: (on) => setSoundOn('tone', on) },
  { key: 'recap:week', label: 'Weekly recap', defaultOn: false, isOn: () => getRecapOn('week'), set: (on) => setRecapOn('week', on) },
  { key: 'recap:month', label: 'Monthly recap', defaultOn: false, isOn: () => getRecapOn('month'), set: (on) => setRecapOn('month', on) },
  { key: 'recap:quarter', label: 'Quarterly recap', defaultOn: false, isOn: () => getRecapOn('quarter'), set: (on) => setRecapOn('quarter', on) },
  { key: 'planning_reminder', label: 'Weekly planning reminder', defaultOn: false, isOn: () => getPlanningReminder(), set: setPlanningReminder },
  { key: 'slog_tag', label: 'Slog tag', defaultOn: true, usage: 'slog_finished' },
  ...NUDGE_KINDS.map((kind): Mechanism => ({ key: `nudge:${kind}`, label: NUDGE_KIND_LABELS[kind] ?? kind, defaultOn: true, nudgeKind: kind })),
];

/** The mechanisms an experiment can flip. */
export const EXPERIMENTAL: readonly Mechanism[] = MECHANISMS.filter((m) => m.isOn && m.set);

export function mechanismByKey(key: string): Mechanism | undefined { return MECHANISMS.find((m) => m.key === key); }
