import { describe, expect, it } from 'vitest';
import { openLink } from './apps';
import { DEFAULT_MUSIC, MUSIC_PROVIDERS, musicTarget, parsePlaylist, providerById } from './music';

describe('parsePlaylist', () => {
  it('recognises each provider from a pasted link', () => {
    expect(parsePlaylist('https://music.youtube.com/playlist?list=PL123')?.provider.id).toBe('ytmusic');
    expect(parsePlaylist(' https://open.spotify.com/playlist/37i9dQZF1DX ')?.provider.id).toBe('spotify');
    expect(parsePlaylist('https://soundcloud.com/someone/sets/focus')?.provider.id).toBe('soundcloud');
  });

  it('rejects anything that is not an https link to a known player', () => {
    expect(parsePlaylist('')).toBeNull();
    expect(parsePlaylist('not a link')).toBeNull();
    expect(parsePlaylist('http://music.youtube.com/playlist?list=PL1')).toBeNull();
    expect(parsePlaylist('https://evil.example/music.youtube.com')).toBeNull();
    expect(parsePlaylist('https://music.youtube.com.evil.example/x')).toBeNull();
  });
});

describe('musicTarget', () => {
  it('defaults to opening YouTube Music itself', () => {
    const t = musicTarget(DEFAULT_MUSIC);
    expect(t).toMatchObject({ name: 'YouTube Music', url: 'https://music.youtube.com/' });
  });

  it('opens the chosen provider when there is no playlist', () => {
    expect(musicTarget({ ...DEFAULT_MUSIC, provider: 'spotify' }).url).toBe('https://open.spotify.com/');
    expect(musicTarget({ ...DEFAULT_MUSIC, provider: 'nope' }).name).toBe('YouTube Music');
  });

  it('a playlist link wins and brings its own provider', () => {
    const t = musicTarget({ provider: 'ytmusic', playlist: 'https://open.spotify.com/playlist/abc', onFocus: true });
    expect(t).toMatchObject({ name: 'Spotify', url: 'https://open.spotify.com/playlist/abc' });
  });

  it('an invalid playlist falls back to the app', () => {
    expect(musicTarget({ ...DEFAULT_MUSIC, playlist: 'junk' }).url).toBe('https://music.youtube.com/');
  });

  it('builds an Android intent for the playlist, and the plain link elsewhere', () => {
    const t = musicTarget({ ...DEFAULT_MUSIC, playlist: 'https://music.youtube.com/playlist?list=PL123' });
    expect(openLink(t, true)).toContain('intent://music.youtube.com/playlist?list=PL123#Intent;scheme=https;package=com.google.android.apps.youtube.music;');
    expect(openLink(t, false)).toBe('https://music.youtube.com/playlist?list=PL123');
  });

  it('every provider is reachable by id with an https home', () => {
    for (const p of MUSIC_PROVIDERS) {
      expect(providerById(p.id)).toBe(p);
      expect(new URL(p.home).protocol).toBe('https:');
    }
  });
});
