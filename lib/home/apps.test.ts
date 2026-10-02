import { describe, expect, it } from 'vitest';
import { KNOWN_APPS, matchApp, openLink } from './apps';

describe('matchApp', () => {
  it('finds the app a title names', () => {
    expect(matchApp('Check my email')?.id).toBe('gmail');
    expect(matchApp('Duolingo')?.id).toBe('duolingo');
    expect(matchApp('Do my duolingo lesson')?.id).toBe('duolingo');
    expect(matchApp('Look at the calendar for Friday')?.id).toBe('calendar');
  });

  it('matches whole words only', () => {
    expect(matchApp('Mailbox cleanup')).toBeNull();
    expect(matchApp('Zoomorphic sculpture')).toBeNull();
    expect(matchApp('Buy a driveway sealer')).toBeNull();
  });

  it('prefers the app named first, and returns null when none is', () => {
    expect(matchApp('Spotify playlist, then email')?.id).toBe('spotify');
    expect(matchApp('Water the plants')).toBeNull();
    expect(matchApp('')).toBeNull();
  });

  it('every known app has a valid https url', () => {
    for (const a of KNOWN_APPS) expect(new URL(a.url).protocol).toBe('https:');
  });
});

describe('openLink', () => {
  const duo = KNOWN_APPS.find((a) => a.id === 'duolingo')!;

  it('is the website off Android', () => {
    expect(openLink(duo, false)).toBe('https://www.duolingo.com/learn');
  });

  it('is an intent for the installed app on Android, with the website as the fallback', () => {
    const l = openLink(duo, true);
    expect(l).toBe(`intent://www.duolingo.com/learn#Intent;scheme=https;package=com.duolingo;S.browser_fallback_url=${encodeURIComponent('https://www.duolingo.com/learn')};end`);
  });
});
