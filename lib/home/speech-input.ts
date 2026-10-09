/**
 * Browser speech recognition (SpeechRecognition API) state machine and helpers.
 * Pure logic with no window access; tests pass `window` as a parameter.
 */

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface SpeechRecognitionResultEvent {
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
}

/**
 * Get the SpeechRecognition constructor, trying both standard and webkit variants.
 * Returns null if not supported.
 */
export function getRecognitionCtor(win: Window): SpeechRecognitionConstructor | null {
  const w = win as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** A word as compared for repeats: no case, no punctuation. */
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

/** True when `words` begins with every word of `head`. */
function startsWith(words: string[], head: string[]): boolean {
  return head.length > 0 && head.length <= words.length && head.every((w, i) => norm(words[i]!) === norm(w));
}

/**
 * Join interim and final transcript parts into a single string.
 * Rebuilds from scratch each time to ensure live updates and no duplicates.
 * Respects existing base text (e.g., previously captured transcript).
 * Takes the best alternative (first) from each result, rebuilds every event.
 *
 * Android Chrome repeats itself: a result can carry the whole phrase so far, everything heard so
 * far, or the tail of the previous result again. Words are compared without case or punctuation,
 * and only words not already heard are added.
 *
 * @param base - existing text to build on (e.g., from a previous final result)
 * @param results - SpeechRecognitionResultList from the event
 * @returns concatenated transcript
 */
export function joinTranscript(
  base: string,
  results: SpeechRecognitionResultList
): string {
  let heard: string[] = [];
  let lastStart = 0; // where the previous result's words begin in `heard`
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.length === 0) continue;
    const words = result[0].transcript.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    if (startsWith(words, heard)) { heard = words; lastStart = 0; continue; } // everything so far, and more
    const last = heard.slice(lastStart);
    if (startsWith(words, last)) { heard = [...heard.slice(0, lastStart), ...words]; continue; } // the previous phrase, grown
    if (startsWith(last, words)) continue; // the start of the previous phrase again
    if (words.length > 1 && startsWith(heard.slice(heard.length - words.length), words)) continue; // the end again
    // The end of what was heard, then new words: keep only the new ones.
    let overlap = 0;
    for (let k = Math.min(heard.length, words.length - 1); k >= 2; k--) {
      if (startsWith(words, heard.slice(heard.length - k))) { overlap = k; break; }
    }
    lastStart = heard.length - overlap;
    heard = [...heard, ...words.slice(overlap)];
  }
  const spoken = heard.join(' ');
  if (!spoken) return base;
  const baseTrimmed = base.trimEnd();
  if (!baseTrimmed) return spoken;
  return `${baseTrimmed} ${spoken}`;
}

/**
 * Map SpeechRecognitionErrorEvent error codes to calm, helpful messages.
 * Returns null if the event should be silently ignored.
 */
export function messageFor(errorCode: string): string | null {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'The mic is not available here. Typing works too.';
    case 'aborted':
      return null;
    case 'no-speech':
      return null;
    default:
      return 'The mic is not working right now. Try typing instead.';
  }
}

/**
 * Simple state for the speech input lifecycle.
 */
export interface SpeechState {
  listening: boolean;
  message: string | null;
}

export function initialState(): SpeechState {
  return { listening: false, message: null };
}

export function setListening(state: SpeechState, listening: boolean): SpeechState {
  return { ...state, listening };
}

export function setMessage(state: SpeechState, message: string | null): SpeechState {
  return { ...state, message };
}
