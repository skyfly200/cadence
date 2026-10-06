import { describe, expect, it } from 'vitest';
import type { Idea, Link, Occurrence } from '../domain';
import type { HeapItem } from './derive';
import { addTag, DEFAULT_HEAP_VIEW, matchTag, openBlockers, tagOptions, viewHeap } from './heap';

const item = (id: string, over: Partial<HeapItem> = {}): HeapItem => ({ id, title: id, kind: 'idea', at: '2026-10-01T00:00:00.000Z', category: null, minutes: null, backlog: false, blockedBy: [], ...over });
const view = (over: Partial<typeof DEFAULT_HEAP_VIEW>) => ({ ...DEFAULT_HEAP_VIEW, ...over });
const ids = (xs: HeapItem[]) => xs.map((x) => x.id);

describe('viewHeap', () => {
  const items = [
    item('buy gift', { category: 'Laya', minutes: 30, at: '2026-10-01T00:00:00.000Z' }),
    item('call school', { category: 'Jev', minutes: 10, at: '2026-10-03T00:00:00.000Z' }),
    item('tax forms', { minutes: 90, at: '2026-10-02T00:00:00.000Z', blockedBy: [{ id: 'x', title: 'x' }] }),
    item('old thing', { backlog: true, at: '2026-10-04T00:00:00.000Z' }),
  ];

  it('searches the title and the tag', () => {
    expect(ids(viewHeap(items, view({ query: 'GIFT' })))).toEqual(['buy gift']);
    expect(ids(viewHeap(items, view({ query: 'jev' })))).toEqual(['call school']);
  });
  it('filters by tag and by status', () => {
    expect(ids(viewHeap(items, view({ tag: 'laya' })))).toEqual(['buy gift']);
    expect(ids(viewHeap(items, view({ status: 'blocked' })))).toEqual(['tax forms']);
    expect(ids(viewHeap(items, view({ status: 'ready' })))).toEqual(['call school', 'buy gift']);
    expect(ids(viewHeap(items, view({ status: 'backlog' })))).toEqual(['old thing']);
  });
  it('sorts, always keeping the backlog at the bottom', () => {
    expect(ids(viewHeap(items, view({ sort: 'newest' })))).toEqual(['call school', 'tax forms', 'buy gift', 'old thing']);
    expect(ids(viewHeap(items, view({ sort: 'oldest' })))).toEqual(['buy gift', 'tax forms', 'call school', 'old thing']);
    expect(ids(viewHeap(items, view({ sort: 'az' })))).toEqual(['buy gift', 'call school', 'tax forms', 'old thing']);
    expect(ids(viewHeap(items, view({ sort: 'shortest' })))).toEqual(['call school', 'buy gift', 'tax forms', 'old thing']);
    expect(ids(viewHeap(items, view({ sort: 'longest' })))).toEqual(['tax forms', 'buy gift', 'call school', 'old thing']);
    expect(ids(viewHeap(items, view({ sort: 'tag' })))).toEqual(['call school', 'buy gift', 'tax forms', 'old thing']);
    expect(ids(viewHeap(items, view({ sort: 'blocked' })))[0]).toBe('tax forms');
  });
});

describe('openBlockers', () => {
  const n = (id: string): Idea => ({ id, kind: 'idea', title: id, private: false, createdAt: '', updatedAt: '' });
  const l = (fromId: string, toId: string): Link => ({ id: `${fromId}${toId}`, type: 'requires', fromId, toId, origin: 'stated', confidence: 1, evidence: [], createdAt: '', updatedAt: '' });
  it('lists unfinished prerequisites only', () => {
    const done: Occurrence = { id: 'o', nodeId: 'b', type: 'done', at: '2026-10-01T00:00:00.000Z', source: 'app' };
    const m = openBlockers([n('a'), n('b'), n('c')], [l('a', 'b'), l('a', 'c'), l('a', 'gone')], [done]);
    expect(m.get('a')).toEqual([{ id: 'c', title: 'c' }]);
  });
});

describe('tags', () => {
  it('matches a whole word of the title, case-insensitively', () => {
    expect(matchTag('Pick up Jev from school', ['Laya', 'Jev'])).toBe('Jev');
    expect(matchTag("Jev's party", ['Jev'])).toBe('Jev');
    expect(matchTag('Jevon is here', ['Jev'])).toBeNull();
    expect(matchTag('nothing here', ['Jev'])).toBeNull();
  });
  it('adds a tag once, trimmed', () => {
    expect(addTag(['Jev'], '  laya ')).toEqual(['Jev', 'laya']);
    expect(addTag(['Jev'], ' JEV')).toEqual(['Jev']);
    expect(addTag(['Jev'], '   ')).toEqual(['Jev']);
  });
  it('offers the list plus any tag in use', () => {
    expect(tagOptions([item('a', { category: 'Work' }), item('b', { category: 'Jev' })], ['Jev', 'Laya'])).toEqual(['Jev', 'Laya', 'Work']);
  });
});
