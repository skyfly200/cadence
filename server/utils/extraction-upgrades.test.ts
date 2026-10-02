import { describe, expect, it, vi } from 'vitest';
import { createMemoryAiStore, type AiProvider } from './ai';
import { handleExtract, validateProposals, type ContextNode, type ExtractionStore } from './extraction';
import type { PlaceResolver } from './places';

const T0 = Date.UTC(2026, 9, 2, 12, 0, 0);
const store: ExtractionStore = { load: vi.fn(async (): Promise<ContextNode[]> => []) };
const provider = (reply: string) => ({ complete: vi.fn(async () => reply) }) satisfies AiProvider;
const TEXT = 'Meditate for ten minutes twice a week. Dentist at Oak Street Clinic on Friday.';
const run = (reply: string, places?: PlaceResolver) =>
  handleExtract({ ai: { provider: provider(reply), store: createMemoryAiStore(), now: () => T0 }, store, places }, { userId: 'u1', body: { text: TEXT } });

const node = (extra: Record<string, unknown>) => ({ ref: 'n1', kind: 'habit', title: 'Meditate', confidence: 0.9, evidence: 'twice a week', ...extra });
const known: ContextNode[] = [];

describe('habit cycles', () => {
  it('reads the cycle the text states', () => {
    const r = validateProposals(JSON.stringify({ nodes: [node({ cycle: { period: 'week', target: 2 } })] }), TEXT.toLowerCase(), known);
    expect(r.nodes[0]!.cycle).toEqual({ period: 'week', target: 2 });
  });

  it('guesses nothing: no cycle stays absent, and a malformed one is dropped while the habit is kept', () => {
    const none = validateProposals(JSON.stringify({ nodes: [node({})] }), TEXT.toLowerCase(), known);
    expect(none.nodes[0]!.cycle).toBeUndefined();
    for (const cycle of [{ period: 'fortnight', target: 2 }, { period: 'week', target: 0 }, { period: 'week', target: 2.5 }, { period: 'week', target: 99 }, 'weekly']) {
      const r = validateProposals(JSON.stringify({ nodes: [node({ cycle })] }), TEXT.toLowerCase(), known);
      expect(r.nodes).toHaveLength(1);
      expect(r.nodes[0]!.cycle).toBeUndefined();
    }
  });
});

describe('places', () => {
  const placeNode = { ref: 'p1', kind: 'thing', thingType: 'place', title: 'Oak Street Clinic', confidence: 0.9, evidence: 'Oak Street Clinic' };
  const match = { label: 'Oak Street Clinic, 12, Oak Street, Springfield, Missouri', address: 'Oak Street Clinic, 12, Oak Street, Springfield', lat: 37.2, lon: -93.3 };

  it('attaches lookup matches to a proposed place, resolved from the name only', async () => {
    const places: PlaceResolver = { resolve: vi.fn(async () => [match]) };
    const r = await run(JSON.stringify({ nodes: [placeNode] }), places);
    expect(r.status).toBe(200);
    if (r.status !== 200) throw new Error('unreachable');
    expect(r.body.nodes[0]!.matches).toEqual([match]);
    expect(places.resolve).toHaveBeenCalledWith('Oak Street Clinic');
  });

  it('never takes coordinates or an address from the AI', async () => {
    const places: PlaceResolver = { resolve: vi.fn(async () => []) };
    const r = await run(JSON.stringify({ nodes: [{ ...placeNode, lat: 1, lon: 2, address: 'Invented Rd' }] }), places);
    if (r.status !== 200) throw new Error('unreachable');
    const n = r.body.nodes[0]! as unknown as Record<string, unknown>;
    expect(n.lat).toBeUndefined();
    expect(n.address).toBeUndefined();
    expect(n.matches).toEqual([]);
  });

  it('only looks up places: people, objects and other kinds are left alone', async () => {
    const places: PlaceResolver = { resolve: vi.fn(async () => [match]) };
    const nodes = [
      { ...placeNode, ref: 'a', thingType: 'person', title: 'Oak Street Clinic' },
      { ...placeNode, ref: 'b', thingType: 'object' },
      { ...placeNode, ref: 'c', kind: 'commitment', thingType: undefined },
    ];
    const r = await run(JSON.stringify({ nodes }), places);
    if (r.status !== 200) throw new Error('unreachable');
    expect(places.resolve).not.toHaveBeenCalled();
    expect(r.body.nodes.every((n) => n.matches === undefined)).toBe(true);
  });

  it('keeps just the name when the lookup fails or no resolver is wired', async () => {
    const failing: PlaceResolver = { resolve: vi.fn(async () => { throw new Error('down'); }) };
    const a = await run(JSON.stringify({ nodes: [placeNode] }), failing);
    if (a.status !== 200) throw new Error('unreachable');
    expect(a.body.nodes[0]!.matches).toEqual([]);
    const b = await run(JSON.stringify({ nodes: [placeNode] }));
    if (b.status !== 200) throw new Error('unreachable');
    expect(b.body.nodes[0]!.matches).toBeUndefined();
  });

  it('does not look anything up when AI is off', async () => {
    const places: PlaceResolver = { resolve: vi.fn(async () => [match]) };
    const r = await handleExtract({ ai: { provider: provider('{}'), store: createMemoryAiStore({ aiOn: false }), now: () => T0 }, store, places }, { userId: 'u1', body: { text: TEXT } });
    expect(r.status).toBe(403);
    expect(places.resolve).not.toHaveBeenCalled();
  });
});
