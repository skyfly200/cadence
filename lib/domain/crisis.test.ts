import { describe, expect, it } from 'vitest';
import { checkCrisis, countryFromLocale, guardAiReply, resourcesFor } from './crisis';

describe('checkCrisis: matches', () => {
  it.each([
    'I want to kill myself',
    "I'm going to kill myself",
    'i keep thinking about ending my life',
    "I've been thinking about taking my own life",
    'I want to end it all',
    'I just want to die',
    "I'm so tired and I want to be dead",
    "I don't want to live anymore",
    'I do not want to be alive',
    'I wish I were dead',
    "I wish I wouldn't wake up",
    "there's no point in living",
    'I see no reason to live',
    'everyone would be better off without me',
    "I'm suicidal",
    'honestly i feel suicidal tonight',
    'I want to hurt myself',
    "i'm going to cut myself",
    'I keep hurting myself',
    'thinking about self-harm again',
    'I WANT TO DIE.',
    'i’m going to kill myself',
    'i  want\nto   die',
  ])('catches %j', (text) => {
    expect(checkCrisis(text)).toBe(true);
  });
});

describe('checkCrisis: idioms and ordinary captures are skipped', () => {
  it.each([
    'I could kill myself for forgetting the projector',
    "I'll kill myself if I miss the train",
    'I nearly killed myself laughing',
    'I want to die of embarrassment',
    "I'm going to die if I miss this deadline",
    "I'm dying to see the new film",
    'I am dying for a coffee',
    'kill the lights before leaving',
    'kill the process on the server',
    'I need to cut myself some slack',
    'I should cut myself off from social media',
    'I hurt myself at the gym yesterday',
    'I cut myself shaving',
    'Call the dentist tomorrow 3pm',
    'Book the time off work, my friend is ending his lease',
    'end of life care article for mum',
    'Buy cake, pick up balloons, and decorate for the party',
    'This meeting is killing me',
    'I killed it at the presentation',
    '',
    '   ',
  ])('does not flag %j', (text) => {
    expect(checkCrisis(text)).toBe(false);
  });
});

describe('guardAiReply', () => {
  it('passes an ordinary reply through unchanged', () => {
    expect(guardAiReply('Here is what I heard: three things.')).toEqual({ ok: true, text: 'Here is what I heard: three things.' });
  });
  it('drops a reply that reads as crisis language', () => {
    expect(guardAiReply('I hear that you want to die.')).toEqual({ ok: false });
  });
  it('lets a reply that only points to help through', () => {
    expect(guardAiReply('If you are thinking about it, you can call 988.').ok).toBe(true);
  });
});

describe('resourcesFor', () => {
  it('gives 988 with call and text for the US and Canada', () => {
    for (const c of ['US', 'CA', 'us']) {
      const [first, last] = [resourcesFor(c).resources[0]!, resourcesFor(c).resources.at(-1)!];
      expect(first).toMatchObject({ tel: 'tel:988', sms: 'sms:988' });
      expect(last.url).toBe('https://findahelpline.com');
    }
  });
  it('gives Samaritans 116 123 for the UK (as UK or GB) and Ireland', () => {
    for (const c of ['GB', 'UK', 'IE']) expect(resourcesFor(c).resources[0]).toMatchObject({ name: 'Samaritans', tel: 'tel:116123' });
    expect(resourcesFor('UK').country).toBe('GB');
  });
  it('gives Lifeline 13 11 14 for Australia', () => {
    expect(resourcesFor('AU').resources[0]).toMatchObject({ name: 'Lifeline', tel: 'tel:131114' });
  });
  it('falls back to the worldwide finder alone for any other or missing country', () => {
    for (const c of ['DE', '', null, undefined]) {
      expect(resourcesFor(c as string | null | undefined)).toEqual({ country: null, resources: [expect.objectContaining({ url: 'https://findahelpline.com' })] });
    }
  });
});

describe('countryFromLocale', () => {
  it('reads the region of a locale', () => {
    expect(countryFromLocale('en-US')).toBe('US');
    expect(countryFromLocale('en_gb')).toBe('GB');
    expect(countryFromLocale('zh-Hant-TW')).toBe('TW');
    expect(countryFromLocale(['en-AU', 'en'])).toBe('AU');
  });
  it('is null when there is no region', () => {
    for (const l of ['en', '', null, undefined]) expect(countryFromLocale(l as string | null | undefined)).toBeNull();
  });
});
