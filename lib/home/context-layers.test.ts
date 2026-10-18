import { describe, expect, it } from 'vitest';
import type { Commitment, Goal, Idea, Node, Occurrence } from '../domain';
import { baseContext, calendarBlock, calendarWindow, lookupLayer, type GraphData } from './context-layers';
import type { Memory } from './memory';

const NOW = new Date('2026-10-18T15:00:00.000Z');
const opts = { now: NOW, timeZone: 'UTC' };
const STAMP = '2026-10-01T10:00:00.000Z';

const commitment = (id: string, title: string, over: Partial<Commitment> = {}): Commitment => ({
  id, kind: 'commitment', title, private: false, createdAt: STAMP, updatedAt: STAMP, slog: false, quiet: false, ...over,
});
const idea = (id: string, title: string, over: Partial<Idea> = {}): Idea => ({ id, kind: 'idea', title, private: false, createdAt: STAMP, updatedAt: STAMP, ...over });
const goal = (id: string, title: string): Goal => ({ id, kind: 'goal', title, private: false, createdAt: STAMP, updatedAt: STAMP, finishLine: false, checkpoint: false });
const memory = (id: string, text: string, over: Partial<Memory> = {}): Memory => ({ id, text, origin: 'stated', private: false, createdAt: STAMP, updatedAt: STAMP, ...over });
const occ = (id: string, nodeId: string, type: Occurrence['type'], at: string): Occurrence => ({ id, nodeId, type, at, source: 'app' });

const nodes: Node[] = [
  commitment('c1', 'Dentist', { fixedTime: '2026-10-18T17:30:00.000Z' }),
  commitment('c2', 'Send invoice to Acme'),
  commitment('c3', 'Book flights to Denver', { plannedFor: '2026-10-25' }),
  commitment('c4', 'Far away thing', { plannedFor: '2026-12-01' }),
  commitment('c5', 'Therapy appointment', { private: true }),
  commitment('c6', 'Call the bank', { notes: 'about the mortgage' }),
  idea('i1', 'Learn the banjo'),
  idea('i2', 'Secret plan', { private: true }),
  goal('g1', 'Run a half marathon'),
];
const occurrences = [occ('o1', 'c6', 'done', '2026-10-10T12:00:00.000Z')];
const data: GraphData = {
  nodes, links: [], occurrences,
  memories: [memory('m1', 'Sam is my sister in Denver'), memory('m2', 'Hates phone calls'), memory('m3', 'Private note', { private: true })],
};
const block = (blocks: { layer: string; lines: string[] }[], layer: string) => blocks.find((b) => b.layer === layer)!.lines;

describe('baseContext', () => {
  const ctx = baseContext(data, 'Should I visit Denver?', opts);

  it('sends the time, today, the next three weeks, the heap, goals and matching memories', () => {
    expect(block(ctx.blocks, 'now')[0]).toMatch(/Sunday, 18 October 2026/);
    expect(block(ctx.blocks, 'today')).toEqual(['17:30 Dentist', 'Send invoice to Acme']);
    expect(block(ctx.blocks, 'coming_up')).toEqual(['Sun 25 Oct: Book flights to Denver']);
    expect(block(ctx.blocks, 'heap')).toEqual(['Learn the banjo']);
    expect(block(ctx.blocks, 'goals')).toEqual(['Run a half marathon']);
    expect(block(ctx.blocks, 'memory')[0]).toBe('Sam is my sister in Denver');
    expect(ctx.memoryIds).toEqual(['m1', 'm2']);
  });

  it('leaves out Private items and memories and counts them', () => {
    const all = JSON.stringify(ctx.blocks);
    expect(all).not.toMatch(/Therapy|Secret plan|Private note/);
    expect(ctx.privateExcluded).toBe(3);
  });

  it('leaves items past three weeks for a lookup', () => {
    expect(JSON.stringify(ctx.blocks)).not.toContain('Far away thing');
  });
});

describe('lookupLayer', () => {
  it('items: finds by title or notes across the whole list, with status, never Private', () => {
    expect(lookupLayer('items', 'mortgage', data, opts).lines).toEqual(['Call the bank (commitment, done) | notes: about the mortgage']);
    expect(lookupLayer('items', 'far away', data, opts).lines[0]).toContain('planned 2026-12-01');
    expect(lookupLayer('items', 'therapy secret', data, opts).lines).toEqual([]);
  });

  it('memory: searches every memory, not just the few in the base layer', () => {
    expect(lookupLayer('memory', 'phone', data, opts).lines).toEqual(['Hates phone calls']);
  });

  it('history: what was done lately, filtered by the words when there are any', () => {
    expect(lookupLayer('history', '', data, opts).lines).toEqual(['2026-10-10 done: Call the bank']);
    expect(lookupLayer('history', 'banjo', data, opts).lines).toEqual([]);
  });
});

describe('calendar lookup', () => {
  it('reads two days from the named day, or from today', () => {
    expect(calendarWindow('2026-10-21', opts).day).toBe('2026-10-21');
    expect(calendarWindow('next week', opts).day).toBe('2026-10-18');
    const w = calendarWindow('', opts);
    expect(Date.parse(w.timeMax) - Date.parse(w.timeMin)).toBeLessThanOrEqual(48 * 3600_000);
  });

  it('lists events and says so calmly when the calendar could not be read', () => {
    expect(calendarBlock([{ summary: 'Standup', start: '2026-10-19T09:00:00.000Z', end: null }], '2026-10-18', 'UTC').lines).toEqual(['2026-10-19 09:00 Standup']);
    expect(calendarBlock(null, '2026-10-18', 'UTC').lines[0]).toContain('could not be read');
  });
});
