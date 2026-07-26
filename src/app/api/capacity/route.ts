import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dateKey } from '@/lib/time-utils';
import { getMaxFocusForScore } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || dateKey(new Date());
  let cap = await db.dailyCapacity.findUnique({ where: { date } });
  if (!cap) {
    // seed default
    cap = await db.dailyCapacity.create({
      data: {
        date,
        maxAllowedFocusMinutes: 270,
        scheduledFocusMinutes: 0,
        triageCompleted: false,
        triageStreak: 0,
      },
    });
  }
  return NextResponse.json(cap);
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || dateKey(new Date());
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ['readinessScore', 'sleepHours', 'manualEnergyRating', 'maxAllowedFocusMinutes', 'scheduledFocusMinutes', 'triageCompleted', 'triageStreak']) {
    if (k in body) data[k] = body[k];
  }
  // Auto-compute maxAllowedFocusMinutes from readinessScore if readiness is being set
  if ('readinessScore' in body) {
    data.maxAllowedFocusMinutes = getMaxFocusForScore(body.readinessScore);
  } else if ('manualEnergyRating' in body && !('readinessScore' in body)) {
    // map 1-10 energy to a 0-100 readiness proxy
    const energy = Number(body.manualEnergyRating);
    const proxy = Math.round(energy * 10);
    data.maxAllowedFocusMinutes = getMaxFocusForScore(proxy);
  }

  const cap = await db.dailyCapacity.upsert({
    where: { date },
    update: data,
    create: {
      date,
      maxAllowedFocusMinutes: 270,
      scheduledFocusMinutes: 0,
      triageCompleted: false,
      triageStreak: 0,
      ...data,
    },
  });
  return NextResponse.json(cap);
}
