/**
 * Turning the AI's proposed Links into something the user can keep (ticket 25). Pure and
 * framework-free. Nothing is written until the user taps: `connectionProposals` picks the
 * few worth showing, `acceptLink` builds the Link that a tap saves, with origin
 * `proposed_accepted` so it is never mistaken for something the user said.
 */
import type { Link, LinkType, Node } from '../domain/types';
import { partOf } from './goal-edit';

/** One proposed Link as POST /api/ai/extract answers it. */
export interface LinkProposal {
  type: LinkType;
  from: string;
  to: string;
  confidence: number;
  evidence: string;
}

/** How many connections one session offers. */
export const CONNECTIONS_MAX = 2;

const exists = (links: readonly Link[], p: LinkProposal) => links.some((l) => l.type === p.type && l.fromId === p.from && l.toId === p.to);

/**
 * The proposals worth showing: both ends are nodes the user has, it is not a self-link, the Link
 * is not already there (or a loop, for part-of), and the surest come first.
 */
export function connectionProposals(proposals: readonly LinkProposal[], nodes: readonly Node[], links: readonly Link[], limit = CONNECTIONS_MAX): LinkProposal[] {
  const ids = new Set(nodes.map((n) => n.id));
  return proposals
    .filter((p) => p.from !== p.to && ids.has(p.from) && ids.has(p.to) && !exists(links, p))
    .filter((p) => p.type !== 'part_of' || partOf(links, p.from, p.to, new Date(0), 'probe') !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/** The Link a tap on "Connect" saves, or null if it would repeat one or loop. */
export function acceptLink(p: LinkProposal, links: readonly Link[], now: Date, id: string): Link | null {
  if (p.from === p.to || exists(links, p)) return null;
  const stamp = now.toISOString();
  if (p.type === 'part_of' && partOf(links, p.from, p.to, now, id) === null) return null;
  return {
    id, type: p.type, fromId: p.from, toId: p.to,
    origin: 'proposed_accepted', confidence: p.confidence, evidence: [p.evidence],
    createdAt: stamp, updatedAt: stamp,
  };
}
