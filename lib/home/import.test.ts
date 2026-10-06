import { describe, expect, it } from 'vitest';
import type { Idea } from '../domain/types';
import { GOOGLE_TASKS, importedTaskIds } from './import';

const idea = (over: Partial<Idea>): Idea => ({ kind: 'idea', id: 'i', title: 'An idea', private: false, createdAt: '2026-10-02T12:00:00.000Z', updatedAt: '2026-10-02T12:00:00.000Z', ...over });

describe('importedTaskIds', () => {
  it('finds only the Ideas the old Google Tasks import added', () => {
    const nodes = [
      idea({ id: 'a', external: { system: GOOGLE_TASKS, id: 'L1:t1' } }),
      idea({ id: 'b' }),
      idea({ id: 'c', external: { system: 'something-else', id: 'x' } }),
    ];
    expect([...importedTaskIds(nodes)]).toEqual(['a']);
  });
});
