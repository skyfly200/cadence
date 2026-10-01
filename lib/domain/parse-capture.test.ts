import { describe, expect, it } from 'vitest';
import { instantFromWall, parseCapture, wallInZone } from './parse-capture';

const NY = 'America/New_York';
// Thu 1 Oct 2026, 18:30 in New York (EDT, UTC-4). Oct 2 is a Friday, Oct 5 a Monday.
const NOW = '2026-10-01T22:30:00Z';
const p = (text: string, now = NOW, timeZone = NY) => parseCapture(text, { now: new Date(now), timeZone });

describe('time zone helpers', () => {
  it('reads wall clocks in a zone', () => {
    expect(wallInZone(Date.parse('2026-10-01T22:30:00Z'), NY)).toMatchObject({ year: 2026, month: 10, day: 1, hour: 18, minute: 30 });
    expect(wallInZone(Date.parse('2026-10-01T22:30:00Z'), 'Asia/Tokyo')).toMatchObject({ month: 10, day: 2, hour: 7, minute: 30 });
  });
  it('builds instants from wall clocks, across DST', () => {
    const iso = (w: Parameters<typeof instantFromWall>[0], tz = NY) => new Date(instantFromWall(w, tz)).toISOString();
    expect(iso({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 })).toBe('2026-01-15T14:00:00.000Z'); // EST
    expect(iso({ year: 2026, month: 7, day: 15, hour: 9, minute: 0 })).toBe('2026-07-15T13:00:00.000Z'); // EDT
    // spring forward: 02:30 does not exist on 8 Mar 2026, lands just after the gap
    expect(iso({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 })).toBe('2026-03-08T07:30:00.000Z');
    // autumn overlap: 01:30 happens twice on 1 Nov 2026, the first one wins
    expect(iso({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 })).toBe('2026-11-01T05:30:00.000Z');
    // London
    expect(iso({ year: 2026, month: 3, day: 29, hour: 9, minute: 0 }, 'Europe/London')).toBe('2026-03-29T08:00:00.000Z'); // BST
    expect(iso({ year: 2026, month: 10, day: 25, hour: 8, minute: 0 }, 'Europe/London')).toBe('2026-10-25T08:00:00.000Z'); // GMT
  });
});

describe('phrases that become Commitments', () => {
  const cases: Array<[string, string, Record<string, unknown>]> = [
    ['call the dentist tomorrow 3pm', NOW, { title: 'call the dentist', fixedAt: '2026-10-02T19:00:00.000Z', matched: ['tomorrow 3pm'] }],
    ['send the invoice by Friday', NOW, { title: 'send the invoice', deadline: '2026-10-03T03:59:00.000Z' }],
    ['invoice due Friday', NOW, { title: 'invoice', deadline: '2026-10-03T03:59:00.000Z' }],
    ['submit the form by 5pm tomorrow', NOW, { title: 'submit the form', deadline: '2026-10-02T21:00:00.000Z' }],
    // 15:00 EDT, so 6 this evening is still ahead
    ['pick up the projector tonight at 6', '2026-10-01T19:00:00Z', { title: 'pick up the projector', fixedAt: '2026-10-01T22:00:00.000Z' }],
    ['check the oven in 2 hours', NOW, { title: 'check the oven', fixedAt: '2026-10-02T00:30:00.000Z' }],
    ['in 30 minutes check oven', NOW, { title: 'check oven', fixedAt: '2026-10-01T23:00:00.000Z' }],
    ['Oct 5th dentist', NOW, { title: 'dentist', deadline: '2026-10-06T03:59:00.000Z' }],
    ['next Monday standup', NOW, { title: 'standup', deadline: '2026-10-06T03:59:00.000Z' }],
    ['pay rent on the 12th', NOW, { title: 'pay rent', deadline: '2026-10-13T03:59:00.000Z' }],
    ['water plants today', NOW, { title: 'water plants', deadline: '2026-10-02T03:59:00.000Z' }],
    ['dentist Sat', NOW, { title: 'dentist', deadline: '2026-10-04T03:59:00.000Z' }],
    ['feb 29 2028 birthday', NOW, { title: 'birthday', deadline: '2028-03-01T04:59:00.000Z' }],
    ['🍄 forage tomorrow 9am', NOW, { title: '🍄 forage', fixedAt: '2026-10-02T13:00:00.000Z' }],
  ];
  it.each(cases)('%s', (text, now, expected) => {
    const r = p(text, now);
    expect(r.kind).toBe('commitment');
    expect(r).toMatchObject(expected);
    expect(r.text).toBe(text);
    expect(r.ambiguous).toBeUndefined();
  });

  it('reads a range as a window with the fixed start and a duration', () => {
    const r = p('meeting from 5 to 6 pm tomorrow');
    expect(r).toMatchObject({
      kind: 'commitment', title: 'meeting', fixedAt: '2026-10-02T21:00:00.000Z',
      windowStart: '17:00', windowEnd: '18:00', durationMinutes: 60,
    });
  });

  it('reads day parts without a clock time as a window and a deadline at its end', () => {
    expect(p('dinner this evening')).toMatchObject({ title: 'dinner', windowStart: '17:00', windowEnd: '21:00', deadline: '2026-10-02T01:00:00.000Z' });
    expect(p('gym tomorrow morning')).toMatchObject({ title: 'gym', windowStart: '06:00', windowEnd: '12:00', deadline: '2026-10-02T16:00:00.000Z' });
    expect(p('gym tomorrow morning').fixedAt).toBeUndefined();
  });
});

