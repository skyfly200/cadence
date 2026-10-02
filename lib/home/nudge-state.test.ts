import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  loadState,
  saveState,
  dueNudges,
  prunedIssued,
  applyNotNow,
  applyStopNode,
  applyStopKind,
  restoreNode,
  restoreKind,
  markIssued,
  setMuted,
  setDisclosed,
  parseNudgeId,
  applyNotificationAction,
  consumeNudgeUrl,
  type NudgeState,
} from './nudge-state';
import type { Nudge, IssuedNudge } from '~/lib/domain';

const at = (iso: string) => new Date(iso);

function nudge(id: string, nodeId: string | null = 'n1', fireAt = '2026-03-08T12:00:00.000Z'): Nudge {
  return {
    id,
    kind: 'leave_by',
    nodeId,
    day: '2026-03-08',
    fireAt,
    dropAfter: '2026-03-08T13:00:00.000Z',
    title: 'Test',
    body: 'Test',
    tag: id,
  };
}

function issued(id: string, nodeId: string | null = 'n1', day = '2026-03-08'): IssuedNudge {
  return { id, kind: 'leave_by', nodeId, day };
}

describe('nudge state', () => {
  let state: NudgeState;

  beforeEach(() => {
    state = {
      feedback: { stoppedKinds: [], stoppedNodes: [], notNow: {} },
      issued: [],
      disabledKinds: new Set(),
      muted: false,
      disclosed: false,
    };
    // Mock localStorage with a proper API
    const store = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: 0,
      key: (index: number) => {
        const keys = Array.from(store.keys());
        return keys[index] ?? null;
      },
    };
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    } as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('dueNudges', () => {
    it('includes nudges that are due now', () => {
      const now = at('2026-03-08T12:00:00.000Z');
      const n = [nudge('a', 'n1', '2026-03-08T12:00:00.000Z')];
      const due = dueNudges(n, now);
      expect(due).toHaveLength(1);
    });

    it('excludes nudges not yet due', () => {
      const now = at('2026-03-08T11:00:00.000Z');
      const n = [nudge('a', 'n1', '2026-03-08T12:00:00.000Z')];
      const due = dueNudges(n, now);
      expect(due).toHaveLength(0);
    });

    it('excludes nudges past their useful life', () => {
      const now = at('2026-03-08T13:01:00.000Z');
      const n = [nudge('a', 'n1', '2026-03-08T12:00:00.000Z')];
      const due = dueNudges(n, now);
      expect(due).toHaveLength(0);
    });
  });

  describe('prunedIssued', () => {
    it('keeps nudges from today', () => {
      const list = [issued('a', 'n1', '2026-03-08'), issued('b', 'n2', '2026-03-08')];
      const pruned = prunedIssued(list, '2026-03-08');
      expect(pruned).toHaveLength(2);
    });

    it('filters out older nudges', () => {
      const list = [issued('a', 'n1', '2026-03-07'), issued('b', 'n2', '2026-03-08')];
      const pruned = prunedIssued(list, '2026-03-08');
      expect(pruned).toHaveLength(1);
      expect(pruned[0]!.id).toBe('b');
    });
  });

  describe('applyNotNow', () => {
    it('increments count and sets lastAt', () => {
      const now = at('2026-03-08T12:15:00.000Z');
      const n = nudge('a', 'n1');
      const next = applyNotNow(state, n, now);
      expect(next.feedback.notNow['n1']).toEqual({ count: 1, lastAt: now.toISOString() });
    });

    it('removes the nudge from issued so it can be rescheduled', () => {
      const next = markIssued(state, [nudge('a', 'n1')]);
      const now = at('2026-03-08T12:15:00.000Z');
      const after = applyNotNow(next, nudge('a', 'n1'), now);
      expect(after.issued.filter((i) => i.id === 'a')).toHaveLength(0);
    });

    it('does nothing for nudges with no nodeId', () => {
      const n = nudge('a', null);
      const next = applyNotNow(state, n, new Date());
      expect(next.feedback.notNow).toEqual({});
    });
  });

  describe('applyStopNode', () => {
    it('adds a node to stoppedNodes', () => {
      const next = applyStopNode(state, 'n1');
      expect(next.feedback.stoppedNodes).toContain('n1');
    });

    it('does not duplicate', () => {
      let s = applyStopNode(state, 'n1');
      s = applyStopNode(s, 'n1');
      expect(s.feedback.stoppedNodes.filter((x) => x === 'n1')).toHaveLength(1);
    });
  });

  describe('applyStopKind', () => {
    it('adds a kind to stoppedKinds', () => {
      const next = applyStopKind(state, 'leave_by');
      expect(next.feedback.stoppedKinds).toContain('leave_by');
    });
  });

  describe('restoreNode', () => {
    it('removes a node from stoppedNodes', () => {
      let s = applyStopNode(state, 'n1');
      s = restoreNode(s, 'n1');
      expect(s.feedback.stoppedNodes).not.toContain('n1');
    });

    it('also clears the notNow entry', () => {
      let s = { ...state, feedback: { ...state.feedback, notNow: { n1: { count: 2, lastAt: '' } } } };
      s = restoreNode(s, 'n1');
      expect(s.feedback.notNow['n1']).toBeUndefined();
    });
  });

  describe('restoreKind', () => {
    it('removes a kind from stoppedKinds', () => {
      let s = applyStopKind(state, 'leave_by');
      s = restoreKind(s, 'leave_by');
      expect(s.feedback.stoppedKinds).not.toContain('leave_by');
    });
  });

  describe('markIssued', () => {
    it('adds nudges to the issued list', () => {
      const now = at('2026-03-08T12:00:00.000Z');
      const ns = [nudge('a', 'n1'), nudge('b', 'n2')];
      const next = markIssued(state, ns, now);
      expect(next.issued).toHaveLength(2);
      expect(next.issued[0]!.id).toBe('a');
    });

    it('keeps today\'s old issued nudges and prunes old days', () => {
      const now = at('2026-03-08T12:00:00.000Z');
      let s = markIssued(state, [nudge('a', 'n1')], now);
      s = { ...s, issued: [{ id: 'old', kind: 'leave_by' as const, nodeId: 'n0', day: '2026-03-07' }, ...s.issued] };
      s = markIssued(s, [nudge('b', 'n2')], now);
      expect(s.issued.filter((i) => i.day === '2026-03-08')).toHaveLength(2);
      expect(s.issued.filter((i) => i.day === '2026-03-07')).toHaveLength(0);
    });
  });

  describe('setMuted', () => {
    it('toggles muted', () => {
      let s = setMuted(state, true);
      expect(s.muted).toBe(true);
      s = setMuted(s, false);
      expect(s.muted).toBe(false);
    });
  });

  describe('setDisclosed', () => {
    it('sets disclosed', () => {
      const s = setDisclosed(state, true);
      expect(s.disclosed).toBe(true);
    });
  });

  describe('persistence', () => {
    it('roundtrips state through localStorage', () => {
      const s: NudgeState = {
        feedback: {
          stoppedKinds: ['leave_by'],
          stoppedNodes: ['n1'],
          notNow: { n2: { count: 1, lastAt: '2026-03-08T12:00:00.000Z' } },
        },
        issued: [issued('a', 'n1')],
        disabledKinds: new Set(['at_risk']),
        muted: true,
        disclosed: true,
      };
      saveState(s);
      const loaded = loadState();
      expect(loaded.feedback.stoppedKinds).toEqual(['leave_by']);
      expect(loaded.feedback.stoppedNodes).toEqual(['n1']);
      expect(loaded.feedback.notNow).toEqual({ n2: { count: 1, lastAt: '2026-03-08T12:00:00.000Z' } });
      expect(loaded.issued).toEqual([issued('a', 'n1')]);
      expect(Array.from(loaded.disabledKinds)).toEqual(['at_risk']);
      expect(loaded.muted).toBe(true);
      expect(loaded.disclosed).toBe(true);
    });

    it('handles corrupt or missing localStorage', () => {
      const store = new Map<string, string>();
      store.set('cadence:nudgeFeedback', 'not json');
      store.set('cadence:nudgeIssued', '[]');
      vi.stubGlobal('window', { localStorage: store });
      const loaded = loadState();
      expect(loaded.feedback).toEqual({ stoppedKinds: [], stoppedNodes: [], notNow: {} });
      expect(loaded.issued).toEqual([]);
    });
  });

  describe('parseNudgeId', () => {
    it('knows the planning invitation', () => {
      expect(parseNudgeId('planning|-|2026-09-28')).toEqual({ kind: 'planning', nodeId: null, day: '2026-09-28' });
    });

    it('parses leave_by nudges with a node', () => {
      const parsed = parseNudgeId('leave_by|node1|2026-03-08');
      expect(parsed).toEqual({ kind: 'leave_by', nodeId: 'node1', day: '2026-03-08' });
    });

    it('parses nudges with a suffix', () => {
      const parsed = parseNudgeId('transition|node1|2026-03-08|heads_up');
      expect(parsed).toEqual({ kind: 'transition', nodeId: 'node1', day: '2026-03-08' });
    });

    it('parses habit_summary (no node)', () => {
      const parsed = parseNudgeId('habit_summary|-|2026-03-08');
      expect(parsed).toEqual({ kind: 'habit_summary', nodeId: null, day: '2026-03-08' });
    });

    it('returns nulls on invalid format', () => {
      expect(parseNudgeId('invalid')).toEqual({ kind: null, nodeId: null, day: null });
      expect(parseNudgeId('')).toEqual({ kind: null, nodeId: null, day: null });
    });

    it('returns nulls on invalid kind', () => {
      const parsed = parseNudgeId('unknown|node1|2026-03-08');
      expect(parsed).toEqual({ kind: null, nodeId: null, day: null });
    });
  });

  describe('applyNotificationAction', () => {
    it('applies "notnow" action to a nudge with a node', () => {
      const id = 'leave_by|node1|2026-03-08';
      const next = applyNotificationAction(state, id, 'notnow');
      expect(next.feedback.notNow['node1']).toBeDefined();
      expect(next.feedback.notNow['node1'].count).toBe(1);
    });

    it('ignores "notnow" on habit_summary (no node)', () => {
      const id = 'habit_summary|-|2026-03-08';
      const next = applyNotificationAction(state, id, 'notnow');
      expect(next.feedback.notNow).toEqual({});
    });

    it('applies "stop" to a node', () => {
      const id = 'leave_by|node1|2026-03-08';
      const next = applyNotificationAction(state, id, 'stop');
      expect(next.feedback.stoppedNodes).toContain('node1');
    });

    it('applies "stop" to a kind when nodeId is absent', () => {
      const id = 'habit_summary|-|2026-03-08';
      const next = applyNotificationAction(state, id, 'stop');
      expect(next.feedback.stoppedKinds).toContain('habit_summary');
    });

    it('ignores unknown actions', () => {
      const id = 'leave_by|node1|2026-03-08';
      const next = applyNotificationAction(state, id, 'unknown');
      expect(next).toEqual(state);
    });

    it('ignores empty action', () => {
      const id = 'leave_by|node1|2026-03-08';
      const next = applyNotificationAction(state, id, '');
      expect(next).toEqual(state);
    });

    it('ignores invalid nudge id', () => {
      const next = applyNotificationAction(state, 'invalid', 'stop');
      expect(next).toEqual(state);
    });
  });
});

