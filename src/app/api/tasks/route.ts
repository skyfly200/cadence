import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tasks = await db.task.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title, notes, status = 'backlog',
    eisenhowerCategory = 'schedule',
    estimatedMinutes = 30, actualMinutes = 0,
    category = 'Admin', rolledOverCount = 0, priority = 2,
  } = body || {};

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  }

  const task = await db.task.create({
    data: {
      title,
      notes: notes ?? null,
      status,
      eisenhowerCategory,
      estimatedMinutes: Number(estimatedMinutes) || 30,
      actualMinutes: Number(actualMinutes) || 0,
      category,
      rolledOverCount: Number(rolledOverCount) || 0,
      priority: Number(priority) || 2,
      sortOrder: Number(body.sortOrder) || 0,
    },
  });
  return NextResponse.json(task);
}
