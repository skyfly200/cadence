import { describe, expect, it } from 'vitest';
import { occ } from '../domain/test-helpers';
import {
  DEFAULT_REWARD_PREFS, DEFAULT_VOICE, DELIGHTS, DELIGHT_PER_DAY, END_OF_DAY_FROM_HOUR, endOfDayLine, linePool, nextDelight, rewardFor, runPraise,
  type RewardInput,
} from './rewards';

const base: RewardInput = { moment: 'done', prefs: DEFAULT_REWARD_PREFS, weeklyKept: 0, pick: 0, delight: false };
const FORBIDDEN = /\b(points?|xp|level|streak|missed|failed|overdue|late|behind|lost)\b/i;

describe('rewardFor', () => {
  it('gives a plain, warm line and a soft tone at every moment, with no points, levels or streaks', () => {
    for (const moment of ['habit', 'start', 'done', 'planning', 'capture'] as const) {
      for (const pick of [0, 0.34, 0.67, 0.99]) {
        const r = rewardFor({ ...base, moment, pick, weeklyKept: 4, met: moment === 'habit' });
        expect(r.text.length).toBeGreaterThan(0);
        expect(r.text).not.toMatch(FORBIDDEN);
        expect(r.text).not.toContain('!');
        expect(r.tone).toBe('soft');
      }
    }
  });

  it('adds one extra at most: the progress update, else the weekly tally', () => {
    const r = rewardFor({ ...base, moment: 'habit', progress: '2 of 3 this week.', weeklyKept: 14 });
    expect(r.text).toContain('2 of 3 this week.');
    expect(r.text).not.toContain('kept this week');
    expect(rewardFor({ ...base, weeklyKept: 1 }).text).toContain('1 thing kept this week.');
  });

  it('stays one short line even when everything applies', () => {
    const r = rewardFor({ ...base, moment: 'habit', met: true, progress: '1 of 1 today.', weeklyKept: 1, run: { periods: 3, period: 'week' }, delight: true });
    expect(r.text.split('. ').length).toBeLessThanOrEqual(3);
    expect(r.text).not.toContain('1 of 1 today.');
    expect(r.text).not.toContain('kept this week');
  });

  it('omits the tally when it is switched off or there is nothing kept yet', () => {
    expect(rewardFor({ ...base, weeklyKept: 9, prefs: { ...DEFAULT_REWARD_PREFS, tally: false } }).text).not.toContain('kept this week');
    expect(rewardFor({ ...base, weeklyKept: 0 }).text).not.toContain('kept this week');
  });

  it('says only the plain fact when coach lines are off, and keeps an existing acknowledgement', () => {
    const off = { ...DEFAULT_REWARD_PREFS, lines: false };
    expect(rewardFor({ ...base, moment: 'start', prefs: off }).text).toBe('Started.');
    expect(rewardFor({ ...base, moment: 'capture', prefs: off, ack: 'Got it, in the heap.' }).text).toBe('Got it, in the heap.');
    expect(rewardFor({ ...base, moment: 'capture', ack: 'Got it, in the heap.' }).text).toMatch(/^Got it, in the heap\. \S/);
  });

  it('is silent when the reward sound is off', () => {
    expect(rewardFor({ ...base, prefs: { ...DEFAULT_REWARD_PREFS, sound: false } }).tone).toBe('none');
  });

  it('gives a slog its own lines and a bigger tone', () => {
    const start = rewardFor({ ...base, moment: 'start', slog: true });
    const done = rewardFor({ ...base, moment: 'done', slog: true });
    expect(start.tone).toBe('big');
    expect(done.tone).toBe('big');
    expect(start.text).toMatch(/two minutes|heavy/i);
    expect(done.text).toMatch(/slog|heavy/i);
    expect(rewardFor({ ...base, moment: 'done', slog: true, prefs: { ...DEFAULT_REWARD_PREFS, sound: false } }).tone).toBe('none');
  });

  it('shows run praise only for a run of two or more, and never a broken-run message', () => {
    expect(rewardFor({ ...base, moment: 'habit', met: true, run: { periods: 6, period: 'week' } }).text).toContain('Kept 6 weeks running.');
    expect(rewardFor({ ...base, moment: 'habit', met: true, run: { periods: 1, period: 'week' } }).text).not.toContain('running');
    expect(rewardFor({ ...base, moment: 'habit', met: true, run: null }).text).not.toContain('running');
    expect(runPraise(3, 'quarter')).toBe('Kept 3 quarters running.');
  });

  it('adds a delight only when due and coach lines are on, and it is never about loss', () => {
    const withDelight = rewardFor({ ...base, delight: true }).text;
    expect(DELIGHTS.some((d) => withDelight.includes(d))).toBe(true);
    expect(DELIGHTS.some((d) => rewardFor({ ...base, delight: false }).text.includes(d))).toBe(false);
    const off = rewardFor({ ...base, delight: true, prefs: { ...DEFAULT_REWARD_PREFS, lines: false } });
    for (const d of DELIGHTS) expect(off.text).not.toContain(d);
    for (const d of DELIGHTS) expect(d).not.toMatch(FORBIDDEN);
  });
});

