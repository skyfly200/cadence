import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { taskId, type = 'pomodoro' } = await req.json();
  const session = await db.timeLogSession.create({
    data: { taskId, type, startTime: new Date(), elapsedSeconds: 0, interrupted: false },
  });
  return NextResponse.json(session);
}
