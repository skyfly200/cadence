import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dateKey } from '@/lib/time-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || dateKey(new Date());
  const logs = await db.gamificationLog.findMany({ where: { date }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const { date, type, points, note } = await req.json();
  if (!date || !type || points === undefined) {
    return NextResponse.json({ error: 'date, type, points required' }, { status: 400 });
  }
  const log = await db.gamificationLog.create({
    data: { date, type, points: Number(points), note: note ?? null },
  });
  return NextResponse.json(log);
}