describe('tone settings', () => {
  const moments = ['habit', 'habitMet', 'start', 'done', 'planning', 'capture', 'slogStart', 'slogDone'];

  it('plain by default, the same lines as before', () => {
    expect(linePool('done')).toEqual(linePool('done', DEFAULT_VOICE));
    expect(DEFAULT_VOICE).toEqual({ tone: 'plain', literal: false, playful: false });
  });

  it('direct says just the fact, with no delight', () => {
    const direct = { ...DEFAULT_VOICE, tone: 'direct' as const };
    expect(rewardFor({ ...base, moment: 'start', voice: direct }).text).toBe('Started.');
    expect(rewardFor({ ...base, moment: 'done', voice: direct, delight: true }).text).toBe('Done.');
  });

  it('gentle has its own lines, falling back to plain where it has none', () => {
    const gentle = { ...DEFAULT_VOICE, tone: 'gentle' as const };
    expect(linePool('done', gentle)).not.toEqual(linePool('done'));
    expect(linePool('planning', gentle)).toEqual(linePool('planning'));
  });

  it('playful adds lines only when switched on, and never with literal-only', () => {
    const playful = { ...DEFAULT_VOICE, playful: true };
    expect(linePool('done', playful).length).toBeGreaterThan(linePool('done').length);
    expect(linePool('done', { ...playful, literal: true })).toEqual(linePool('done', { ...DEFAULT_VOICE, literal: true }));
  });

  it('literal-only drops figures of speech and the delight', () => {
    const literal = { ...DEFAULT_VOICE, literal: true };
    expect(linePool('done', literal)).not.toContain('That is off your plate.');
    expect(linePool('capture', literal)).not.toContain('Out of your head and safe.');
    const r = rewardFor({ ...base, voice: literal, delight: true });
    for (const d of DELIGHTS) expect(r.text).not.toContain(d);
  });

  it('every line in every tone stays warm: no points, streaks, loss or "!"', () => {
    for (const tone of ['gentle', 'plain', 'direct'] as const) {
      for (const playful of [false, true]) {
        for (const key of moments) {
          for (const line of linePool(key, { tone, literal: false, playful })) {
            expect(line).not.toMatch(FORBIDDEN);
            expect(line).not.toContain('!');
          }
        }
      }
    }
  });
});

describe('nextDelight', () => {
  it('shows rarely and caps at one a day', () => {
    expect(nextDelight(null, '2026-10-02', 0.5).show).toBe(false);
    const first = nextDelight(null, '2026-10-02', 0.01);
    expect(first.show).toBe(true);
    expect(first.state).toEqual({ day: '2026-10-02', shown: 1 });
    expect(DELIGHT_PER_DAY).toBe(1);
    expect(nextDelight(first.state, '2026-10-02', 0.01).show).toBe(false);
  });

  it('starts fresh the next day', () => {
    const next = nextDelight({ day: '2026-10-02', shown: 1 }, '2026-10-03', 0.01);
    expect(next.show).toBe(true);
    expect(next.state).toEqual({ day: '2026-10-03', shown: 1 });
  });
});

describe('endOfDayLine', () => {
  const occs = [
    occ('done', '2026-10-02T10:00:00Z', { id: 'a' }),
    occ('logged', '2026-10-02T11:00:00Z', { id: 'b' }),
    occ('done', '2026-10-01T10:00:00Z', { id: 'c' }), // yesterday: not counted
  ];
  const evening = new Date('2026-10-02T18:30:00Z');
  const opts = { timeZone: 'UTC' };
  const input = { on: true, occurrences: occs, now: evening, habitsDone: 1, habitsTotal: 3, opts };

  it('says what was kept today, with the habits piece', () => {
    expect(endOfDayLine(input)).toBe('Today you kept 2 things. 1 of 3 habits logged.');
  });

  it('is null when switched off', () => {
    expect(endOfDayLine({ ...input, on: false })).toBeNull();
  });

  it('waits until the evening', () => {
    expect(END_OF_DAY_FROM_HOUR).toBe(17);
    expect(endOfDayLine({ ...input, now: new Date('2026-10-02T12:00:00Z') })).toBeNull();
  });

  it('says nothing when nothing was kept, and never mentions anything missed', () => {
    expect(endOfDayLine({ ...input, occurrences: [occ('done', '2026-10-01T10:00:00Z', { id: 'c' })] })).toBeNull();
    expect(endOfDayLine({ ...input, habitsDone: 0 })).toBe('Today you kept 2 things.');
    expect(endOfDayLine({ ...input, occurrences: [occs[0]!] })).toBe('Today you kept 1 thing. 1 of 3 habits logged.');
    expect(endOfDayLine(input)).not.toMatch(FORBIDDEN);
  });

  it('ignores a kept thing that was undone', () => {
    const undone = [...occs, occ('undone', '2026-10-02T12:00:00Z', { id: 'u', undoes: 'a' })];
    expect(endOfDayLine({ ...input, occurrences: undone })).toBe('Today you kept 1 thing. 1 of 3 habits logged.');
  });
});
