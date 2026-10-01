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
    // Mock localStorage
    vi.stubGlobal('window', {
      localStorage: new Map<string, string>(),
    });
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
      const ns = [nudge('a', 'n1'), nudge('b', 'n2')];
      const next = markIssued(state, ns);
      expect(next.issued).toHaveLength(2);
      expect(next.issued[0]!.id).toBe('a');
    });

    it('keeps today\'s old issued nudges and prunes old days', () => {
      let s = markIssued(state, [nudge('a', 'n1')]);
      s = { ...s, issued: [{ id: 'old', kind: 'leave_by' as const, nodeId: 'n0', day: '2026-03-07' }, ...s.issued] };
      s = markIssued(s, [nudge('b', 'n2')]);
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
});
