import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ['taskId', 'title', 'startTime', 'endTime', 'isAnchor', 'isExternalEvent', 'anchorType', 'colorTag']) {
    if (k in body) {
      if (k === 'startTime' || k === 'endTime') {
        data[k] = new Date(body[k]);
      } else {
        data[k] = body[k];
      }
    }
  }
  const block = await db.timeBlock.update({ where: { id }, data });
  return NextResponse.json(block);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.timeBlock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
