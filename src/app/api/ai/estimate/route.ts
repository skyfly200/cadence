import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { title, notes, category } = await req.json();

  if (!title) {
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  }

  try {
    const zai = await ZAI.create();
    const prompt = `You are a task duration estimator. Given a task, estimate how many minutes of focused work it will take.

Task title: ${title}
${notes ? `Notes: ${notes}` : ''}
${category ? `Category: ${category}` : ''}

Respond ONLY with valid JSON in this exact format (no markdown, no commentary):
{"estimatedMinutes": <number>, "confidence": <0.0-1.0>, "reasoning": "<short>"}

Guidelines:
- Most tasks are between 15 and 240 minutes.
- "Admin" tasks like email/replies: 10-30 min.
- "Creative" tasks like design/writing: 45-180 min.
- "Maintenance" like chores/errands: 20-90 min.
- Be realistic, not optimistic.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a precise task-duration estimator that returns only JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices?.[0]?.message?.content ?? '';
    // Extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ estimatedMinutes: 30, confidence: 0.3, reasoning: 'fallback' });
    }
    const parsed = JSON.parse(match[0]);
    return NextResponse.json({
      estimatedMinutes: Math.max(5, Math.round(Number(parsed.estimatedMinutes) || 30)),
      confidence: Number(parsed.confidence) || 0.5,
      reasoning: parsed.reasoning || '',
    });
  } catch (e) {
    console.error('ai/estimate failed', e);
    return NextResponse.json({ estimatedMinutes: 30, confidence: 0.3, reasoning: 'fallback' });
  }
}
