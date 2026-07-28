import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST { orderedIds: string[] } — assigns sortOrder 0,1,2,... to each id
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderedIds } = body;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'orderedIds array required' }, { status: 400 });
  }

  await db.$transaction(
    orderedIds.map((id: string, index: number) =>
      db.task.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
