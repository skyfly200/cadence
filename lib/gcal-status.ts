/**
 * Pure helpers for the locally cached Google Calendar status. Kept free of
 * browser APIs so they can be unit tested.
 *
 * Google tokens live only on the server. Older versions stored them in
 * localStorage; these helpers strip any such secrets from a stored row and
 * from backup exports/imports.
 */

export interface GoogleCalendarCache {
  connected: boolean;
  calendarEmail?: string | null;
  lastSyncAt?: string | null;
  autoSync?: boolean;
}

export const DEFAULT_GCAL: GoogleCalendarCache = {
  connected: false,
  calendarEmail: null,
  lastSyncAt: null,
  autoSync: true,
};

const SECRET_KEYS = ['accessToken', 'refreshToken', 'tokenExpiresAt'] as const;

/**
 * Return the row without any token fields. If the row held tokens (a legacy
 * connection), it is also reset to "not connected": the server has no tokens
 * for it, so the user reconnects once.
 */
export function sanitizeGoogleCalendar(raw: unknown): { row: GoogleCalendarCache; hadTokens: boolean } {
  if (!raw || typeof raw !== 'object') return { row: { ...DEFAULT_GCAL }, hadTokens: false };
  const src = raw as Record<string, unknown>;
  const hadTokens = SECRET_KEYS.some((k) => src[k] != null);
  const row: GoogleCalendarCache = {
    connected: hadTokens ? false : src.connected === true,
    calendarEmail: hadTokens ? null : ((src.calendarEmail as string | null | undefined) ?? null),
    lastSyncAt: hadTokens ? null : ((src.lastSyncAt as string | null | undefined) ?? null),
    autoSync: src.autoSync !== false,
  };
  return { row, hadTokens };
}
