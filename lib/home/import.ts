/**
 * The Google Tasks import was dropped: it filled the Heap with old, no-longer-relevant tasks. What is left is
 * finding the Ideas it already added, so they can be cleared in one tap. Pure and framework-free.
 */
import type { Node } from '../domain/types';

export const GOOGLE_TASKS = 'google-tasks';

/** The ids of Ideas the old Tasks import added (still untouched by planning: once planned they are Commitments and stay). */
export function importedTaskIds(nodes: readonly Node[]): Set<string> {
  return new Set(nodes.filter((n) => n.kind === 'idea' && n.external?.system === GOOGLE_TASKS).map((n) => n.id));
}