describe('a bare hour with no am/pm', () => {
  it('"at 6" in the evening means the next 6 (tomorrow evening), flagged ambiguous', () => {
    const r = p('call mom at 6'); // 18:30, so 6pm today has passed
    expect(r).toMatchObject({ kind: 'commitment', title: 'call mom', fixedAt: '2026-10-02T22:00:00.000Z', ambiguous: true });
  });
  it('"at 6" said at 9pm still means tomorrow 6pm', () => {
    expect(p('call mom at 6', '2026-10-02T01:00:00Z')).toMatchObject({ fixedAt: '2026-10-02T22:00:00.000Z', ambiguous: true });
  });
  it('"at 6" earlier in the day means 6pm today', () => {
    expect(p('call mom at 6', '2026-10-01T14:00:00Z')).toMatchObject({ fixedAt: '2026-10-01T22:00:00.000Z', ambiguous: true });
  });
  it('7 to 11 read as AM when still ahead', () => {
    expect(p('stretch at 7', '2026-10-01T10:00:00Z')).toMatchObject({ fixedAt: '2026-10-01T11:00:00.000Z', ambiguous: true });
  });
  it('"at 9" said at 10am rolls to 9pm today', () => {
    expect(p('call at 9', '2026-10-01T14:00:00Z')).toMatchObject({ fixedAt: '2026-10-02T01:00:00.000Z', ambiguous: true });
  });
  it('with a day named, the preferred half of the day is used with no rolling', () => {
    expect(p('dentist tomorrow at 3')).toMatchObject({ fixedAt: '2026-10-02T19:00:00.000Z', ambiguous: true });
  });
  it('an explicit am/pm is not ambiguous', () => {
    expect(p('call mom at 6pm', '2026-10-01T14:00:00Z').ambiguous).toBeUndefined();
  });
  it('a time with am/pm that has passed today means the next one', () => {
    const r = p('lunch at noon'); // noon has passed at 18:30
    expect(r.fixedAt).toBe('2026-10-02T16:00:00.000Z');
  });
});

