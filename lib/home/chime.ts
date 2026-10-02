/**
 * The soft reward tone: one short note, or two rising notes for a slog. Browser only. It uses the same
 * per-device tone setting and volume as the nudge tone (so the one mute still covers it), and does
 * nothing if audio is unavailable. Called from a tap, so the browser lets the sound play.
 */
import { toneLevel } from './prefs';
import type { Tone } from './rewards';

let ctx: AudioContext | null = null;

export function playChime(tone: Tone): void {
  if (tone === 'none' || typeof window === 'undefined') return;
  const level = toneLevel();
  if (level <= 0) return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = tone === 'big' ? [523.25, 783.99] : [659.25];
    const start = ctx.currentTime;
    notes.forEach((freq, i) => {
      const t = start + i * 0.16;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx!.destination);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level, t + 0.04);
      gain.gain.linearRampToValueAtTime(0, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch { /* audio is a nicety: ignore any failure */ }
}
