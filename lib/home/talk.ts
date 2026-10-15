/**
 * Tap-to-talk as a back-and-forth: the capture sheet keeps a turn-by-turn transcript, says Cadence's
 * reply aloud, and opens the mic again for the next thing. Framework-free; tests pass fakes for the
 * browser's speech synthesis.
 */

const FOLLOW_UPS = ['Anything else?', 'What else is on your mind?', 'Anything more?'];

/** The question after the nth thing parked in one sitting (1-based), so the sheet does not repeat itself. */
export function followUp(n: number): string {
  return FOLLOW_UPS[(Math.max(1, n) - 1) % FOLLOW_UPS.length]!;
}

export interface Synth {
  speak(u: unknown): void;
  cancel(): void;
}

export interface UtteranceLike {
  volume: number;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

/** Longest a reply can take before the mic opens anyway (some browsers never fire `end`). */
export const MAX_SPEAK_MS = 15000;

/**
 * Says a line with the browser's voice and resolves once it has finished, so the mic is not listening
 * to Cadence. Resolves at once when there is no voice or the speech volume is 0, and never rejects.
 */
export function sayAloud(
  text: string,
  opts: { synth: Synth | null; make: ((text: string) => UtteranceLike) | null; volume: number; timeoutMs?: number },
): Promise<void> {
  if (!opts.synth || !opts.make || opts.volume <= 0 || !text.trim()) return Promise.resolve();
  const { synth, make } = opts;
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const done = () => { if (timer) clearTimeout(timer); timer = null; resolve(); };
    try {
      const u = make(text);
      u.volume = opts.volume;
      u.onend = done;
      u.onerror = done;
      synth.cancel();
      synth.speak(u);
      timer = setTimeout(done, opts.timeoutMs ?? MAX_SPEAK_MS);
    } catch {
      done();
    }
  });
}

/** The browser's speech synthesis, or nulls when there is none. */
export function browserVoice(win: Window): { synth: Synth | null; make: ((text: string) => UtteranceLike) | null } {
  const w = win as unknown as { speechSynthesis?: Synth; SpeechSynthesisUtterance?: new (t: string) => UtteranceLike };
  if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) return { synth: null, make: null };
  const Ctor = w.SpeechSynthesisUtterance;
  return { synth: w.speechSynthesis, make: (t) => new Ctor(t) };
}
