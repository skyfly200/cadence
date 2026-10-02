import { describe, expect, it } from 'vitest';
import { NO_FEEDBACK, planNudges, type NudgeFeedback, type PlanInput } from './nudges';
import { at, commitment, deepFreeze, ev, habit, UTC } from './test-helpers';

const SETTINGS = { wakeTime: '07:00', sleepTime: '23:00' };
const NOON = at('2026-03-08T12:00:00Z'); // a Sunday

function plan(over: Partial<PlanInput> = {}) {
  return planNudges(deepFreeze({ now: NOON, nodes: [], occurrences: [], settings: SETTINGS, opts: UTC, ...over }));
}

const meeting = (id: string, hhmm: string, extra = {}) =>
  commitment(id, { fixedTime: `2026-03-08T${hhmm}:00Z`, ...extra });

describe('leave_by', () => {
  it('fires ten minutes before the leave time and names it', () => {
    const [n] = plan({ nodes: [meeting('dentist', '15:00')], travel: () => 20 });
    expect(n).toMatchObject({ kind: 'leave_by', nodeId: 'dentist', title: 'Leave by 14:40', fireAt: '2026-03-08T14:30:00.000Z', dropAfter: '2026-03-08T14:40:00.000Z' });
  });

  it('without travel it is a plain heads-up before the time', () => {
    const [n] = plan({ nodes: [meeting('call', '15:00')] });
    expect(n).toMatchObject({ title: 'call is at 15:00', body: '', fireAt: '2026-03-08T14:50:00.000Z' });
  });

  it('is dropped once the leave time has passed, never sent late', () => {
    expect(plan({ nodes: [meeting('late', '12:05')], travel: () => 20 })).toEqual([]);
  });

  it('a deadline gives a start-by', () => {
    const [n] = plan({ nodes: [commitment('report', { deadline: '2026-03-08T17:00:00Z', durationMinutes: 60 })] });
    expect(n).toMatchObject({ kind: 'leave_by', title: 'report: start by 16:00' });
  });

  it('skips done and parked items', () => {
    const nodes = [meeting('a', '15:00'), meeting('b', '16:00')];
    const occurrences = [ev('a', 'done', '2026-03-08T11:00:00Z'), ev('b', 'parked', '2026-03-08T11:00:00Z')];
    expect(plan({ nodes, occurrences })).toEqual([]);
  });
});

describe('transition', () => {
  const block = [meeting('deep', '13:00', { durationMinutes: 90 })];

  it('a block over 30 minutes gets a five-minute heads-up, then one cue', () => {
    const ns = plan({ nodes: block }).filter((n) => n.kind === 'transition');
    expect(ns.map((n) => [n.id.split('|').pop(), n.fireAt])).toEqual([
      ['heads_up', '2026-03-08T14:25:00.000Z'],
      ['next', '2026-03-08T14:30:00.000Z'],
    ]);
  });

  it('a short block gets only the cue', () => {
    const ns = plan({ nodes: [meeting('quick', '13:00', { durationMinutes: 30 })] }).filter((n) => n.kind === 'transition');
    expect(ns).toHaveLength(1);
  });

  it('the heads-up and the cue count as one toward the cap', () => {
    const ns = plan({ nodes: block, settings: { ...SETTINGS, dailyCap: 2 } });
    expect(ns.map((n) => n.kind)).toEqual(['leave_by', 'transition', 'transition']);
  });
});

describe('at_risk', () => {
  it('only a Background item the caller says is slipping', () => {
    const quiet = commitment('boiler', { quiet: true });
    expect(plan({ nodes: [quiet] })).toEqual([]);
    const [n] = plan({ nodes: [quiet], atRisk: () => true });
    expect(n).toMatchObject({ kind: 'at_risk', nodeId: 'boiler', fireAt: NOON.toISOString() });
  });
});

describe('habit_summary', () => {
  it('lists open day habits once, at the chosen time, outside the cap', () => {
    const nodes = [habit({ id: 'h1', title: 'Stretch' }), habit({ id: 'h2', title: 'Water' })];
    const occurrences = [ev('h2', 'logged', '2026-03-08T09:00:00Z')];
    const ns = plan({ nodes, occurrences, settings: { ...SETTINGS, dailyCap: 0, habitSummaryTime: '19:30' } });
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ kind: 'habit_summary', body: 'Stretch', fireAt: '2026-03-08T19:30:00.000Z' });
  });

  it('is not sent when nothing is open', () => {
    expect(plan({ nodes: [habit()], occurrences: [ev('h1', 'logged', '2026-03-08T09:00:00Z')] })).toEqual([]);
  });

  it('adds a longer habit once in its final stretch, and records the mention', () => {
    const weekly = habit({ id: 'w', title: 'Long walk', period: 'week', target: 1 });
    const [n] = plan({ nodes: [weekly], now: at('2026-03-08T12:00:00Z') });
    expect(n.body).toBe('Long walk');
    expect(n.mentions).toEqual(['w|week:2026-03-02']);
    expect(plan({ nodes: [weekly], mentioned: ['w|week:2026-03-02'] })).toEqual([]);
  });
});

