import { describe, expect, it } from 'vitest';
import { DEFAULT_GCAL, sanitizeGoogleCalendar } from './gcal-status';

describe('sanitizeGoogleCalendar', () => {
  it('strips tokens from a legacy connected row and resets it to not connected (the server has no tokens for it)', () => {
    const legacy = {
      connected: true, accessToken: 'ya29.secret', refreshToken: '1//secret', tokenExpiresAt: '2026-01-01T00:00:00Z',
      calendarEmail: 'sky@example.com', lastSyncAt: '2026-01-01T00:00:00Z', autoSync: false,
    };
    const { row, hadTokens } = sanitizeGoogleCalendar(legacy);
    expect(hadTokens).toBe(true);
    expect(row).toEqual({ connected: false, calendarEmail: null, lastSyncAt: null, autoSync: false }); // keeps the preference
    expect(JSON.stringify(row)).not.toMatch(/secret|accessToken|refreshToken|tokenExpiresAt/);
  });

  it('leaves a modern cache row alone', () => {
    const modern = { connected: true, calendarEmail: 'sky@example.com', lastSyncAt: '2026-09-30T08:00:00Z', autoSync: true };
    expect(sanitizeGoogleCalendar(modern)).toEqual({ row: modern, hadTokens: false });
  });

  it('drops unknown fields, so nothing extra can ride along in a backup', () => {
    const { row } = sanitizeGoogleCalendar({ connected: true, calendarEmail: null, extra: 'x' });
    expect(Object.keys(row).sort()).toEqual(['autoSync', 'calendarEmail', 'connected', 'lastSyncAt']);
  });

  it('defaults autoSync to on and handles garbage input', () => {
    expect(sanitizeGoogleCalendar({ connected: true }).row.autoSync).toBe(true);
    for (const junk of [null, undefined, 'x', 5, []]) {
      expect(sanitizeGoogleCalendar(junk)).toEqual({ row: DEFAULT_GCAL, hadTokens: false });
    }
  });

  it('only treats connected === true as connected', () => {
    expect(sanitizeGoogleCalendar({ connected: 'yes' }).row.connected).toBe(false);
  });
});
