import { describe, expect, it } from 'vitest';
import { quickKind } from './quick-kind';

describe('quickKind', () => {
  it('reads "goal:" as a Goal', () => {
    expect(quickKind('goal: finish the projection mapping')).toEqual({ kind: 'goal', title: 'finish the projection mapping' });
    expect(quickKind('Goal:Learn Spanish.')).toEqual({ kind: 'goal', title: 'Learn Spanish' });
    expect(quickKind('goal:   ')).toBeNull();
  });

  it('reads a trailing "every ..." as a once-a-period Habit', () => {
    expect(quickKind('stretch every day')).toEqual({ kind: 'habit', title: 'stretch', period: 'day', target: 1 });
    expect(quickKind('Journal each morning')).toEqual({ kind: 'habit', title: 'Journal', period: 'day', target: 1 });
    expect(quickKind('call grandma every week')).toEqual({ kind: 'habit', title: 'call grandma', period: 'week', target: 1 });
    expect(quickKind('review budget, every month')).toEqual({ kind: 'habit', title: 'review budget', period: 'month', target: 1 });
  });

  it('reads daily, weekly, monthly and friends', () => {
    expect(quickKind('floss daily')).toEqual({ kind: 'habit', title: 'floss', period: 'day', target: 1 });
    expect(quickKind('water plants weekly')).toEqual({ kind: 'habit', title: 'water plants', period: 'week', target: 1 });
    expect(quickKind('backup photos quarterly')).toEqual({ kind: 'habit', title: 'backup photos', period: 'quarter', target: 1 });
    expect(quickKind('dentist annually')).toEqual({ kind: 'habit', title: 'dentist', period: 'year', target: 1 });
  });

  it('reads counts per period', () => {
    expect(quickKind('run twice a week')).toEqual({ kind: 'habit', title: 'run', period: 'week', target: 2 });
    expect(quickKind('drink water 8 times a day')).toEqual({ kind: 'habit', title: 'drink water', period: 'day', target: 8 });
    expect(quickKind('swim three times per week')).toEqual({ kind: 'habit', title: 'swim', period: 'week', target: 3 });
    expect(quickKind('yoga 3x a week')).toEqual({ kind: 'habit', title: 'yoga', period: 'week', target: 3 });
    expect(quickKind('call mum once a month')).toEqual({ kind: 'habit', title: 'call mum', period: 'month', target: 1 });
  });

  it('leaves everything else alone', () => {
    expect(quickKind('buy milk')).toBeNull();
    expect(quickKind('call mom every day at 6pm')).toBeNull(); // has a time after the cycle: a Commitment
    expect(quickKind('bins every Monday')).toBeNull();
    expect(quickKind('water plants every other day')).toBeNull();
    expect(quickKind('every day')).toBeNull(); // no title left
    expect(quickKind('read 40 times a week')).toBeNull(); // more than a period holds
    expect(quickKind('my goal is to rest')).toBeNull();
  });
});
