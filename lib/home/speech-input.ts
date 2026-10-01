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

/**
 * Join interim and final transcript parts into a single string.
 * Rebuilds from scratch each time to ensure live updates and no duplicates.
 * Respects existing base text (e.g., previously captured transcript).
 *
 * @param base - existing text to build on (e.g., from a previous final result)
 * @param results - SpeechRecognitionResultList from the event
 * @returns concatenated transcript
 */
export function joinTranscript(
  base: string,
  results: SpeechRecognitionResultList
): string {
  let spoken = '';
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    for (let j = 0; j < result.length; j++) {
      spoken += result[j].transcript;
    }
  }
  spoken = spoken.replace(/\s+/g, ' ').trim();
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
      return 'Mic isn't available here — typing works too.';
    case 'aborted':
      return null;
    case 'no-speech':
      return null;
    default:
      return 'Mic isn't working right now. Try typing instead.';
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
