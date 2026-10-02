import { describe, expect, it } from 'vitest';
import { formatClock } from './clock';

describe('formatClock', () => {
  it('12-hour with am/pm, noon and midnight as 12', () => {
    expect(formatClock(14, 40)).toBe('2:40 pm');
    expect(formatClock(0, 5, '12')).toBe('12:05 am');
    expect(formatClock(12, 0, '12')).toBe('12:00 pm');
    expect(formatClock(9, 7, '12')).toBe('9:07 am');
  });
  it('24-hour keeps the hour as is', () => {
    expect(formatClock(14, 40, '24')).toBe('14:40');
    expect(formatClock(0, 5, '24')).toBe('0:05');
    expect(formatClock(9, 7, '24')).toBe('9:07');
  });
});
