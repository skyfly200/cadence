import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { taskId, elapsedSeconds, interrupted = false } = await req.json();
  // find the latest open session for this task
  const session = await db.timeLogSession.findFirst({
    where: { taskId, endTime: null },
    orderBy: { startTime: 'desc' },
  });
  if (!session) {
    return NextResponse.json({ ok: false, reason: 'no active session' });
  }
  const updated = await db.timeLogSession.update({
    where: { id: session.id },
    data: {
      endTime: new Date(),
      elapsedSeconds: Number(elapsedSeconds) || 0,
      interrupted: Boolean(interrupted),
    },
  });
  return NextResponse.json(updated);
}
