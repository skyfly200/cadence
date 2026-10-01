import { describe, expect, it } from 'vitest';
import type { Commitment, Idea, Occurrence } from '../domain';
import { keptToday, nodeState, parkedItems } from './derive';

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

describe('parkedItems', () => {
  it('lists ideas and parked commitments, newest first, and drops brought-back ones', () => {
    const p = occ('c1', 'parked', '2026-10-03T09:00:00.000Z');
    const nodes = [idea('old', '2026-10-01T00:00:00.000Z'), idea('new', '2026-10-03T00:00:00.000Z'), commitment('c1', { updatedAt: '2026-10-02T00:00:00.000Z' })];
    expect(parkedItems(nodes, [p]).map((x) => x.id)).toEqual(['new', 'c1', 'old']);
    const back = occ('c1', 'undone', '2026-10-03T10:00:00.000Z', { undoes: p.id });
    expect(parkedItems(nodes, [p, back]).map((x) => x.id)).toEqual(['new', 'old']);
  });

  it('does not list a commitment that was never parked', () => {
    expect(parkedItems([commitment('open')], [])).toEqual([]);
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
