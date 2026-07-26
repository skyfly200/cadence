import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const actualMinutes = Number(body?.actualMinutes) || 0;

  const task = await db.task.update({
    where: { id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      ...(actualMinutes ? { actualMinutes } : {}),
    },
  });
  return NextResponse.json(task);
}
