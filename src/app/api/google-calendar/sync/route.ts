import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, fetchCalendarEvents, upsertGoogleCredentials, getGoogleCredentials, GOOGLE_COLOR_MAP } from '@/lib/google-calendar';
import { db } from '@/lib/db';

/**
 * POST /api/google-calendar/sync
 * Syncs Google Calendar events into TimeBlocks as external events.
 * Returns the list of synced events.
 */
export async function POST(req: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not connected to Google Calendar' }, { status: 401 });
    }

    // Default: sync today. Accept optional date parameter.
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const syncDate = dateStr ?? new Date().toISOString().split('T')[0];

    const startOfDay = new Date(`${syncDate}T00:00:00`);
    const endOfDay = new Date(`${syncDate}T23:59:59`);

    const events = await fetchCalendarEvents(
      accessToken,
      startOfDay.toISOString(),
      endOfDay.toISOString(),
    );

    // Delete previous external time blocks for this date
    const startISO = startOfDay.toISOString();
    const endISO = endOfDay.toISOString();
    await db.timeBlock.deleteMany({
      where: {
        isExternalEvent: true,
        startTime: { gte: startISO },
        endTime: { lte: endISO },
      },
    });

    // Insert new external time blocks
    const synced: Array<{ id: string; title: string; start: string; end: string }> = [];
    for (const event of events) {
      // Skip all-day events stored as date (no dateTime)
      if (!event.start.dateTime || !event.end.dateTime) continue;

      const title = event.summary || '(No title)';
      const startTime = new Date(event.start.dateTime);
      const endTime = new Date(event.end.dateTime);

      // Only create blocks that are within the day range
      if (startTime < startOfDay || endTime > endOfDay) continue;

      const colorTag = event.colorId
        ? GOOGLE_COLOR_MAP[event.colorId] ?? 'external'
        : 'external';

      const block = await db.timeBlock.create({
        data: {
          title,
          startTime,
          endTime,
          isExternalEvent: true,
          isAnchor: false,
          colorTag,
        },
      });

      synced.push({
        id: block.id,
        title,
        start: block.startTime.toISOString(),
        end: block.endTime.toISOString(),
      });
    }

    // Update lastSyncAt
    const creds = await getGoogleCredentials();
    if (creds) {
      await upsertGoogleCredentials({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        tokenExpiresAt: creds.tokenExpiresAt,
        calendarEmail: creds.calendarEmail,
        connected: creds.connected,
        lastSyncAt: new Date(),
      });
    }

    return NextResponse.json({ synced, total: events.length, filtered: events.length - synced.length });
  } catch (e) {
    console.error('Calendar sync error:', e);
    return NextResponse.json({ error: 'Sync failed', details: String(e) }, { status: 500 });
  }
}
