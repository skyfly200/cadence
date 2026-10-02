/**
 * Turning imported Google Tasks into Ideas (the Google import, read-only and user-triggered). Pure and
 * framework-free. Tasks become Ideas, never Commitments: nothing is scheduled on the user's behalf, and
 * "Do this today" in the Parking lot promotes one when they want it. Each Idea remembers which task it came
 * from (`external`), so importing again skips what is already there, even if the Idea was since edited.
 */
import type { Idea, Node } from '../domain/types';

export const GOOGLE_TASKS = 'google-tasks';

/** One task as GET /api/google/tasks answers it. */
export interface ImportedTask { id: string; title: string; notes: string | null; due: string | null }

/** "Due Mon, Oct 5" from a date-only Google due value. */
function dueNote(due: string | null): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  // Google sends midnight UTC for a date-only due; read it as that calendar day.
  return `Due ${d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
}

export interface TaskImport { ideas: Idea[]; imported: number; skipped: number }

/** The Ideas to add for these tasks, leaving out any already imported (by task id) and repeats within the batch. */
export function ideasFromTasks(tasks: readonly ImportedTask[], nodes: readonly Node[], now: Date, newId: () => string): TaskImport {
  const have = new Set(nodes.flatMap((n) => (n.kind === 'idea' && n.external?.system === GOOGLE_TASKS ? [n.external.id] : [])));
  const stamp = now.toISOString();
  const ideas: Idea[] = [];
  let skipped = 0;
  for (const t of tasks) {
    const title = t.title.replace(/\s+/g, ' ').trim();
    if (!title || !t.id) continue;
    if (have.has(t.id)) { skipped++; continue; }
    have.add(t.id);
    const notes = [t.notes?.trim(), dueNote(t.due)].filter(Boolean).join('\n');
    ideas.push({
      id: newId(), kind: 'idea', title, notes: notes || null, private: false, createdAt: stamp, updatedAt: stamp,
      external: { system: GOOGLE_TASKS, id: t.id },
    });
  }
  return { ideas, imported: ideas.length, skipped };
}

/** The line shown after an import: plain, and never about what was left. */
export function importLine(r: Pick<TaskImport, 'imported' | 'skipped'>): string {
  if (r.imported === 0) return r.skipped > 0 ? 'Everything is already here.' : 'No open tasks to import.';
  const added = `Imported ${r.imported} ${r.imported === 1 ? 'task' : 'tasks'} as ideas.`;
  return r.skipped > 0 ? `${added} ${r.skipped} already here.` : added;
}
