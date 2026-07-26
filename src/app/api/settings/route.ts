import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await db.settings.findUnique({ where: { id: 'singleton' } });
  if (!s) {
    const created = await db.settings.create({ data: { id: 'singleton' } });
    return NextResponse.json(created);
  }
  return NextResponse.json(s);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const allowed = ['wakeTime', 'sleepTime', 'breakfastTime', 'lunchTime', 'dinnerTime', 'hydrationInterval', 'defaultPomodoroMinutes', 'defaultBreakMinutes'];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  const s = await db.settings.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });
  return NextResponse.json(s);
}
