import { describe, expect, it } from 'vitest';
import {
  estimateTravelMinutes, haversineKm, learnedDuration, median, titleSimilarity, travelCorrection,
} from './estimates';
import { rankNow } from './ranking';
import { UTC, at, commitment, ev, link, place } from './test-helpers';

/** A finished item: started then done `minutes` later. */
function finished(id: string, title: string, minutes: number, day = '2026-03-10') {
  const start = at(`${day}T10:00:00.000Z`);
  const end = new Date(start.getTime() + minutes * 60000);
  return {
    node: commitment(id, { title }),
    occs: [ev(id, 'started', start.toISOString()), ev(id, 'done', end.toISOString())],
  };
}

describe('learnedDuration', () => {
  const target = commitment('t', { title: 'Send the invoice' });

  it('is the median started-to-done of similar finished items', () => {
    const a = finished('a', 'Send invoice to studio', 10);
    const b = finished('b', 'Send the invoice', 20, '2026-03-11');
    const c = finished('c', 'Send invoice', 30, '2026-03-12');
    const unrelated = finished('z', 'Clean the workshop bench', 90);
    const d = learnedDuration(target, {
      nodes: [target, a.node, b.node, c.node, unrelated.node], links: [],
      occurrences: [...a.occs, ...b.occs, ...c.occs, ...unrelated.occs],
    });
    expect(d).toBe(20);
  });

  it('is refined by the Place when similar items were done at the same Place', () => {
    const shop = place('shop');
    const here = commitment('t2', { title: 'Buy filament' });
    const a = finished('a', 'Buy filament', 15);
    const b = finished('b', 'Buy filament', 60, '2026-03-11');
    const d = learnedDuration(here, {
      nodes: [here, a.node, b.node, shop],
      links: [link('at', 't2', 'shop'), link('at', 'b', 'shop')],
      occurrences: [...a.occs, ...b.occs],
    });
    expect(d).toBe(60); // only the item done at the same Place counts
  });

  it('is null without history, and ignores items never started or since undone', () => {
    expect(learnedDuration(target, { nodes: [target], links: [], occurrences: [] })).toBeNull();
    const noStart = commitment('n', { title: 'Send the invoice' });
    expect(learnedDuration(target, { nodes: [target, noStart], links: [], occurrences: [ev('n', 'done', '2026-03-10T10:20:00.000Z')] })).toBeNull();
  });

  it('feeds the ranking when no duration is stored (and falls back to 30 otherwise)', () => {
    const a = finished('a', 'Send invoice', 12);
    const r = rankNow({ now: at('2026-03-14T12:00:00.000Z'), opts: UTC, nodes: [target, a.node], links: [], occurrences: a.occs });
    expect(r.now?.node.id).toBe('t');
    expect(r.now?.minutes).toBe(12);
    const none = rankNow({ now: at('2026-03-14T12:00:00.000Z'), opts: UTC, nodes: [target], links: [], occurrences: [] });
    expect(none.now?.minutes).toBe(30);
  });
});

describe('titleSimilarity and median', () => {
  it('scores overlap on meaningful words', () => {
    expect(titleSimilarity('Send the invoice', 'send invoice')).toBe(1);
    expect(titleSimilarity('Clean the workshop bench', 'Send invoice')).toBe(0);
    expect(titleSimilarity('Pack the basket and knife', 'Pack basket')).toBeGreaterThan(0.5);
  });
  it('median handles empty, odd and even lists', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('offline travel', () => {
  const a = { lat: 0, lon: 0 };
  const b = { lat: 0, lon: 0.1 }; // about 11.1 km along the equator

  it('estimates minutes from distance, a per-mode speed and a road-circuity factor', () => {
    expect(haversineKm(a, b)).toBeCloseTo(11.12, 1);
    expect(estimateTravelMinutes(a, b, 'drive')).toBe(22);   // 11.12 * 1.3 / 40 * 60
    expect(estimateTravelMinutes(a, b, 'walk')).toBe(174);
    expect(estimateTravelMinutes(a, a)).toBe(0);
  });

  it('applies a learned correction ratio', () => {
    expect(estimateTravelMinutes(a, b, 'drive', 2)).toBe(44);
    const k = travelCorrection([{ estimatedMin: 20, actualMin: 30 }, { estimatedMin: 10, actualMin: 15 }, { estimatedMin: 40, actualMin: 60 }]);
    expect(k).toBeCloseTo(1.5, 5);
  });

  it('the correction is 1 with no usable sample and is clamped to a sane range', () => {
    expect(travelCorrection([])).toBe(1);
    expect(travelCorrection([{ estimatedMin: 0, actualMin: 10 }, { estimatedMin: 10, actualMin: 0 }])).toBe(1);
    expect(travelCorrection([{ estimatedMin: 1, actualMin: 100 }])).toBe(3);
    expect(travelCorrection([{ estimatedMin: 100, actualMin: 1 }])).toBe(0.5);
  });
});