describe('quiet hours', () => {
  it('a nudge inside them moves to the wake time if still useful', () => {
    const now = at('2026-03-08T04:00:00Z');
    const n = plan({ now, nodes: [commitment('x', { quiet: true })], atRisk: () => true });
    expect(n).toEqual([]); // at-risk is only useful for two hours, so waking at 07:00 is too late
    const [m] = plan({ now, nodes: [meeting('early', '08:30')] });
    expect(m.fireAt).toBe('2026-03-08T08:20:00.000Z');
  });

  it('defers to the wake time when the nudge is still useful afterwards', () => {
    const now = at('2026-03-08T06:00:00Z');
    const [n] = plan({ now, nodes: [commitment('deadline', { deadline: '2026-03-08T12:00:00Z' })] });
    expect(n.fireAt).toBe('2026-03-08T11:50:00.000Z');
    const [s] = plan({ now: at('2026-03-08T06:30:00Z'), nodes: [habit()], settings: { ...SETTINGS, habitSummaryTime: '06:45' } });
    expect(s.fireAt).toBe('2026-03-08T07:00:00.000Z');
  });
});

describe('caps and one per Node', () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => meeting(id, `${14 + i}:00`.padStart(5, '0')));

  it('stops at the daily cap of five, earliest first', () => {
    const ns = plan({ nodes: many.slice(0, 6) });
    expect(ns.map((n) => n.nodeId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('nudges already issued today count against the cap and are not repeated', () => {
    const issued = [
      { id: 'leave_by|a|2026-03-08', kind: 'leave_by' as const, nodeId: 'a', day: '2026-03-08' },
      { id: 'leave_by|z|2026-03-08', kind: 'leave_by' as const, nodeId: 'z', day: '2026-03-08' },
      { id: 'leave_by|y|2026-03-08', kind: 'leave_by' as const, nodeId: 'y', day: '2026-03-08' },
      { id: 'leave_by|x|2026-03-08', kind: 'leave_by' as const, nodeId: 'x', day: '2026-03-08' },
    ];
    const ns = plan({ nodes: many.slice(0, 4), issued });
    expect(ns.map((n) => n.nodeId)).toEqual(['b']);
  });

  it('one leave_by per Node per day even from another device', () => {
    const issued = [{ id: 'leave_by|a|2026-03-08', kind: 'leave_by' as const, nodeId: 'a', day: '2026-03-08' }];
    expect(plan({ nodes: [many[0]!], issued })).toEqual([]);
  });

  it('is deterministic: the same inputs give the same ids', () => {
    expect(plan({ nodes: many }).map((n) => n.id)).toEqual(plan({ nodes: many }).map((n) => n.id));
  });
});

describe('feedback', () => {
  const nodes = [meeting('a', '15:00')];
  const fb = (over: Partial<NudgeFeedback>): NudgeFeedback => ({ ...NO_FEEDBACK, ...over });

  it('Stop these silences a kind or a Node', () => {
    expect(plan({ nodes, feedback: fb({ stoppedKinds: ['leave_by'] }) })).toEqual([]);
    expect(plan({ nodes, feedback: fb({ stoppedNodes: ['a'] }) })).toEqual([]);
    expect(plan({ nodes, disabledKinds: ['leave_by'] })).toEqual([]);
  });

  it('the first Not now brings it back thirty minutes later, if still useful', () => {
    const risky = [commitment('b', { quiet: true })];
    const [n] = plan({ nodes: risky, atRisk: () => true, feedback: fb({ notNow: { b: { count: 1, lastAt: NOON.toISOString() } } }) });
    expect(n.fireAt).toBe('2026-03-08T12:30:00.000Z');
  });

  it('a rescheduled nudge past its useful life is dropped', () => {
    const now = at('2026-03-08T14:52:00Z');
    expect(plan({ nodes, now, feedback: fb({ notNow: { a: { count: 1, lastAt: '2026-03-08T14:51:00Z' } } }) })).toEqual([]);
  });

  it('the second Not now silences the Node', () => {
    expect(plan({ nodes, feedback: fb({ notNow: { a: { count: 2, lastAt: '2026-03-08T11:00:00Z' } } }) })).toEqual([]);
  });
});

describe('wording', () => {
  it('never uses blame or urgency words', () => {
    const nodes = [
      meeting('Dentist', '15:00', { durationMinutes: 90 }),
      commitment('Report', { deadline: '2026-03-08T17:00:00Z', durationMinutes: 60 }),
      commitment('Boiler', { quiet: true }),
      habit({ title: 'Stretch' }),
    ];
    const ns = plan({ nodes, travel: () => 15, atRisk: (n) => n.quiet });
    expect(ns.length).toBeGreaterThan(4);
    for (const n of ns) expect(`${n.title} ${n.body}`).not.toMatch(/behind|overdue|failed|lazy|should|late|missed|urgent/i);
  });
});
