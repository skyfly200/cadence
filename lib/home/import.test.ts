import { describe, expect, it } from 'vitest';
import type { Idea } from '../domain/types';
import { GOOGLE_TASKS, ideasFromTasks, importLine, type ImportedTask } from './import';

const now = new Date('2026-10-02T12:00:00.000Z');
const idea = (over: Partial<Idea>): Idea => ({ kind: 'idea', id: 'i', title: 'An idea', private: false, createdAt: now.toISOString(), updatedAt: now.toISOString(), ...over });
const T = (over: Partial<ImportedTask> = {}): ImportedTask => ({ id: 'L1:t1', title: 'Call the dentist', notes: null, due: null, ...over });
const ids = () => { let n = 0; return () => `new${++n}`; };

describe('ideasFromTasks', () => {
  it('makes an Idea per task, never private, remembering which task it came from', () => {
    const r = ideasFromTasks([T(), T({ id: 'L1:t2', title: ' Buy   stamps ' })], [], now, ids());
    expect(r).toMatchObject({ imported: 2, skipped: 0 });
    expect(r.ideas[0]).toMatchObject({ id: 'new1', kind: 'idea', title: 'Call the dentist', notes: null, private: false, external: { system: GOOGLE_TASKS, id: 'L1:t1' } });
    expect(r.ideas[1]).toMatchObject({ title: 'Buy stamps', external: { id: 'L1:t2' } });
  });

  it('keeps the task notes and its due day in the Idea notes', () => {
    const r = ideasFromTasks([T({ notes: 'ask about Friday', due: '2026-10-05T00:00:00.000Z' })], [], now, ids());
    expect(r.ideas[0]!.notes).toBe('ask about Friday\nDue Mon, Oct 5');
    expect(ideasFromTasks([T({ due: 'not a date' })], [], now, ids()).ideas[0]!.notes).toBeNull();
  });

  it('skips a task already imported, even after the Idea was edited or renamed', () => {
    const have = { ...idea({ id: 'existing', title: 'Renamed since' }), external: { system: GOOGLE_TASKS, id: 'L1:t1' } };
    const r = ideasFromTasks([T(), T({ id: 'L1:t2' })], [have], now, ids());
    expect(r).toMatchObject({ imported: 1, skipped: 1 });
    expect(r.ideas[0]!.external?.id).toBe('L1:t2');
  });

  it('does not treat an unrelated Idea, or one from another system, as already imported', () => {
    const other = { ...idea({ id: 'o', title: 'Call the dentist' }), external: { system: 'something-else', id: 'L1:t1' } };
    expect(ideasFromTasks([T()], [idea({ id: 'p', title: 'Call the dentist' }), other], now, ids()).imported).toBe(1);
  });

  it('imports a repeated task id once within a batch, and ignores empty titles', () => {
    const r = ideasFromTasks([T(), T(), T({ id: 'L1:t3', title: '   ' })], [], now, ids());
    expect(r.imported).toBe(1);
  });

  it('importing again right after is a no-op', () => {
    const first = ideasFromTasks([T(), T({ id: 'L1:t2' })], [], now, ids());
    const second = ideasFromTasks([T(), T({ id: 'L1:t2' })], first.ideas, now, ids());
    expect(second).toMatchObject({ ideas: [], imported: 0, skipped: 2 });
  });
});

describe('importLine', () => {
  it('says what happened plainly', () => {
    expect(importLine({ imported: 3, skipped: 0 })).toBe('Imported 3 tasks as ideas.');
    expect(importLine({ imported: 1, skipped: 2 })).toBe('Imported 1 task as ideas. 2 already here.');
    expect(importLine({ imported: 0, skipped: 4 })).toBe('Everything is already here.');
    expect(importLine({ imported: 0, skipped: 0 })).toBe('No open tasks to import.');
  });
});