describe('consumeNudgeUrl', () => {
  const NOW = new Date('2026-10-03T12:00:00.000Z');
  const fresh = () => loadState();

  it('does nothing for an address with no nudge', () => {
    expect(consumeNudgeUrl('https://cadence.skylerfly.com/', fresh(), NOW)).toBeNull();
    expect(consumeNudgeUrl('https://cadence.skylerfly.com/?action=stop', fresh(), NOW)).toBeNull();
  });

  it('Not now counts one dismissal for the node and clears the params', () => {
    const r = consumeNudgeUrl('https://cadence.skylerfly.com/?nudge=leave_by%7Cdentist%7C2026-10-03&action=notnow', fresh(), NOW)!;
    expect(r.state.feedback.notNow.dentist).toEqual({ count: 1, lastAt: NOW.toISOString() });
    expect(r.href).toBe('https://cadence.skylerfly.com/');
  });

  it('a second Not now through the link is the second dismissal', () => {
    const first = consumeNudgeUrl('https://x.example/?nudge=at_risk%7Cb%7C2026-10-03&action=notnow', fresh(), NOW)!;
    const second = consumeNudgeUrl('https://x.example/?nudge=at_risk%7Cb%7C2026-10-03%7Cagain&action=notnow', first.state, NOW)!;
    expect(second.state.feedback.notNow.b.count).toBe(2);
  });

  it('Stop silences the node, or the whole kind for a nudge with no node', () => {
    const node = consumeNudgeUrl('https://x.example/?nudge=leave_by%7Cdentist%7C2026-10-03&action=stop', fresh(), NOW)!;
    expect(node.state.feedback.stoppedNodes).toContain('dentist');
    const kind = consumeNudgeUrl('https://x.example/?nudge=habit_summary%7C-%7C2026-10-03&action=stop', fresh(), NOW)!;
    expect(kind.state.feedback.stoppedKinds).toContain('habit_summary');
  });

  it('tapping the weekly planning invitation opens the Planning session', () => {
    const r = consumeNudgeUrl('https://x.example/?nudge=planning%7C-%7C2026-09-28', fresh(), NOW)!;
    expect(r.href).toBe('https://x.example/?open=planning');
    expect(r.state.feedback.stoppedKinds).toEqual([]);
  });

  it('Stop these on the planning invitation silences the kind and does not open the session; Not now does nothing', () => {
    const stop = consumeNudgeUrl('https://x.example/?nudge=planning%7C-%7C2026-09-28&action=stop', fresh(), NOW)!;
    expect(stop.state.feedback.stoppedKinds).toContain('planning');
    expect(stop.href).toBe('https://x.example/');
    const notNow = consumeNudgeUrl('https://x.example/?nudge=planning%7C-%7C2026-09-28&action=notnow', fresh(), NOW)!;
    expect(notNow.state.feedback).toEqual(fresh().feedback);
    expect(notNow.href).toBe('https://x.example/');
  });

  it('keeps other params and the hash, and does not change state for an unknown action or a bad id', () => {
    const r = consumeNudgeUrl('https://x.example/app?tab=plan&nudge=leave_by%7Ca%7C2026-10-03&action=explode#top', fresh(), NOW)!;
    expect(r.href).toBe('https://x.example/app?tab=plan#top');
    expect(r.state.feedback).toEqual(fresh().feedback);
    const bad = consumeNudgeUrl('https://x.example/?nudge=garbage&action=stop', fresh(), NOW)!;
    expect(bad.state.feedback).toEqual(fresh().feedback);
    expect(bad.href).toBe('https://x.example/');
  });
});
