/**
 * Turning the AI's proposed Links into something the user can keep (ticket 25). Pure and
 * framework-free. Nothing is written until the user taps: `connectionProposals` picks the
 * few worth showing, `acceptLink` builds the Link that a tap saves, with origin
 * `proposed_accepted` so it is never mistaken for something the user said.
 */
import { PERIODS, type Link, type LinkType, type Node, type Recurrence, type ThingType } from '../domain/types';
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

// ── proposed Nodes (Discuss) ──────────────────────────────────────

/** One proposed Node as POST /api/ai/extract answers it. `ref` is how the proposed Links point at it. */
export interface NodeProposal {
  ref: string;
  kind: Node['kind'];
  title: string;
  confidence: number;
  evidence: string;
  /** Habits: the cycle the text stated, if it stated one. */
  cycle?: Recurrence;
  /** Things: person, place or object. */
  thingType?: ThingType;
  /** Places: what the lookup found, best first (empty when nothing matched). */
  matches?: PlaceMatch[];
}

/** One place the lookup found: a navigable address and a position. */
export interface PlaceMatch { label: string; address: string; lat: number; lon: number }

/** What the user settled in the proposal card before tapping Keep: the habit's cycle, the place they picked. */
export interface KeepChoice {
  cycle?: Recurrence | null;
  place?: PlaceMatch | null;
  /** Save as Private (e.g. text that tripped the crisis check). */
  private?: boolean;
}

/** The card's starting choice: the cycle as proposed, and the best place match. */
export const defaultChoice = (p: NodeProposal): KeepChoice => ({ cycle: p.cycle ?? null, place: p.matches?.[0] ?? null });

const validCycle = (c: Recurrence | null | undefined): c is Recurrence =>
  !!c && PERIODS.includes(c.period) && Number.isInteger(c.target) && c.target >= 1 && c.target <= 31;
const validPlace = (m: PlaceMatch | null | undefined): m is PlaceMatch =>
  !!m && typeof m.address === 'string' && Number.isFinite(m.lat) && Number.isFinite(m.lon) && Math.abs(m.lat) <= 90 && Math.abs(m.lon) <= 180;

/**
 * The Node a tap on "Keep" saves. Nothing about a proposal is trusted beyond its title, kind and the
 * choice the user settled. A Habit needs a cycle, so one without a cycle is saved as an Idea (nothing is
 * guessed); a place Thing carries the address and position the user picked from the lookup, never anything
 * the AI said, and a place with no match keeps just its name.
 */
export function nodeFromProposal(p: NodeProposal, now: Date, id: string, choice: KeepChoice = {}): Node | null {
  const title = p.title.trim();
  if (!title) return null;
  const t = now.toISOString();
  const base = { id, title, private: choice.private === true, createdAt: t, updatedAt: t };
  switch (p.kind) {
    case 'goal': return { ...base, kind: 'goal', finishLine: false, checkpoint: false };
    case 'commitment': return { ...base, kind: 'commitment', slog: false, quiet: false };
    case 'habit':
      return validCycle(choice.cycle)
        ? { ...base, kind: 'habit', recurrence: { period: choice.cycle.period, target: choice.cycle.target }, quiet: false }
        : { ...base, kind: 'idea' };
    case 'thing': {
      const type: ThingType = p.thingType ?? 'object';
      return type === 'place' && validPlace(choice.place)
        ? { ...base, kind: 'thing', thingType: 'place', address: choice.place.address, lat: choice.place.lat, lon: choice.place.lon }
        : { ...base, kind: 'thing', thingType: type };
    }
    default: return { ...base, kind: 'idea' };
  }
}

/**
 * The proposed Links that can be shown once some proposed Nodes are kept: each end is either a Node the
 * user already has or one they just kept (`kept` maps a proposal's ref to the saved id). Ends are rewritten to ids.
 */
export function linksAfterKeeping(proposals: readonly LinkProposal[], kept: ReadonlyMap<string, string>, nodes: readonly Node[], links: readonly Link[]): LinkProposal[] {
  const ids = new Set(nodes.map((n) => n.id));
  const end = (x: string) => kept.get(x) ?? (ids.has(x) ? x : null);
  const out: LinkProposal[] = [];
  for (const p of proposals) {
    const from = end(p.from);
    const to = end(p.to);
    if (from === null || to === null) continue;
    const q = { ...p, from, to };
    if (connectionProposals([q], nodes, links, 1).length) out.push(q);
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}
