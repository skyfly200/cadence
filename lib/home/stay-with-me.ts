/**
 * "Focus together" body-double mode: timing and state logic, pure and testable.
 * An opt-in quiet presence with an optional ambient sound and one check-in at the halfway point.
 */

export interface StayWithMeState {
  startedAt: number; // ms since epoch
  durationMs: number;
  checkedIn: boolean;
  ambientOn: boolean;
}

/**
 * Start a "Focus together" session.
 */
export function start(now: number, durationMs: number, ambientOn = false): StayWithMeState {
  return {
    startedAt: now,
    durationMs,
    checkedIn: false,
    ambientOn,
  };
}

/**
 * Check if a check-in is due (hasn't checked in yet, and we're at or past the halfway point but before the end).
 */
export function checkInDue(state: StayWithMeState, now: number): boolean {
  if (state.checkedIn) return false;
  const halfwayMs = state.startedAt + state.durationMs / 2;
  const endMs = state.startedAt + state.durationMs;
  return now >= halfwayMs && now < endMs;
}

/**
 * Mark the check-in as done.
 */
export function markCheckedIn(state: StayWithMeState): StayWithMeState {
  return { ...state, checkedIn: true };
}

/**
 * Check if the session has ended.
 */
export function isEnded(state: StayWithMeState, now: number): boolean {
  return now >= state.startedAt + state.durationMs;
}

/**
 * Decide whether to play ambient sound.
 * Respects mute and the ambient toggle; only plays after user interaction.
 */
export function canPlaySound(opts: { muted: boolean; interacted: boolean; ambientOn: boolean }): boolean {
  return !opts.muted && opts.interacted && opts.ambientOn;
}

/**
 * Decide whether to play a presence cue (soft tone + speech).
 * Respects mute; only plays after user interaction.
 */
export function canCue(opts: { muted: boolean; interacted: boolean }): boolean {
  return !opts.muted && opts.interacted;
}

/**
 * Status line copy: a calm, present-tense message.
 */
export function statusLine(state: StayWithMeState, now: number): string {
  const elapsed = now - state.startedAt;
  const remaining = state.durationMs - elapsed;
  const minRemaining = Math.max(0, Math.round(remaining / 60000));

  if (!state.checkedIn && checkInDue(state, now)) {
    return 'Halfway.';
  }
  if (minRemaining > 0) {
    return `${minRemaining} minutes left.`;
  }
  return 'Time is up.';
}

/**
 * Initial presence cue text (spoken once when the session starts).
 */
export const PRESENCE_CUE_TEXT = 'Starting. I am here if you need me.';

/**
 * Check-in cue text.
 */
export const CHECK_IN_TEXT = 'Halfway.';

/**
 * End message (spoken only if not muted and after interaction).
 */
export const END_TEXT = 'Time is up.';