describe('daylight saving and zones', () => {
  it('"tomorrow 9am" across spring-forward is 09:00 local, not 24h later', () => {
    // Sat 7 Mar 2026 12:00 EST; 8 Mar springs forward at 02:00
    expect(p('breakfast tomorrow 9am', '2026-03-07T17:00:00Z').fixedAt).toBe('2026-03-08T13:00:00.000Z');
  });
  it('a time inside the spring-forward gap lands just after it', () => {
    expect(p('alarm tomorrow at 2:30am', '2026-03-07T17:00:00Z').fixedAt).toBe('2026-03-08T07:30:00.000Z');
  });
  it('"in 2 hours" across spring-forward is exactly two hours', () => {
    // 01:30 EST on 8 Mar is 06:30Z; two hours later is 08:30Z (04:30 EDT)
    expect(p('stretch in 2 hours', '2026-03-08T06:30:00Z').fixedAt).toBe('2026-03-08T08:30:00.000Z');
  });
  it('a time in the autumn overlap picks the first occurrence', () => {
    expect(p('pill tomorrow at 1:30am', '2026-10-31T20:00:00Z').fixedAt).toBe('2026-11-01T05:30:00.000Z');
  });
  it('London spring-forward and autumn', () => {
    expect(p('call tomorrow at 9am', '2026-03-28T12:00:00Z', 'Europe/London').fixedAt).toBe('2026-03-29T08:00:00.000Z');
    expect(p('call tomorrow at 8am', '2026-10-24T12:00:00Z', 'Europe/London').fixedAt).toBe('2026-10-25T08:00:00.000Z');
  });
  it('follows the given zone, not the machine or UTC', () => {
    // 22:30Z is already Oct 2 07:30 in Tokyo, so "tomorrow" is Oct 3
    expect(p('call tomorrow 3pm', NOW, 'Asia/Tokyo').fixedAt).toBe('2026-10-03T06:00:00.000Z');
    expect(p('call tomorrow 3pm', NOW, 'UTC').fixedAt).toBe('2026-10-02T15:00:00.000Z');
  });
  it('late at night, "tomorrow" is the local tomorrow even if UTC has rolled over', () => {
    // 23:30 EDT on Oct 1 is already Oct 2 in UTC
    const now = '2026-10-02T03:30:00Z';
    expect(p('breakfast tomorrow 9am', now).fixedAt).toBe('2026-10-02T13:00:00.000Z');
    expect(p('water plants today', now).deadline).toBe('2026-10-02T03:59:00.000Z');
  });
});

