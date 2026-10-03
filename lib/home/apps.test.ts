import { describe, expect, it } from 'vitest';
import { KNOWN_APPS, appForItem, appForLink, cleanLink, matchApp, openLink } from './apps';

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
    expect(l).toBe(`intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.duolingo;S.browser_fallback_url=${encodeURIComponent('https://www.duolingo.com/learn')};end`);
  });

  it('keeps the query string, so a playlist link opens that playlist', () => {
    const yt = { id: 'x', name: 'X', words: [], url: 'https://music.youtube.com/playlist?list=PL123', androidPackage: 'com.google.android.apps.youtube.music' };
    expect(openLink(yt, true)).toContain('intent://music.youtube.com/playlist?list=PL123#Intent;');
  });
});

describe('appForLink', () => {
  it('names the services you link to', () => {
    expect(appForLink('https://github.com/skyfly200/cadence')).toMatchObject({ name: 'GitHub', androidPackage: 'com.github.android' });
    expect(appForLink('https://app.netlify.com/sites/cadence/overview')?.name).toBe('Netlify');
    expect(appForLink('https://cadence.netlify.app/')?.name).toBe('Netlify');
    expect(appForLink('https://www.notion.so/Plan-123')).toMatchObject({ name: 'Notion', androidPackage: 'notion.id' });
    expect(appForLink('https://trello.com/b/abc/board')).toMatchObject({ name: 'Trello', androidPackage: 'com.trello' });
  });

  it('tells Google Docs, Sheets and Slides apart', () => {
    expect(appForLink('https://docs.google.com/document/d/1/edit')).toMatchObject({ name: 'Docs', androidPackage: 'com.google.android.apps.docs.editors.docs' });
    expect(appForLink('https://docs.google.com/spreadsheets/d/1/edit')?.name).toBe('Sheets');
    expect(appForLink('https://docs.google.com/presentation/d/1/edit')?.name).toBe('Slides');
    expect(appForLink('https://docs.google.com/forms/d/1/edit')?.name).toBe('Google Docs');
  });

  it('keeps the whole link, and falls back to the site for anything else', () => {
    expect(appForLink('https://github.com/a/b/issues/3?x=1')?.url).toBe('https://github.com/a/b/issues/3?x=1');
    expect(appForLink('https://example.org/page')).toMatchObject({ name: 'example.org', url: 'https://example.org/page' });
    expect(appForLink('https://open.spotify.com/playlist/abc')?.name).toBe('Spotify');
  });

  it('does not match a lookalike host, and rejects non-https', () => {
    expect(appForLink('https://github.com.evil.example/x')?.name).toBe('github.com.evil.example');
    expect(appForLink('https://notgithub.com/x')?.name).toBe('notgithub.com');
    expect(appForLink('http://github.com/x')).toBeNull();
    expect(appForLink('javascript:alert(1)')).toBeNull();
    expect(appForLink('nope')).toBeNull();
  });

  it('opens an Android intent for the linked app with the full link', () => {
    const a = appForLink('https://github.com/skyfly200/cadence/issues?q=1')!;
    expect(openLink(a, true)).toContain('intent://github.com/skyfly200/cadence/issues?q=1#Intent;scheme=https;package=com.github.android;');
  });
});

describe('cleanLink and appForItem', () => {
  it('cleans https links only', () => {
    expect(cleanLink(' https://trello.com/b/1 ')).toBe('https://trello.com/b/1');
    expect(cleanLink('ftp://x.example')).toBeNull();
    expect(cleanLink('')).toBeNull();
  });

  it("an item's own link wins over its title, and a bad link falls back to the title", () => {
    expect(appForItem('Check my email', 'https://github.com/a/b')?.name).toBe('GitHub');
    expect(appForItem('Check my email', 'junk')?.name).toBe('Gmail');
    expect(appForItem('Check my email')?.name).toBe('Gmail');
    expect(appForItem('Water plants', null)).toBeNull();
  });
});
