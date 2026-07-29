import ZAI from 'z-ai-web-dev-sdk';

interface ParsedTask {
  title: string;
  notes: string | null;
  estimatedMinutes: number;
  category: 'Creative' | 'Admin' | 'Maintenance' | 'Health' | 'Learning' | 'Social';
  eisenhowerCategory: 'do_first' | 'schedule' | 'delegate' | 'eliminate';
  priority: 1 | 2 | 3 | 4 | 5;
}

// Fallback: basic line-based parsing when the LLM is unavailable.
function fallbackParse(text: string): ParsedTask[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const result: ParsedTask[] = [];

  for (const line of lines) {
    const cleaned = line
      .replace(/^[-*•]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^[\s]*\[[ xX]\]\s+/, '')
      .replace(/^[☑☒✓✗✔✘]\s+/, '')
      .replace(/^[-*•]\s+\[[ xX]\]\s+/, '')
      .replace(/^\d+[.)]\s+\[[ xX]\]\s+/, '')
      .trim();

    if (cleaned.length === 0) continue;

    const isCompleted =
      (cleaned.startsWith('~~') && cleaned.endsWith('~~')) ||
      /^\[[xX]\]/i.test(line) ||
      /^[☑☒✓✗✔✘]/.test(line);

    const title = isCompleted ? cleaned.replace(/^~~|~~$/g, '').trim() : cleaned;

    let taskTitle = title;
    let notes: string | null = null;

    const dueDateMatch = taskTitle.match(/(?:due[:\s]*|by[:\s]*|before[:\s]*)([^\n,;]+)/i);
    const contextMatch = taskTitle.match(/(?:@|#)\w+/g);

    if (dueDateMatch || contextMatch) {
      const parts: string[] = [];
      if (dueDateMatch) parts.push(`Due: ${dueDateMatch[1].trim()}`);
      if (contextMatch) parts.push(`Context: ${contextMatch.join(', ')}`);
      notes = parts.join(' | ');
      taskTitle = taskTitle
        .replace(/(?:due[:\s]*|by[:\s]*|before[:\s]*)[^\n,;]+/i, '')
        .replace(/(?:@|#)\w+/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    let category: ParsedTask['category'] = 'Admin';
    const lower = taskTitle.toLowerCase();
    if (/cook|gym|run|walk|doctor|dentist|meditat|yoga|sleep|stretch|workout/i.test(lower)) category = 'Health';
    else if (/design|draw|paint|write|blog|edit|video|photo|music|creat/i.test(lower)) category = 'Creative';
    else if (/clean|laundry|grocer|fix|repair|mow|vacuum|dish/i.test(lower)) category = 'Maintenance';
    else if (/read|learn|study|course|book|tutorial|practic/i.test(lower)) category = 'Learning';
    else if (/call|meet|email|text|lunch|coffee|dinner|visit|party|hang/i.test(lower)) category = 'Social';

    let eisenhowerCategory: ParsedTask['eisenhowerCategory'] = 'schedule';
    if (/urgent|asap|emergency|immediate/i.test(lower)) eisenhowerCategory = 'do_first';
    else if (/maybe|someday|optional|nice\s*to\s*have|whenever/i.test(lower)) eisenhowerCategory = 'eliminate';
    else if (/call|email|text someone|delegate|ask|assign/i.test(lower)) eisenhowerCategory = 'delegate';

    let estimatedMinutes = 30;
    if (/quick|fast|brief|short/i.test(lower)) estimatedMinutes = 10;
    else if (/long|deep|comprehensive|research|full|thorough/i.test(lower)) estimatedMinutes = 120;
    else if (category === 'Creative') estimatedMinutes = 60;
    else if (category === 'Health') estimatedMinutes = 45;
    else if (category === 'Admin') estimatedMinutes = 15;

    let priority: 1 | 2 | 3 | 4 | 5 = 3;
    if (/urgent|critical|important|must|asap|!{1,}$/i.test(lower)) priority = 1;
    else if (/soon|today|tonight/i.test(lower)) priority = 2;
    else if (/maybe|someday|eventually|whenever/i.test(lower)) priority = 5;

    result.push({
      title: taskTitle,
      notes: notes || (isCompleted ? 'Already completed' : null),
      estimatedMinutes,
      category,
      eisenhowerCategory,
      priority,
    });
  }

  return result;
}

export default defineEventHandler(async (event) => {
  let body: { text?: string; defaultStatus?: string };
  try {
    body = await readBody(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: 'Invalid JSON body' };
  }

  const { text, defaultStatus } = body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    setResponseStatus(event, 400);
    return { error: 'text is required and must be a non-empty string' };
  }

  const inputText = text.length > 20_000 ? text.slice(0, 20_000) + '\n\n[... truncated ...]' : text;

  const lines = inputText.split(/\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    return fallbackParse(inputText);
  }

  try {
    const zai = await ZAI.create();

    const systemPrompt = `You are an expert task-parser assistant. Your job is to take unstructured or semi-structured text (e.g., notes from a notes app, email, or random brain-dump) and convert every actionable item into a clean, structured task object.

Rules:
1. Parse EVERY actionable line into a task. Do NOT skip items.
2. Strip formatting markers: bullets (-, *, •), numbers (1., 2.), markdown checkboxes ([x], [ ]), unicode checkboxes (☑, ☐, ☒), and strikethrough (~~).
3. For items that are already marked as done/completed, still include them but set priority to 5 (lowest) and eisenhowerCategory to "eliminate".
4. If a line has sub-items or nested details (indented lines), attach those as the "notes" field of the parent task.
5. Extract due dates, deadlines, or context tags and put them in "notes". Keep them out of the "title".
6. Estimate "estimatedMinutes" realistically: most tasks are 10-120 minutes. Admin tasks are shorter; creative/learning tasks are longer.
7. Assign "category" based on the nature of the task: Creative (design, writing, art), Admin (email, paperwork, scheduling), Maintenance (chores, errands, fixes), Health (exercise, doctor, sleep), Learning (study, courses, reading), Social (calls, meetings, hangouts).
8. Assign "eisenhowerCategory": do_first (urgent+important), schedule (important+not urgent), delegate (urgent+not important), eliminate (not urgent+not important). Default to "schedule" when unclear.
9. Assign "priority" 1-5 where 1 = highest urgency/importance and 5 = lowest. Default to 3.
10. Ignore lines that are pure headers, dividers (---), or empty. Do NOT create tasks for non-actionable lines like "TODO List" or "Meeting Notes".

Respond ONLY with a valid JSON array. No markdown fences, no commentary, no extra text.

Each element must match this exact TypeScript interface:
{
  "title": string,
  "notes": string | null,
  "estimatedMinutes": number,
  "category": "Creative" | "Admin" | "Maintenance" | "Health" | "Learning" | "Social",
  "eisenhowerCategory": "do_first" | "schedule" | "delegate" | "eliminate",
  "priority": 1 | 2 | 3 | 4 | 5
}`;

    const userPrompt = `${defaultStatus === 'backlog' || defaultStatus === 'incubator'
      ? `The default status for all tasks should be considered "${defaultStatus}".\n\n`
      : ''
    }Parse the following text into structured tasks:\n\n${inputText}`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices?.[0]?.message?.content ?? '';
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed: unknown = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        const categories = ['Creative', 'Admin', 'Maintenance', 'Health', 'Learning', 'Social'] as const;
        const eisenhowerCategories = ['do_first', 'schedule', 'delegate', 'eliminate'] as const;
        const validPriorities = [1, 2, 3, 4, 5] as const;

        const sanitized: ParsedTask[] = parsed.map((item: Record<string, unknown>) => ({
          title: String(item.title ?? '').slice(0, 200) || 'Untitled task',
          notes: item.notes ? String(item.notes).slice(0, 1000) : null,
          estimatedMinutes: Math.max(1, Math.min(1440, Math.round(Number(item.estimatedMinutes) || 30))),
          category: categories.includes(item.category as (typeof categories)[number])
            ? (item.category as (typeof categories)[number]) : 'Admin',
          eisenhowerCategory: eisenhowerCategories.includes(item.eisenhowerCategory as (typeof eisenhowerCategories)[number])
            ? (item.eisenhowerCategory as (typeof eisenhowerCategories)[number]) : 'schedule',
          priority: validPriorities.includes(item.priority as (typeof validPriorities)[number])
            ? (item.priority as (typeof validPriorities)[number]) : 3,
        }));

        return sanitized;
      }
    }

    console.error('parse-todos: LLM response had no valid JSON array. Falling back.');
    return fallbackParse(inputText);
  } catch (error) {
    console.error('parse-todos: LLM call failed, using fallback parser.', error);
    return fallbackParse(inputText);
  }
});
