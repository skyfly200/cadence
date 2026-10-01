import { describe, expect, it } from 'vitest';
import type { Commitment, Idea, Occurrence } from '../domain/types';
import { candidates, keptToday, nodeState, parkedItems, pickNow, shelfNote, SHELF_MS } from './derive';

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
  it('tracks done, and an undone cancels it', () => {
    const d = occ('a', 'done', '2026-10-03T12:00:00.000Z');
    expect(nodeState('a', [d]).done).toBe(true);
    expect(nodeState('a', [d, occ('a', 'undone', '2026-10-03T12:05:00.000Z', { undoes: d.id })]).done).toBe(false);
  });

  it('parked, and bringing it back with an undone', () => {
    const p = occ('a', 'parked', '2026-10-03T12:00:00.000Z');
    expect(nodeState('a', [p]).parked).toBe(true);
    expect(nodeState('a', [p, occ('a', 'undone', '2026-10-03T13:00:00.000Z', { undoes: p.id })]).parked).toBe(false);
  });

  it('reads the shelf time from a moved occurrence', () => {
    const until = new Date(NOW.getTime() + SHELF_MS).toISOString();
    expect(nodeState('a', [occ('a', 'moved', NOW.toISOString(), { note: shelfNote(NOW) })]).shelvedUntil).toBe(until);
  });

  it('ignores other nodes', () => {
    expect(nodeState('a', [occ('b', 'done', NOW.toISOString())]).done).toBe(false);
  });
});

describe('candidates and pickNow', () => {
  it('excludes done, parked, shelved (until it expires) and quiet commitments', () => {
    const nodes = [commitment('done'), commitment('parked'), commitment('shelved'), commitment('quiet', { quiet: true }), commitment('open')];
    const occs = [
      occ('done', 'done', '2026-10-03T10:00:00.000Z'),
      occ('parked', 'parked', '2026-10-03T10:00:00.000Z'),
      occ('shelved', 'moved', '2026-10-03T14:00:00.000Z', { note: shelfNote(new Date('2026-10-03T14:00:00.000Z')) }), // until 16:00
    ];
    expect(candidates(nodes, occs, NOW).map((c) => c.id)).toEqual(['open']);
    const later = new Date('2026-10-03T16:30:00.000Z');
    expect(candidates(nodes, occs, later).map((c) => c.id).sort()).toEqual(['open', 'shelved']);
  });

  it('puts timed items first (soonest), then the rest oldest first', () => {
    const nodes = [
      commitment('plain-new', { createdAt: '2026-10-02T00:00:00.000Z' }),
      commitment('plain-old', { createdAt: '2026-10-01T00:00:00.000Z' }),
      commitment('later', { fixedTime: '2026-10-03T20:00:00.000Z' }),
      commitment('sooner', { deadline: '2026-10-03T18:00:00.000Z' }),
    ];
    const r = pickNow(nodes, [], NOW);
    expect(r.now?.id).toBe('sooner');
    expect(r.strip.map((c) => c.id)).toEqual(['later', 'plain-old', 'plain-new']);
  });

  it('returns no card when nothing is open', () => {
    expect(pickNow([idea('i')], [], NOW)).toEqual({ now: null, strip: [] });
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
