import { describe, expect, it } from 'vitest';
import {
  start,
  checkInDue,
  markCheckedIn,
  isEnded,
  canPlaySound,
  canCue,
  statusLine,
  PRESENCE_CUE_TEXT,
  CHECK_IN_TEXT,
  END_TEXT,
  type StayWithMeState,
} from './stay-with-me';

describe('stay-with-me', () => {
  const NOW = 1000000;
  const DURATION = 20 * 60 * 1000; // 20 minutes

  describe('start', () => {
    it('creates a session with startedAt, durationMs, checkedIn false, and optional ambientOn', () => {
      const s = start(NOW, DURATION);
      expect(s).toEqual({
        startedAt: NOW,
        durationMs: DURATION,
        checkedIn: false,
        ambientOn: false,
      });
    });

    it('accepts ambientOn as true', () => {
      const s = start(NOW, DURATION, true);
      expect(s.ambientOn).toBe(true);
    });
  });

  describe('checkInDue', () => {
    it('is false before the halfway point', () => {
      const s = start(NOW, DURATION);
      const beforeHalfway = NOW + DURATION / 2 - 1;
      expect(checkInDue(s, beforeHalfway)).toBe(false);
    });

    it('is true at exactly the halfway point', () => {
      const s = start(NOW, DURATION);
      const halfway = NOW + DURATION / 2;
      expect(checkInDue(s, halfway)).toBe(true);
    });

    it('is true between halfway and end', () => {
      const s = start(NOW, DURATION);
      const between = NOW + DURATION / 2 + 1000;
      expect(checkInDue(s, between)).toBe(true);
    });

    it('is false at or after the end', () => {
      const s = start(NOW, DURATION);
      const end = NOW + DURATION;
      expect(checkInDue(s, end)).toBe(false);
    });

    it('is false after the session ends, even if check-in was due but not marked', () => {
      const s = start(NOW, DURATION);
      const afterEnd = NOW + DURATION + 1000;
      expect(checkInDue(s, afterEnd)).toBe(false);
    });

    it('is false if already checked in, even at halfway', () => {
      const s = markCheckedIn(start(NOW, DURATION));
      const halfway = NOW + DURATION / 2;
      expect(checkInDue(s, halfway)).toBe(false);
    });

    it('is never due again after marking', () => {
      let s = start(NOW, DURATION);
      const halfway = NOW + DURATION / 2;
      expect(checkInDue(s, halfway)).toBe(true);
      s = markCheckedIn(s);
      expect(checkInDue(s, halfway)).toBe(false);
      expect(checkInDue(s, halfway + 1000)).toBe(false);
    });
  });

  describe('markCheckedIn', () => {
    it('sets checkedIn to true', () => {
      const s = start(NOW, DURATION);
      const checked = markCheckedIn(s);
      expect(checked.checkedIn).toBe(true);
    });

    it('preserves other fields', () => {
      const s = start(NOW, DURATION, true);
      const checked = markCheckedIn(s);
      expect(checked.startedAt).toBe(s.startedAt);
      expect(checked.durationMs).toBe(s.durationMs);
      expect(checked.ambientOn).toBe(s.ambientOn);
    });
  });

  describe('isEnded', () => {
    it('is false before the end time', () => {
      const s = start(NOW, DURATION);
      expect(isEnded(s, NOW + DURATION - 1)).toBe(false);
    });

    it('is true at exactly the end time', () => {
      const s = start(NOW, DURATION);
      expect(isEnded(s, NOW + DURATION)).toBe(true);
    });

    it('is true after the end time', () => {
      const s = start(NOW, DURATION);
      expect(isEnded(s, NOW + DURATION + 1000)).toBe(true);
    });
  });

  describe('canPlaySound', () => {
    it('is true when not muted, interacted, and ambientOn', () => {
      expect(canPlaySound({ muted: false, interacted: true, ambientOn: true })).toBe(true);
    });

    it('is false when muted', () => {
      expect(canPlaySound({ muted: true, interacted: true, ambientOn: true })).toBe(false);
    });

    it('is false when not interacted', () => {
      expect(canPlaySound({ muted: false, interacted: false, ambientOn: true })).toBe(false);
    });

    it('is false when ambientOn is false', () => {
      expect(canPlaySound({ muted: false, interacted: true, ambientOn: false })).toBe(false);
    });

    it('is false when any condition is not met', () => {
      expect(canPlaySound({ muted: true, interacted: true, ambientOn: true })).toBe(false);
      expect(canPlaySound({ muted: true, interacted: false, ambientOn: true })).toBe(false);
      expect(canPlaySound({ muted: false, interacted: false, ambientOn: false })).toBe(false);
    });
  });

  describe('canCue', () => {
    it('is true when not muted and interacted', () => {
      expect(canCue({ muted: false, interacted: true })).toBe(true);
    });

    it('is false when muted', () => {
      expect(canCue({ muted: true, interacted: true })).toBe(false);
    });

    it('is false when not interacted', () => {
      expect(canCue({ muted: false, interacted: false })).toBe(false);
    });
  });

  describe('statusLine', () => {
    it('says "Halfway" when check-in is due and not yet marked', () => {
      const s = start(NOW, DURATION);
      const halfway = NOW + DURATION / 2;
      expect(statusLine(s, halfway)).toContain('Halfway');
    });

    it('shows minutes remaining when not at halfway', () => {
      const s = start(NOW, DURATION);
      const at5min = NOW + 5 * 60 * 1000;
      const line = statusLine(s, at5min);
      expect(line).toContain('15 minutes');
    });

    it('rounds minutes remaining', () => {
      const s = start(NOW, DURATION);
      const at5min30sec = NOW + 5.5 * 60 * 1000;
      const line = statusLine(s, at5min30sec);
      // 5.5 min elapsed, 14.5 remaining, Math.round(14.5) = 15
      expect(line).toContain('15 minutes');
    });

    it('shows minutes remaining after check-in has been marked', () => {
      let s = start(NOW, DURATION);
      const nearEnd = NOW + DURATION - 30 * 1000;
      s = markCheckedIn(s);
      const line = statusLine(s, nearEnd);
      // 19.5 min elapsed, 0.5 remaining, rounds to 0 or 1
      expect(line).toMatch(/\d+ minutes left/);
    });

    it('shows completion message when ended', () => {
      const s = start(NOW, DURATION);
      const end = NOW + DURATION;
      const line = statusLine(s, end);
      expect(line).not.toContain('minutes');
      expect(line).toContain('Time is up');
    });
  });

  describe('copy strings', () => {
    it('defines PRESENCE_CUE_TEXT without negative language', () => {
      expect(PRESENCE_CUE_TEXT).toBeDefined();
      expect(PRESENCE_CUE_TEXT.toLowerCase()).not.toMatch(/behind|overdue|failed|lazy|should/);
    });

    it('defines CHECK_IN_TEXT without negative language', () => {
      expect(CHECK_IN_TEXT).toBeDefined();
      expect(CHECK_IN_TEXT.toLowerCase()).not.toMatch(/behind|overdue|failed|lazy|should/);
    });

    it('defines END_TEXT without negative language', () => {
      expect(END_TEXT).toBeDefined();
      expect(END_TEXT.toLowerCase()).not.toMatch(/behind|overdue|failed|lazy|should/);
    });
  });

  describe('integration: no check-in if session ends before it is due', () => {
    it('ends quietly if time jumps past halfway', () => {
      let s = start(NOW, DURATION);
      const halfway = NOW + DURATION / 2;
      expect(checkInDue(s, halfway)).toBe(true);

      // Time jumps to past the end (e.g., tab was throttled)
      const afterEnd = NOW + DURATION + 1000;
      expect(isEnded(s, afterEnd)).toBe(true);
      expect(checkInDue(s, afterEnd)).toBe(false);

      // Session ended without check-in being marked
      expect(s.checkedIn).toBe(false);
    });
  });
});
