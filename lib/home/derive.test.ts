import { describe, expect, it } from 'vitest';
import type { Commitment, Idea, Node, Occurrence } from '../domain';
import { heapItems, keptToday, nodeState, reorderIds, stackDays, stopRecords } from './derive';

const NOW = new Date('2026-10-03T15:00:00.000Z');
const opts = { timeZone: 'UTC' };

const commitment = (id: string, over: Partial<Commitment> = {}): Commitment => ({
  id, kind: 'commitment', title: id, private: false, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  slog: false, quiet: false, ...over,
});
const idea = (id: string, createdAt = '2026-10-02T10:00:00.000Z'): Idea => ({
  id, kind: 'idea', title: id, private: false, createdAt, updatedAt: createdAt,
});
let n = 0;
const occ = (nodeId: string, type: Occurrence['type'], at: string, extra: Partial<Occurrence> = {}): Occurrence => ({
  id: `o${++n}`, nodeId, type, at, source: 'app', ...extra,
});

describe('nodeState', () => {
  it('tracks done and started, and an undone cancels them', () => {
    const d = occ('a', 'done', '2026-10-03T12:00:00.000Z');
    const s = occ('a', 'started', '2026-10-03T11:00:00.000Z');
    expect(nodeState('a', [s, d])).toMatchObject({ done: true, started: true });
    expect(nodeState('a', [s, d, occ('a', 'undone', '2026-10-03T12:05:00.000Z', { undoes: d.id })]).done).toBe(false);
  });

  it('ignores other nodes', () => {
    expect(nodeState('a', [occ('b', 'done', NOW.toISOString())]).done).toBe(false);
  });
});

describe('heapItems', () => {
  it('lists ideas and parked commitments, newest first, and drops brought-back ones', () => {
    const p = occ('c1', 'parked', '2026-10-03T09:00:00.000Z');
    const nodes = [idea('old', '2026-10-01T00:00:00.000Z'), idea('new', '2026-10-03T00:00:00.000Z'), commitment('c1', { updatedAt: '2026-10-02T00:00:00.000Z' })];
    expect(heapItems(nodes, [p]).map((x) => x.id)).toEqual(['new', 'c1', 'old']);
    const back = occ('c1', 'undone', '2026-10-03T10:00:00.000Z', { undoes: p.id });
    expect(heapItems(nodes, [p, back]).map((x) => x.id)).toEqual(['new', 'old']);
  });

  it('does not list a commitment that was never parked', () => {
    expect(heapItems([commitment('open')], [])).toEqual([]);
  });
});

describe('keptToday', () => {
  it('returns only commitments done in the local day, most recent first', () => {
    const nodes = [commitment('a'), commitment('b'), commitment('yesterday')];
    const occs = [
      occ('a', 'done', '2026-10-03T08:00:00.000Z'),
      occ('b', 'done', '2026-10-03T11:00:00.000Z'),
      occ('yesterday', 'done', '2026-10-02T23:00:00.000Z'),
    ];
    expect(keptToday(nodes, occs, NOW, opts).map((k) => k.id)).toEqual(['b', 'a']);
  });
});

describe('stackDays', () => {
  const stack = (nodes: Node[], occs: Occurrence[] = []) => stackDays(nodes, occs, NOW, 7, opts);

  it('places items by fixed time, deadline, planned day, else today', () => {
    const days = stack([
      commitment('fixed', { fixedTime: '2026-10-05T09:00:00.000Z' }),
      commitment('due', { deadline: '2026-10-04T12:00:00.000Z' }),
      commitment('planned', { plannedFor: '2026-10-06' }),
      commitment('plain'),
    ]);
    const at = (k: string) => days.find((d) => d.key === k)!.items.map((i) => i.id);
    expect(at('2026-10-05')).toEqual(['fixed']);
    expect(at('2026-10-04')).toEqual(['due']);
    expect(at('2026-10-06')).toEqual(['planned']);
    expect(at('2026-10-03')).toEqual(['plain']);
  });

  it('puts overdue items on today, orders timed items first, and skips done and parked items', () => {
    const p = occ('parked', 'parked', '2026-10-03T08:00:00.000Z');
    const d = occ('finished', 'done', '2026-10-03T08:00:00.000Z');
    const days = stack([
      commitment('late', { deadline: '2026-10-01T12:00:00.000Z' }),
      commitment('noon', { fixedTime: '2026-10-03T18:00:00.000Z' }),
      commitment('parked'), commitment('finished'),
      commitment('far', { plannedFor: '2027-01-01' }),
    ], [p, d]);
    expect(days[0].items.map((i) => i.id)).toEqual(['late', 'noon']);
    expect(days.flatMap((x) => x.items).map((i) => i.id)).not.toContain('parked');
    expect(days.flatMap((x) => x.items).map((i) => i.id)).not.toContain('finished');
  });

  it('gives an item scheduled past the week a day of its own, after the week', () => {
    const days = stack([commitment('far', { plannedFor: '2026-12-01' }), commitment('today')]);
    expect(days).toHaveLength(8);
    expect(days[7]).toMatchObject({ key: '2026-12-01' });
    expect(days[7]!.items.map((i) => i.id)).toEqual(['far']);
  });

});

