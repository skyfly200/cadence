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

// Undo completion — restore task to its previous status
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Restore to 'today' if it had a scheduled time block, otherwise 'backlog'
  const previousStatus = task.status === 'completed' ? 'today' : task.status;

  const updated = await db.task.update({
    where: { id },
    data: {
      status: previousStatus,
      completedAt: null,
    },
  });
  return NextResponse.json(updated);
}