describe('calendar edges', () => {
  it('a weekday on a Sunday is the next day', () => {
    // Sun 4 Oct 2026
    expect(p('standup Monday', '2026-10-04T16:00:00Z').deadline).toBe('2026-10-06T03:59:00.000Z');
  });
  it('a weekday that is today means next week', () => {
    // Mon 5 Oct 2026 -> Monday 12 Oct
    expect(p('standup Monday', '2026-10-05T16:00:00Z').deadline).toBe('2026-10-13T03:59:00.000Z');
  });
  it('month end: tomorrow from the 31st', () => {
    expect(p('breakfast tomorrow 8am', '2026-01-31T17:00:00Z').fixedAt).toBe('2026-02-01T13:00:00.000Z');
  });
  it('"the 31st" skips months without one', () => {
    // 10 Feb 2026: February has no 31st, so March 31 (EDT)
    expect(p('file taxes on the 31st', '2026-02-10T17:00:00Z').deadline).toBe('2026-04-01T03:59:00.000Z');
  });
  it('"the 5th" is this month while it is still ahead, else next month', () => {
    expect(p('pay on the 5th', '2026-01-05T17:00:00Z').deadline).toBe('2026-01-06T04:59:00.000Z');
    expect(p('pay on the 5th', '2026-01-20T17:00:00Z').deadline).toBe('2026-02-06T04:59:00.000Z');
  });
  it('a date said on its own day, even at exactly noon, stays today (no machine-zone tie)', () => {
    // Mon 5 Oct 2026, 12:00 New York
    expect(p('dentist Oct 5th', '2026-10-05T16:00:00Z').deadline).toBe('2026-10-06T03:59:00.000Z');
    expect(p('dentist Oct 5th', '2026-10-05T16:00:01Z').deadline).toBe('2026-10-06T03:59:00.000Z');
  });
  it('a date that has passed this year means next year', () => {
    expect(p('dentist Oct 5th', '2026-10-06T16:00:00Z').deadline).toBe('2027-10-06T03:59:00.000Z');
  });
  it('Feb 29 with no year is read in a leap year, and stays an Idea otherwise (the engine does not read it)', () => {
    expect(p('birthday feb 29', '2028-01-10T17:00:00Z').deadline).toBe('2028-03-01T04:59:00.000Z');
    expect(p('birthday feb 29', '2026-10-01T16:00:00Z').kind).toBe('idea');
  });
  it('a weekday said on that weekday at exactly noon means next week', () => {
    expect(p('standup Monday', '2026-10-05T16:00:00Z').deadline).toBe('2026-10-13T03:59:00.000Z');
  });
  it('"this Monday" said on a Monday means today', () => {
    expect(p('standup this Monday', '2026-10-05T14:00:00Z').deadline).toBe('2026-10-06T03:59:00.000Z');
  });
  it('leap day', () => {
    expect(p('party tomorrow 3pm', '2028-02-28T17:00:00Z').fixedAt).toBe('2028-02-29T20:00:00.000Z');
    expect(p('party tomorrow 3pm', '2026-02-28T17:00:00Z').fixedAt).toBe('2026-03-01T20:00:00.000Z');
  });
});

describe('what must stay an Idea', () => {
  const ideas = [
    'buy 5 mushrooms',
    'mushrooms 1 5',
    'I may go to the lake',
    'do it now',
    'sort out the garage',
    'we sat in the car',
    'dentist in March',
    'call 555 1234',
    '🍄🍄🍄',
  ];
  it.each(ideas)('%s', (text) => {
    const r = p(text);
    expect(r.kind).toBe('idea');
    expect(r.title).toBe(text);
    expect(r.text).toBe(text);
    expect(r.fixedAt).toBeUndefined();
    expect(r.deadline).toBeUndefined();
  });

  it('recurrence phrases stay Ideas and suggest recurrence', () => {
    for (const text of ['every Monday call mom', 'stretch daily', 'water the plants twice a day', 'pay rent each month', 'gym three times a week']) {
      const r = p(text);
      expect(r.kind).toBe('idea');
      expect(r.suggestsRecurrence).toBe(true);
      expect(r.title).toBe(text);
    }
  });

  it('a date phrase with nothing to do stays an Idea but remembers what it matched', () => {
    expect(p('tomorrow 3pm')).toMatchObject({ kind: 'idea', title: 'tomorrow 3pm', matched: ['tomorrow 3pm'] });
  });

  it('two different dates are too easy to get wrong: Idea, flagged ambiguous', () => {
    const r = p('call Sam tomorrow and Dana on Friday');
    expect(r).toMatchObject({ kind: 'idea', ambiguous: true });
    expect(r.matched.length).toBe(2);
  });

  it('empty and whitespace input are untouched Ideas', () => {
    expect(p('')).toMatchObject({ kind: 'idea', title: '', text: '' });
    expect(p('   ')).toMatchObject({ kind: 'idea', title: '   ', text: '   ' });
  });
});

describe('preserving the original text', () => {
  it('keeps the exact text, including spacing and case', () => {
    const text = '  Call the Dentist   TOMORROW 3pm  ';
    const r = p(text);
    expect(r.text).toBe(text);
    expect(r.kind).toBe('commitment');
    expect(r.title).toBe('Call the Dentist');
  });
  it('is deterministic and does not read the clock', () => {
    expect(p('call the dentist tomorrow 3pm')).toEqual(p('call the dentist tomorrow 3pm'));
  });
});
