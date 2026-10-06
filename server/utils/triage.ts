/**
 * Heap triage by a System 1 decision engine speaking the Jev `/v1/systemone` wire protocol: TypeSafe's hosted
 * Jev API, or a self-hosted Laya (`laya-serve`, same protocol). It answers typed questions about one item in a
 * single forward pass: here, which of the user's tags fits and how big the item is. Framework-free (no Nitro
 * globals) with `fetch` injectable, so it is unit tested with a fake server.
 *
 * The item title is data sent as the `state`; the questions are ours. Callers hand it only items already past
 * the Private filter. A request that fails leaves that item out; it never throws for one bad answer.
 */

/** Rough minutes for each size bucket (the engine picks a bucket; a time in minutes is not its job). */
export const SIZE_MINUTES = { quick: 10, short: 30, medium: 90, long: 240 } as const;
type Size = keyof typeof SIZE_MINUTES;

/** Below this probability on the chosen option, the answer is ignored. */
export const MIN_CONFIDENCE = 0.5;
const NONE = 'none of these';
const MAX_ITEMS = 30;

export interface TriageItem { id: string; title: string }
export interface TriageAnswer { category: string | null; minutes: number | null }
export interface Triage {
  classify(items: readonly TriageItem[], tags: readonly string[]): Promise<Map<string, TriageAnswer>>;
}

/** The questions asked about each item. The tag question is left out when the user has no tags. */
export function buildQuestions(tags: readonly string[]) {
  const usable = tags.filter((t) => t.toLowerCase() !== NONE);
  return {
    ...(usable.length ? {
      tag: {
        type: 'choice', instructions: 'Which tag fits this to-do best?',
        criteria: { ...Object.fromEntries(usable.map((t) => [t, `to-dos about or for ${t}`])), [NONE]: 'none of the tags fit' },
      },
    } : {}),
    size: {
      type: 'choice', instructions: 'How much work is this to-do?',
      criteria: { quick: 'a few minutes, under 15', short: 'about 15 to 45 minutes', medium: 'about one to two hours', long: 'half a day or more' },
    },
  };
}

interface Answer { choice?: unknown; answer_confidence?: unknown; probabilities?: Record<string, unknown> }

const confident = (a: Answer | undefined): string | null => {
  if (!a || typeof a.choice !== 'string') return null;
  const p = typeof a.answer_confidence === 'number' ? a.answer_confidence : typeof a.probabilities?.[a.choice] === 'number' ? (a.probabilities[a.choice] as number) : 1;
  return p >= MIN_CONFIDENCE ? a.choice : null;
};

/** What a `/v1/systemone` answer means for one item. Anything not clearly one of our options is ignored. */
export function parseAnswers(body: unknown, tags: readonly string[]): TriageAnswer {
  const answers = (body as { answers?: Record<string, Answer> } | null)?.answers ?? {};
  const tag = confident(answers.tag);
  const size = confident(answers.size);
  return {
    category: tag ? tags.find((t) => t === tag) ?? null : null,
    minutes: size && Object.hasOwn(SIZE_MINUTES, size) ? SIZE_MINUTES[size as Size] : null,
  };
}

export interface TriageOptions { baseUrl: string; apiKey?: string; fetch?: typeof fetch; concurrency?: number; timeoutMs?: number }

/** The Jev wire-protocol client, hosted or self-hosted. */
export function createSystemOneTriage(opts: TriageOptions): Triage {
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/v1/systemone`;
  const f = opts.fetch ?? fetch;
  const one = async (title: string, tags: readonly string[]): Promise<TriageAnswer | null> => {
    try {
      const res = await f(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}) },
        body: JSON.stringify({ state: title, questions: buildQuestions(tags) }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      });
      return res.ok ? parseAnswers(await res.json(), tags) : null;
    } catch { return null; }
  };
  return {
    async classify(items, tags) {
      const out = new Map<string, TriageAnswer>();
      const queue = items.slice(0, MAX_ITEMS);
      const worker = async () => {
        for (let it = queue.shift(); it; it = queue.shift()) {
          const a = await one(it.title, tags);
          if (a) out.set(it.id, a);
        }
      };
      await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, queue.length) }, worker));
      return out;
    },
  };
}

/** The triage client from TRIAGE_BASE_URL and TRIAGE_API_KEY, or null when not set. */
export function triageFromEnv(env: Record<string, string | undefined>, fetchImpl?: typeof fetch): Triage | null {
  const baseUrl = env.TRIAGE_BASE_URL?.trim();
  return baseUrl ? createSystemOneTriage({ baseUrl, apiKey: env.TRIAGE_API_KEY || undefined, fetch: fetchImpl }) : null;
}
