import { describe, it, expect } from 'vitest';
import {
  getRecognitionCtor,
  joinTranscript,
  messageFor,
  initialState,
  setListening,
  setMessage,
  SpeechRecognitionResultList,
} from './speech-input';

describe('getRecognitionCtor', () => {
  it('returns SpeechRecognition when available', () => {
    const win = { SpeechRecognition: function() {} } as any as Window;
    const ctor = getRecognitionCtor(win);
    expect(ctor).toBe(win.SpeechRecognition);
  });

  it('falls back to webkitSpeechRecognition', () => {
    const win = { webkitSpeechRecognition: function() {} } as any as Window;
    const ctor = getRecognitionCtor(win);
    expect(ctor).toBe(win.webkitSpeechRecognition);
  });

  it('prefers SpeechRecognition over webkit variant', () => {
    const std = function() {};
    const webkit = function() {};
    const win = { SpeechRecognition: std, webkitSpeechRecognition: webkit } as any as Window;
    const ctor = getRecognitionCtor(win);
    expect(ctor).toBe(std);
  });

  it('returns null when neither is available', () => {
    const win = {} as any as Window;
    const ctor = getRecognitionCtor(win);
    expect(ctor).toBeNull();
  });
});

describe('joinTranscript', () => {
  function makeResults(transcripts: string[], isFinal: boolean[] = []): SpeechRecognitionResultList {
    const items = transcripts.map((transcript, i) => ({
      length: 1,
      isFinal: isFinal[i] ?? false,
      item: () => ({ transcript }),
      [0]: { transcript },
    })) as any;
    return {
      length: items.length,
      item: (i: number) => items[i],
      ...Object.fromEntries(items.map((item, i) => [i, item])),
    } as any;
  }

  it('returns base when results is empty', () => {
    const base = 'hello';
    const results = makeResults([]);
    const joined = joinTranscript(base, results);
    expect(joined).toBe('hello');
  });

  it('returns spoken text when base is empty', () => {
    const results = makeResults(['hello world']);
    const joined = joinTranscript('', results);
    expect(joined).toBe('hello world');
  });

  it('concatenates base and spoken with a space', () => {
    const base = 'hello';
    const results = makeResults(['world']);
    const joined = joinTranscript(base, results);
    expect(joined).toBe('hello world');
  });

  it('concatenates multiple result segments with spaces', () => {
    const base = 'hello';
    const results = makeResults(['world', 'and', 'more']);
    const joined = joinTranscript(base, results);
    expect(joined).toBe('hello world and more');
  });

  it('collapses multiple spaces in spoken text', () => {
    const results = makeResults(['hello    world']);
    const joined = joinTranscript('', results);
    expect(joined).toBe('hello world');
  });

  it('handles trailing spaces in base', () => {
    const base = 'hello   ';
    const results = makeResults(['world']);
    const joined = joinTranscript(base, results);
    expect(joined).toBe('hello world');
  });

  it('handles leading spaces in spoken text', () => {
    const results = makeResults(['   world']);
    const joined = joinTranscript('hello', results);
    expect(joined).toBe('hello world');
  });
});

describe('messageFor', () => {
  it('returns calm message for not-allowed', () => {
    const msg = messageFor('not-allowed');
    expect(msg).toBe('The mic is not available here. Typing works too.');
  });

  it('returns calm message for service-not-allowed', () => {
    const msg = messageFor('service-not-allowed');
    expect(msg).toBe('The mic is not available here. Typing works too.');
  });

  it('returns null for aborted', () => {
    const msg = messageFor('aborted');
    expect(msg).toBeNull();
  });

  it('returns null for no-speech', () => {
    const msg = messageFor('no-speech');
    expect(msg).toBeNull();
  });

  it('returns generic message for unknown errors', () => {
    const msg = messageFor('network-error');
    expect(msg).toBe('The mic is not working right now. Try typing instead.');
  });

  it('uses calm wording (no blame words)', () => {
    const messages = [
      messageFor('not-allowed'),
      messageFor('network-error'),
    ];
    const combined = messages.filter(m => m).join(' ');
    expect(combined).not.toMatch(/deny|denied|fail|failed|you/i);
  });
});

describe('state helpers', () => {
  it('initialState creates idle, no-message state', () => {
    const state = initialState();
    expect(state).toEqual({ listening: false, message: null });
  });

  it('setListening updates listening flag', () => {
    const state = initialState();
    const updated = setListening(state, true);
    expect(updated.listening).toBe(true);
    expect(updated.message).toBe(null);
  });

  it('setMessage updates message', () => {
    const state = initialState();
    const updated = setMessage(state, 'hello');
    expect(updated.listening).toBe(false);
    expect(updated.message).toBe('hello');
  });

  it('state updates are immutable', () => {
    const state = initialState();
    const updated = setListening(state, true);
    expect(state.listening).toBe(false);
    expect(updated.listening).toBe(true);
  });
});
