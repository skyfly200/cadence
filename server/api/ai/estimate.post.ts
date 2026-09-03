import ZAI from 'z-ai-web-dev-sdk';

const DEFAULT_CATEGORIES = ['Creative', 'Admin', 'Maintenance', 'Health', 'Learning', 'Social'];

/** Keyword heuristic fallback for category, used when the LLM is unavailable. */
function guessCategory(text: string, allowed: string[]): string {
  const lower = text.toLowerCase();
  const has = (name: string) => allowed.some((c) => c.toLowerCase() === name.toLowerCase());
  const pick = (name: string) => allowed.find((c) => c.toLowerCase() === name.toLowerCase())!;
  if (has('Creative') && /design|write|draw|paint|compose|brainstorm|sketch|edit video|music|art/.test(lower)) return pick('Creative');
  if (has('Health') && /workout|run|gym|exercise|walk|meditat|doctor|dentist|therapy|stretch|yoga/.test(lower)) return pick('Health');
  if (has('Learning') && /read|study|learn|course|research|tutorial|practice|review notes/.test(lower)) return pick('Learning');
  if (has('Social') && /call|meet|email|text|lunch|coffee|dinner|visit|party|hang/.test(lower)) return pick('Social');
  if (has('Maintenance') && /clean|laundry|dishes|repair|fix|organize|tidy|errand|grocery|shop|chore/.test(lower)) return pick('Maintenance');
  if (has('Admin')) return pick('Admin');
  return allowed[0] ?? 'Admin';
}

export default defineEventHandler(async (event) => {
  const { title, notes, category, categories } = await readBody(event);

  if (!title) {
    setResponseStatus(event, 400);
    return { error: 'title required' };
  }

  const allowed: string[] = Array.isArray(categories) && categories.length
    ? categories.map(String)
    : DEFAULT_CATEGORIES;
  const fallbackCategory = guessCategory(`${title} ${notes ?? ''}`, allowed);

  try {
    const zai = await ZAI.create();
    const prompt = `You are a task classifier and duration estimator. Given a task, estimate how many minutes of focused work it will take AND pick the single best-fit category.

Task title: ${title}
${notes ? `Notes: ${notes}` : ''}
${category ? `Current category: ${category}` : ''}

Available categories (choose exactly one, verbatim): ${allowed.join(', ')}

Respond ONLY with valid JSON in this exact format (no markdown, no commentary):
{"estimatedMinutes": <number>, "category": "<one of the available categories>", "confidence": <0.0-1.0>, "reasoning": "<short>"}

Guidelines:
- Most tasks are between 15 and 240 minutes.
- Admin tasks like email/replies: 10-30 min.
- Creative tasks like design/writing: 45-180 min.
- Maintenance like chores/errands: 20-90 min.
- Be realistic, not optimistic.
- "category" MUST be one of the available categories, copied exactly.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a precise task classifier and duration estimator that returns only JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return { estimatedMinutes: 30, category: fallbackCategory, confidence: 0.3, reasoning: 'fallback' };
    }
    const parsed = JSON.parse(match[0]);
    // Only accept a category the caller actually offers; otherwise fall back.
    const suggested = typeof parsed.category === 'string'
      ? allowed.find((c) => c.toLowerCase() === parsed.category.toLowerCase())
      : undefined;
    return {
      estimatedMinutes: Math.max(5, Math.round(Number(parsed.estimatedMinutes) || 30)),
      category: suggested ?? fallbackCategory,
      confidence: Number(parsed.confidence) || 0.5,
      reasoning: parsed.reasoning || '',
    };
  } catch (e) {
    console.error('ai/estimate failed', e);
    return { estimatedMinutes: 30, category: fallbackCategory, confidence: 0.3, reasoning: 'fallback' };
  }
});
