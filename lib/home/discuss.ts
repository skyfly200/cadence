/**
 * Small pure helpers for Discuss (ticket 25), the short conversation on the capture sheet.
 * Framework-free. The transcript lives in memory only and is thrown away when the conversation ends.
 */
import type { Turn } from '../../server/utils/discuss';

/** How many things a person can say in one conversation (the server enforces the same cap). */
export const MAX_TURNS = 6;
const MAX_SUMMARY_TEXT = 4000;

/** What the person said, joined for the summary call; the end is kept if it is too long. */
export function userText(turns: readonly Turn[]): string {
  const all = turns.filter((t) => t.role === 'user').map((t) => t.text.trim()).filter(Boolean).join('\n');
  return all.length > MAX_SUMMARY_TEXT ? all.slice(all.length - MAX_SUMMARY_TEXT) : all;
}

/** How many times the person has spoken. */
export const spoken = (turns: readonly Turn[]) => turns.filter((t) => t.role === 'user').length;

/** "Here's what I heard: 3 things", or a calm line when there is nothing to file. */
export function heardLine(n: number): string {
  if (n <= 0) return "Here's what I heard: nothing to file just yet.";
  return `Here's what I heard: ${n} ${n === 1 ? 'thing' : 'things'}.`;
}

/** The quiet line about items left out of the AI's view, or null when none were. */
export function privateLine(n: number): string | null {
  return n > 0 ? `${n} private ${n === 1 ? 'item' : 'items'} not included` : null;
}
