import { describe, expect, it } from 'vitest';
import { mapsUrl } from './apps';
import { defaultChoice, nodeFromProposal, type NodeProposal, type PlaceMatch } from './proposals';

const now = new Date('2026-10-02T12:00:00.000Z');
const N = (over: Partial<NodeProposal> = {}): NodeProposal => ({ ref: 'n1', kind: 'habit', title: ' Meditate ', confidence: 0.9, evidence: 'twice a week', ...over });
const clinic: PlaceMatch = { label: 'Oak Street Clinic, 12, Oak Street, Springfield, Missouri', address: 'Oak Street Clinic, 12, Oak Street, Springfield', lat: 37.2, lon: -93.3 };
const other: PlaceMatch = { ...clinic, address: 'Oak Street Clinic, 99, Oak Avenue, Springfield', lat: 38, lon: -92 };

describe('habit cycles', () => {
  it('saves a Habit with the cycle the user settled', () => {
    const node = nodeFromProposal(N({ cycle: { period: 'week', target: 2 } }), now, 'h1', { cycle: { period: 'week', target: 2 } });
    expect(node).toMatchObject({ id: 'h1', kind: 'habit', title: 'Meditate', recurrence: { period: 'week', target: 2 }, quiet: false, private: false });
  });

  it('uses an edited cycle over the proposed one', () => {
    const p = N({ cycle: { period: 'week', target: 2 } });
    expect(nodeFromProposal(p, now, 'h1', { cycle: { period: 'month', target: 1 } })).toMatchObject({ recurrence: { period: 'month', target: 1 } });
  });

  it('guesses nothing: no cycle, or an invalid one, saves an Idea', () => {
    expect(nodeFromProposal(N(), now, 'h1', defaultChoice(N()))?.kind).toBe('idea');
    expect(nodeFromProposal(N(), now, 'h1', { cycle: { period: 'week', target: 0 } })?.kind).toBe('idea');
    expect(nodeFromProposal(N(), now, 'h1', { cycle: { period: 'fortnight' as never, target: 1 } })?.kind).toBe('idea');
  });

  it('starts the card with the proposed cycle', () => {
    expect(defaultChoice(N({ cycle: { period: 'day', target: 1 } })).cycle).toEqual({ period: 'day', target: 1 });
    expect(defaultChoice(N()).cycle).toBeNull();
  });
});

describe('places', () => {
  const P = (over: Partial<NodeProposal> = {}) => N({ kind: 'thing', thingType: 'place', title: 'Oak Street Clinic', matches: [clinic, other], ...over });

  it('saves a place Thing with the address and position of the match the user picked', () => {
    expect(nodeFromProposal(P(), now, 't1', defaultChoice(P()))).toMatchObject({
      kind: 'thing', thingType: 'place', address: clinic.address, lat: 37.2, lon: -93.3,
    });
    expect(nodeFromProposal(P(), now, 't1', { place: other })).toMatchObject({ address: other.address, lat: 38, lon: -92 });
  });

  it('keeps just the name when nothing matched or the match is not usable', () => {
    const bare = nodeFromProposal(P({ matches: [] }), now, 't1', defaultChoice(P({ matches: [] }))) as Record<string, unknown>;
    expect(bare).toMatchObject({ kind: 'thing', thingType: 'place', title: 'Oak Street Clinic' });
    expect(bare.address).toBeUndefined();
    expect(bare.lat).toBeUndefined();
    const bad = nodeFromProposal(P(), now, 't1', { place: { ...clinic, lat: 999 } }) as Record<string, unknown>;
    expect(bad.lat).toBeUndefined();
  });

  it('only gives coordinates to places, not to people or objects', () => {
    const person = nodeFromProposal(P({ thingType: 'person' }), now, 't1', { place: clinic }) as Record<string, unknown>;
    expect(person).toMatchObject({ thingType: 'person' });
    expect(person.lat).toBeUndefined();
    expect(nodeFromProposal(P({ thingType: undefined }), now, 't1', { place: clinic })).toMatchObject({ thingType: 'object' });
  });

  it('stays private when asked to', () => {
    expect(nodeFromProposal(P(), now, 't1', { place: clinic, private: true })).toMatchObject({ private: true });
    expect(nodeFromProposal(N({ kind: 'idea' }), now, 'i1', { private: true })).toMatchObject({ private: true });
  });
});

describe('mapsUrl', () => {
  it('navigates by address when there is one, else by coordinates, else nothing', () => {
    expect(mapsUrl({ address: 'Oak Street Clinic, 12, Oak Street', lat: 1, lon: 2 })).toBe('https://www.google.com/maps/search/?api=1&query=Oak%20Street%20Clinic%2C%2012%2C%20Oak%20Street');
    expect(mapsUrl({ lat: 37.2, lon: -93.3 })).toBe('https://www.google.com/maps/search/?api=1&query=37.2%2C-93.3');
    expect(mapsUrl({ address: '  ' })).toBeNull();
    expect(mapsUrl({})).toBeNull();
  });
});
