import { describe, expect, it } from 'vitest';
import { heardLine, privateLine, spoken, userText } from './discuss';
import type { Turn } from '../../server/utils/discuss';

const turns: Turn[] = [
  { role: 'user', text: ' the dentist ' },
  { role: 'assistant', text: 'Anything else?' },
  { role: 'user', text: 'and the invoice' },
];

describe('discuss helpers', () => {
  it('joins only what the person said', () => {
    expect(userText(turns)).toBe('the dentist\nand the invoice');
    expect(spoken(turns)).toBe(2);
  });
  it('keeps the end of a very long conversation', () => {
    const long: Turn[] = [{ role: 'user', text: 'a'.repeat(5000) }, { role: 'assistant', text: 'ok' }, { role: 'user', text: 'END' }];
    const t = userText(long);
    expect(t.length).toBe(4000);
    expect(t.endsWith('END')).toBe(true);
  });
  it('words the summary line plainly', () => {
    expect(heardLine(3)).toBe("Here's what I heard: 3 things.");
    expect(heardLine(1)).toBe("Here's what I heard: 1 thing.");
    expect(heardLine(0)).toContain('nothing to file');
  });
  it('words the private line only when something was left out', () => {
    expect(privateLine(0)).toBeNull();
    expect(privateLine(1)).toBe('1 private item not included');
    expect(privateLine(2)).toBe('2 private items not included');
  });
});
