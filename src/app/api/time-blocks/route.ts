import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dateKey } from '@/lib/time-utils';
import { parseISO, startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateStr = url.searchParams.get('date') || dateKey(new Date());
  const day = parseISO(dateStr);
  const start = startOfDay(day);
  const end = endOfDay(day);
  const blocks = await db.timeBlock.findMany({
    where: { startTime: { gte: start, lte: end } },
    orderBy: { startTime: 'asc' },
  });
  return NextResponse.json(blocks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    taskId, title, startTime, endTime,
    isAnchor = false, isExternalEvent = false,
    anchorType = null, colorTag = null,
  } = body || {};

  if (!title || !startTime || !endTime) {
    return NextResponse.json({ error: 'title, startTime, endTime required' }, { status: 400 });
  }

  const block = await db.timeBlock.create({
    data: {
      taskId: taskId || null,
      title,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      isAnchor: Boolean(isAnchor),
      isExternalEvent: Boolean(isExternalEvent),
      anchorType,
      colorTag,
    },
  });
  return NextResponse.json(block);
}
