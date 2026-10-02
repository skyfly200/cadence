import { describe, expect, it } from 'vitest';
import { commitment, goal, link } from '../domain/test-helpers';
import { CONNECTIONS_MAX, acceptLink, connectionProposals, type LinkProposal } from './proposals';

const NOW = new Date('2026-10-02T12:00:00.000Z');
const P = (over: Partial<LinkProposal> = {}): LinkProposal => ({ type: 'part_of', from: 'a', to: 'g', confidence: 0.8, evidence: 'the garage wall', ...over });
const nodes = [commitment('a'), commitment('b'), commitment('c'), goal('g'), goal('g2')];

describe('connectionProposals', () => {
  it('keeps only links between nodes the user has, best first, a couple at a time', () => {
    const out = connectionProposals([
      P({ from: 'a', confidence: 0.7 }), P({ from: 'b', confidence: 0.9 }), P({ from: 'c', confidence: 0.8 }),
      P({ from: 'ghost' }), P({ to: 'ghost' }),
    ], nodes, []);
    expect(out.map((p) => p.from)).toEqual(['b', 'c']);
    expect(out).toHaveLength(CONNECTIONS_MAX);
  });

  it('skips a link that is already there, a self-link, and a part-of loop', () => {
    const links = [link('part_of', 'a', 'g'), link('part_of', 'g', 'g2')];
    expect(connectionProposals([P()], nodes, links)).toEqual([]);
    expect(connectionProposals([P({ from: 'a', to: 'a' })], nodes, [])).toEqual([]);
    expect(connectionProposals([P({ from: 'g2', to: 'g' })], nodes, links)).toEqual([]); // g is already part of g2, so g2 part of g would loop
  });
});

describe('acceptLink', () => {
  it('builds a proposed_accepted Link that keeps the confidence and the evidence', () => {
    expect(acceptLink(P(), [], NOW, 'L1')).toEqual({
      id: 'L1', type: 'part_of', fromId: 'a', toId: 'g', origin: 'proposed_accepted', confidence: 0.8,
      evidence: ['the garage wall'], createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    });
  });

  it('refuses a repeat, a self-link and a loop', () => {
    expect(acceptLink(P(), [link('part_of', 'a', 'g')], NOW, 'L1')).toBeNull();
    expect(acceptLink(P({ to: 'a' }), [], NOW, 'L1')).toBeNull();
    expect(acceptLink(P({ from: 'g2', to: 'g' }), [link('part_of', 'g', 'g2')], NOW, 'L1')).toBeNull();
  });

  it('accepts the other link types as they are', () => {
    expect(acceptLink(P({ type: 'requires', from: 'a', to: 'b' }), [], NOW, 'L2')).toMatchObject({ type: 'requires', fromId: 'a', toId: 'b', origin: 'proposed_accepted' });
  });
});