describe('orphaned occurrences safety', () => {
  it('heapItems only lists nodes from the nodes array', () => {
    const occs = [
      occ('existing', 'parked', '2026-10-03T09:00:00.000Z'),
      occ('deleted', 'parked', '2026-10-03T09:00:00.000Z'), // orphaned - not in nodes
    ];
    const items = heapItems([commitment('existing')], occs);
    expect(items.map((i) => i.id)).toEqual(['existing']);
  });

  it('keptToday only lists nodes from the nodes array', () => {
    const occs = [
      occ('existing', 'done', '2026-10-03T12:00:00.000Z'),
      occ('deleted', 'done', '2026-10-03T12:00:00.000Z'), // orphaned - not in nodes
    ];
    const kept = keptToday([commitment('existing')], occs, NOW, opts);
    expect(kept.map((k) => k.id)).toEqual(['existing']);
  });
});

describe('stopRecords', () => {
  const make = (nodeId: string, undoes: string) => ({ nodeId, undoes });

  it('cancels each standing start, so the item is no longer started and not done', () => {
    const s1 = occ('a', 'started', '2026-10-03T11:00:00.000Z');
    const s2 = occ('a', 'started', '2026-10-03T12:00:00.000Z');
    const other = occ('b', 'started', '2026-10-03T12:00:00.000Z');
    const cancels = stopRecords('a', [s1, s2, other], make);
    expect(cancels.map((c) => c.undoes)).toEqual([s1.id, s2.id]);
    const after = [s1, s2, other, ...cancels.map((c) => occ(c.nodeId, 'undone', '2026-10-03T13:00:00.000Z', { undoes: c.undoes }))];
    expect(nodeState('a', after)).toEqual({ done: false, started: false });
    expect(nodeState('b', after).started).toBe(true);
  });

  it('does nothing for an item that is not started, or already stopped', () => {
    expect(stopRecords('a', [], make)).toEqual([]);
    const s = occ('a', 'started', '2026-10-03T11:00:00.000Z');
    expect(stopRecords('a', [s, occ('a', 'undone', '2026-10-03T11:30:00.000Z', { undoes: s.id })], make)).toEqual([]);
  });
});

describe('day order', () => {
  it('sorts untimed items by dayOrder after timed ones, and unordered ones last', () => {
    const nodes = [
      commitment('late', { plannedFor: '2026-10-03', dayOrder: 2 }),
      commitment('timed', { fixedTime: '2026-10-03T16:00:00.000Z' }),
      commitment('first', { plannedFor: '2026-10-03', dayOrder: 0 }),
      commitment('none', { plannedFor: '2026-10-03' }),
    ];
    expect(stackDays(nodes, [], NOW, 7, opts)[0]!.items.map((i) => i.id)).toEqual(['timed', 'first', 'late', 'none']);
  });

  it('reorderIds drops before a target, or at the end', () => {
    expect(reorderIds(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(reorderIds(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a']);
    expect(reorderIds(['a', 'b'], 'x', 'b')).toEqual(['a', 'x', 'b']);
    expect(reorderIds(['a', 'b'], 'a', 'missing')).toEqual(['b', 'a']);
  });
});

describe('heapItems details', () => {
  const link = (fromId: string, toId: string) => ({ id: `${fromId}-${toId}`, type: 'requires' as const, fromId, toId, origin: 'stated' as const, confidence: 1, evidence: [], createdAt: '', updatedAt: '' });

  it('carries tag, minutes, backlog and open blockers, and pushes backlogged items to the bottom', () => {
    const nodes = [
      { ...idea('later', '2026-10-03T00:00:00.000Z'), backlog: true },
      { ...idea('tagged', '2026-10-01T00:00:00.000Z'), category: 'Jev', estimateMinutes: 20 },
      idea('blocked', '2026-10-02T00:00:00.000Z'),
    ];
    const items = heapItems(nodes, [], [link('blocked', 'tagged')]);
    expect(items.map((i) => i.id)).toEqual(['blocked', 'tagged', 'later']);
    expect(items[1]).toMatchObject({ category: 'Jev', minutes: 20, backlog: false, blockedBy: [] });
    expect(items[0]!.blockedBy).toEqual([{ id: 'tagged', title: 'tagged' }]);
  });

  it('a parked commitment uses its own duration, and a finished prerequisite no longer blocks', () => {
    const c = commitment('c', { durationMinutes: 45, estimateMinutes: 10 });
    const items = heapItems([c, idea('i')], [occ('c', 'parked', '2026-10-03T09:00:00.000Z'), occ('i', 'done', '2026-10-03T09:00:00.000Z')], [link('c', 'i')]);
    expect(items.find((x) => x.id === 'c')).toMatchObject({ minutes: 45, blockedBy: [] });
  });
});
