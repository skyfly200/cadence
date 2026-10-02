import { describe, expect, it } from 'vitest';
import { attachable, newGoal, newStep, partOf } from './goal-edit';
import { commitment, goal, link } from '../domain/test-helpers';

const NOW = new Date('2026-10-01T12:00:00.000Z');

describe('newGoal / newStep', () => {
  it('trim the title and refuse an empty one', () => {
    expect(newGoal('  Ship it ', NOW, 'g')).toMatchObject({ kind: 'goal', title: 'Ship it', private: false, checkpoint: false });
    expect(newGoal('ready', NOW, 'm', true)?.checkpoint).toBe(true);
    expect(newGoal('   ', NOW, 'g')).toBeNull();
    expect(newStep(' Call ', NOW, 'c')).toMatchObject({ kind: 'commitment', title: 'Call', slog: false, quiet: false });
    expect(newStep('', NOW, 'c')).toBeNull();
  });
});

describe('partOf', () => {
  it('builds a stated, full-confidence part_of Link from child to parent', () => {
    expect(partOf([], 'a', 'g', NOW, 'l1')).toMatchObject({ id: 'l1', type: 'part_of', fromId: 'a', toId: 'g', origin: 'stated', confidence: 1 });
  });
  it('refuses duplicates, self-nesting and loops', () => {
    const links = [link('part_of', 'm', 'g')];
    expect(partOf(links, 'm', 'g', NOW, 'x')).toBeNull();
    expect(partOf(links, 'g', 'g', NOW, 'x')).toBeNull();
    expect(partOf(links, 'g', 'm', NOW, 'x')).toBeNull(); // g is above m
  });
});

describe('attachable', () => {
  it('offers open Commitments not already under the parent', () => {
    const nodes = [goal('g'), commitment('a'), commitment('b'), commitment('done')];
    const links = [link('part_of', 'a', 'g')];
    expect(attachable(nodes, links, 'g', new Set(['done'])).map((c) => c.id)).toEqual(['b']);
  });
});
