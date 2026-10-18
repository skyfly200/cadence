/**
 * One Discuss turn from the browser's side: send the base layer, answer any lookups the AI asks for
 * from data on this device, and return the reply. Framework-free; the sheet passes the real fetch,
 * graph and calendar, tests pass fakes.
 */
import type { AiClientResult } from '../ai-client';
import { baseContext, calendarBlock, calendarWindow, lookupLayer, type CalendarEvent, type GraphData, type LayerOpts } from './context-layers';
import type { ContextBlock, LookupLayer, Remember, Turn } from '../../server/utils/discuss';

type DiscussReply =
  | { ok: true; crisis: false; reply: string; last: boolean; remember?: Remember[] }
  | { ok: true; crisis: false; lookup: { layer: LookupLayer; query: string }; lookups?: number; found?: ContextBlock[] }
  | { ok: true; crisis: true };

export interface ConverseDeps {
  call: (body: unknown) => Promise<AiClientResult<DiscussReply>>;
  data: GraphData;
  opts: LayerOpts;
  /** Reads Google Calendar for a window, or null when it cannot; absent when not connected. */
  calendar?: (timeMin: string, timeMax: string) => Promise<CalendarEvent[] | null>;
  /** Told what is being looked up, so the sheet can say so while it runs. */
  onLookup?: (line: string) => void;
}

export type TurnResult =
  | { status: 'reply'; reply: string; last: boolean; remember: Remember[]; memoryIds: string[]; privateExcluded: number }
  | { status: 'crisis' }
  | Exclude<AiClientResult<never>, { status: 'ok' }>;

/** The AI may look things up at most this many times per turn (the server enforces the same). */
const MAX_LOOKUPS = 2;

/** A short line for the transcript while a lookup runs ("Checking your calendar"). */
export function lookingLine(layer: LookupLayer): string {
  return { memory: 'Checking what I remember', items: 'Looking through your list', history: 'Looking at what you did lately', calendar: 'Checking your calendar' }[layer];
}

export async function converseTurn(turns: readonly Turn[], deps: ConverseDeps): Promise<TurnResult> {
  const last = [...turns].reverse().find((t) => t.role === 'user')?.text ?? '';
  const base = baseContext(deps.data, last, deps.opts);
  const layers: LookupLayer[] = ['memory', 'items', 'history', ...(deps.calendar ? (['calendar'] as const) : [])];
  const extra: ContextBlock[] = [];
  for (let lookups = 0; ;) {
    const r = await deps.call({ messages: turns, context: [...base.blocks, ...extra], layers, lookups });
    if (r.status !== 'ok') return r;
    const d = r.data;
    if (d.crisis) return { status: 'crisis' };
    if ('lookup' in d) {
      if (lookups >= MAX_LOOKUPS) return { status: 'failed', message: 'The AI is not available right now.' };
      const { layer, query } = d.lookup;
      // The server counts its own lookups (GitHub, Gmail) too, and says how many this turn has used.
      lookups = Math.max(lookups + 1, d.lookups ?? 0);
      extra.push(...(d.found ?? []));
      deps.onLookup?.(lookingLine(layer));
      if (layer === 'calendar' && deps.calendar) {
        const w = calendarWindow(query, deps.opts);
        extra.push(calendarBlock(await deps.calendar(w.timeMin, w.timeMax).catch(() => null), w.day, deps.opts.timeZone));
      } else if (layer !== 'calendar') {
        extra.push(lookupLayer(layer, query, deps.data, deps.opts));
      }
      continue;
    }
    return { status: 'reply', reply: d.reply, last: d.last, remember: d.remember ?? [], memoryIds: base.memoryIds, privateExcluded: base.privateExcluded };
  }
}
