import { describe, expect, it, vi } from 'vitest';
import type { Idea } from '../domain';
import { converseTurn, type ConverseDeps } from './converse';
import type { Memory } from './memory';
import type { Turn } from '../../server/utils/discuss';

const STAMP = '2026-10-01T10:00:00.000Z';
const idea = (id: string, title: string): Idea => ({ id, kind: 'idea', title, private: false, createdAt: STAMP, updatedAt: STAMP });
const memory = (id: string, text: string): Memory => ({ id, text, origin: 'stated', private: false, createdAt: STAMP, updatedAt: STAMP });
const turns: Turn[] = [{ role: 'user', text: 'What about the banjo?' }];

function deps(replies: unknown[], over: Partial<ConverseDeps> = {}) {
  let i = 0;
  const call = vi.fn(async (_body: unknown) => ({ status: 'ok' as const, data: replies[Math.min(i++, replies.length - 1)] as never }));
  return {
    call,
    d: {
      call,
      data: { nodes: [idea('i1', 'Learn the banjo')], links: [], occurrences: [], memories: [memory('m1', 'Plays guitar')] },
      opts: { now: new Date('2026-10-18T15:00:00.000Z'), timeZone: 'UTC' },
      ...over,
    } satisfies ConverseDeps,
  };
}
const bodyOf = (call: ReturnType<typeof deps>['call'], n: number) => call.mock.calls[n]![0] as { context: { layer: string; lines: string[] }[]; layers: string[]; lookups: number };

describe('converseTurn', () => {
  it('sends the base layer and the layers this device can answer, and returns the reply', async () => {
    const { call, d } = deps([{ ok: true, crisis: false, reply: 'Want to start tonight?', last: false, remember: [] }]);
    const r = await converseTurn(turns, d);
    expect(r).toMatchObject({ status: 'reply', reply: 'Want to start tonight?', memoryIds: ['m1'] });
    expect(bodyOf(call, 0).layers).toEqual(['memory', 'items', 'history']);
    expect(bodyOf(call, 0).context.find((b) => b.layer === 'heap')?.lines).toEqual(['Learn the banjo']);
  });

  it('answers a lookup from this device and calls again with the result and the count', async () => {
    const onLookup = vi.fn();
    const { call, d } = deps([
      { ok: true, crisis: false, lookup: { layer: 'items', query: 'banjo' }, lookups: 1, found: [{ layer: 'github', title: 'GitHub', lines: ['PR 1'] }] },
      { ok: true, crisis: false, reply: 'It is in your heap.', last: false },
    ], { onLookup });
    const r = await converseTurn(turns, d);
    expect(r).toMatchObject({ status: 'reply', reply: 'It is in your heap.', remember: [] });
    const second = bodyOf(call, 1);
    expect(second.lookups).toBe(1);
    expect(second.context.find((b) => b.layer === 'items')?.lines[0]).toContain('Learn the banjo');
    expect(second.context.find((b) => b.layer === 'github')?.lines).toEqual(['PR 1']);
    expect(onLookup).toHaveBeenCalledWith('Looking through your list');
  });

  it('offers and reads the calendar only when connected', async () => {
    const calendar = vi.fn(async () => [{ summary: 'Standup', start: '2026-10-21T09:00:00.000Z', end: null }]);
    const { call, d } = deps([
      { ok: true, crisis: false, lookup: { layer: 'calendar', query: '2026-10-21' }, lookups: 1 },
      { ok: true, crisis: false, reply: 'You have standup.', last: false },
    ], { calendar });
    await converseTurn(turns, d);
    expect(bodyOf(call, 0).layers).toContain('calendar');
    expect(calendar).toHaveBeenCalledWith(expect.stringContaining('2026-10-21'), expect.any(String));
    expect(bodyOf(call, 1).context.find((b) => b.layer === 'calendar')?.lines).toEqual(['2026-10-21 09:00 Standup']);
  });

  it('stops after the lookup limit instead of looping', async () => {
    const { call, d } = deps([{ ok: true, crisis: false, lookup: { layer: 'memory', query: 'x' } }]);
    expect((await converseTurn(turns, d)).status).toBe('failed');
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('passes on crisis, off and failures', async () => {
    expect((await converseTurn(turns, deps([{ ok: true, crisis: true }]).d)).status).toBe('crisis');
    const off = { ...deps([]).d, call: async () => ({ status: 'off' as const }) };
    expect((await converseTurn(turns, off)).status).toBe('off');
  });
});
