/**
 * Cloud voices (opt-in, off by default): fetch one spoken line from the server and play it.
 * The browser's own voice is the fallback for every failure, so this returns false on any
 * problem and the caller speaks normally. Nothing is sent when the switch is off, nobody is
 * signed in, or the line belongs to a Private item.
 */
import { getCloudVoiceOn } from './home/prefs';

interface Opts {
  accessToken: string | null | undefined;
  /** True when the line mentions a Private item: it never leaves the device. */
  priv?: boolean;
  /** Plays base64 audio at a 0 to 1 volume; resolves when playback has started. */
  play: (audio: string, mime: string, volume: number) => Promise<void>;
  volume: number;
  fetch?: typeof fetch;
  /** Overrides the stored switch (tests). */
  on?: boolean;
}

export async function cloudSpeak(text: string, opts: Opts): Promise<boolean> {
  if (!(opts.on ?? getCloudVoiceOn()) || !opts.accessToken || opts.priv || opts.volume <= 0) return false;
  try {
    const res = await (opts.fetch ?? fetch)('/api/voice/speak', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean; audio?: string; mime?: string };
    if (!data.ok || !data.audio) return false;
    await opts.play(data.audio, data.mime || 'audio/mpeg', opts.volume);
    return true;
  } catch {
    return false;
  }
}
