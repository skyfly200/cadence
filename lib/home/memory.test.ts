import { describe, expect, it } from 'vitest';
import { addMemory, editMemory, forgetMemory, liveMemories, markUsed, mergeMemories, rankMemories, searchMemories, words, type Memory } from './memory';

const T0 = new Date('2026-10-01T10:00:00.000Z');
const T1 = new Date('2026-10-02T10:00:00.000Z');
const mem = (id: string, text: string, over: Partial<Memory> = {}): Memory => ({
  id, text, origin: 'stated', private: false, createdAt: T0.toISOString(), updatedAt: T0.toISOString(), lastUsedAt: null, ...over,
});

describe('memory list', () => {
  it('adds a memory once: the same words again return the existing one', () => {
    const a = addMemory([], '  Sam is my   sister ', 'stated', T0, 'm1');
    expect(a.memory).toMatchObject({ id: 'm1', text: 'Sam is my sister', origin: 'stated', private: false });
    const b = addMemory(a.list, 'sam is my sister', 'proposed_accepted', T1, 'm2');
    expect(b.list).toHaveLength(1);
    expect(b.memory?.id).toBe('m1');
    expect(addMemory([], '   ', 'stated', T0, 'x').memory).toBeNull();
  });

  it('edits words and the Private flag, and forgets by emptying the words', () => {
    const list = [mem('m1', 'Likes mornings')];
    const edited = editMemory(list, 'm1', { text: 'Likes early mornings', private: true }, T1);
    expect(edited[0]).toMatchObject({ text: 'Likes early mornings', private: true, updatedAt: T1.toISOString() });
    expect(editMemory(list, 'm1', { text: '  ' }, T1)[0]!.text).toBe('Likes mornings');
    const gone = forgetMemory(edited, 'm1', T1);
    expect(gone[0]).toMatchObject({ text: '', deleted: true });
    expect(liveMemories(gone)).toHaveLength(0);
  });

  it('marks memories used without moving the sync clock', () => {
    const used = markUsed([mem('m1', 'a')], ['m1'], T1);
    expect(used[0]).toMatchObject({ lastUsedAt: T1.toISOString(), updatedAt: T0.toISOString() });
  });

  it('merges two copies by id, newer wins and a forget on either side carries', () => {
    const here = [mem('m1', 'Likes tea'), mem('m2', 'Walks the dog', { updatedAt: T1.toISOString() })];
    const there = [mem('m1', '', { deleted: true, updatedAt: T1.toISOString() }), mem('m2', 'old words'), mem('m3', 'New on the phone')];
    const merged = mergeMemories(here, there);
    expect(merged.find((m) => m.id === 'm1')?.deleted).toBe(true);
    expect(merged.find((m) => m.id === 'm2')?.text).toBe('Walks the dog');
    expect(merged.map((m) => m.id).sort()).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('memory relevance', () => {
  const list = [
    mem('a', 'Sam is my sister and lives in Denver'),
    mem('b', 'Prefers deep work in the morning', { lastUsedAt: T1.toISOString() }),
    mem('c', 'Allergic to cats', { private: true }),
    mem('d', 'Plays guitar on Sundays', { deleted: true, text: '' }),
  ];

  it('drops filler words and plurals', () => {
    expect(words("I'm going to call Sam's sisters")).toEqual(['call', 'sam', 'sister']);
  });

  it('ranks matches first, fills with the most recently used, and never returns Private or forgotten ones', () => {
    expect(rankMemories(list, 'visiting my sister', 5).map((m) => m.id)).toEqual(['a', 'b']);
    expect(rankMemories(list, 'nothing related', 1).map((m) => m.id)).toEqual(['b']);
    expect(rankMemories(list, 'cats', 5).some((m) => m.id === 'c')).toBe(false);
  });

  it('searches only real matches', () => {
    expect(searchMemories(list, 'morning work', 5).map((m) => m.id)).toEqual(['b']);
    expect(searchMemories(list, 'cats guitar', 5)).toEqual([]);
  });
});
