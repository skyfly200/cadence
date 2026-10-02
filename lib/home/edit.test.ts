import { describe, expect, it } from 'vitest';
import type { Commitment, Idea, Link, Thing } from '../domain';
import { applyEdit, deleteNode, getOrCreatePlace, wouldCreateCycle } from './edit';

const NOW = '2026-10-03T15:00:00.000Z';

const commitment = (id: string, over: Partial<Commitment> = {}): Commitment => ({
  id,
  kind: 'commitment',
  title: id,
  private: false,
  createdAt: NOW,
  updatedAt: NOW,
  slog: false,
  quiet: false,
  ...over,
});

const idea = (id: string): Idea => ({
  id,
  kind: 'idea',
  title: id,
  private: false,
  createdAt: NOW,
  updatedAt: NOW,
});

const thing = (id: string, thingType: 'place' | 'person' | 'object' = 'place', title = id): Thing => ({
  id,
  kind: 'thing',
  thingType,
  title,
  private: false,
  createdAt: NOW,
  updatedAt: NOW,
  lat: null,
  lon: null,
});

const link = (id: string, type: Link['type'], fromId: string, toId: string): Link => ({
  id,
  type,
  fromId,
  toId,
  origin: 'stated',
  confidence: 1,
  evidence: [],
  createdAt: NOW,
  updatedAt: NOW,
});

describe('wouldCreateCycle', () => {
  it('returns true for self-dependency', () => {
    expect(wouldCreateCycle([], 'a', 'a')).toBe(true);
  });

  it('returns false when there is no dependency', () => {
    expect(wouldCreateCycle([], 'a', 'b')).toBe(false);
  });

  it('detects direct cycles', () => {
    const links = [link('l1', 'requires', 'a', 'b')];
    expect(wouldCreateCycle(links, 'b', 'a')).toBe(true);
  });

  it('detects transitive cycles', () => {
    const links = [link('l1', 'requires', 'a', 'b'), link('l2', 'requires', 'b', 'c')];
    expect(wouldCreateCycle(links, 'c', 'a')).toBe(true);
  });

  it('ignores non-requires links', () => {
    const links = [link('l1', 'at', 'a', 'b'), link('l2', 'part_of', 'b', 'c')];
    expect(wouldCreateCycle(links, 'a', 'b')).toBe(false);
  });
});

describe('getOrCreatePlace', () => {
  it('returns id of existing place with matching name (case-insensitive)', () => {
    const nodes = [thing('p1', 'place', 'Coffee Shop')];
    const id = getOrCreatePlace('coffee shop', nodes, () => {});
    expect(id).toBe('p1');
  });

  it('creates a new place if not found', () => {
    const nodes: Thing[] = [];
    let created: Thing | null = null;
    const id = getOrCreatePlace('Coffee Shop', nodes, (n) => {
      created = n as Thing;
    });
    expect(created).not.toBeNull();
    expect(created!.title).toBe('Coffee Shop');
    expect(created!.thingType).toBe('place');
    expect(created!.lat).toBeNull();
    expect(created!.lon).toBeNull();
    expect(id).toBe(created!.id);
  });

  it('ignores non-place things', () => {
    const nodes = [thing('p1', 'person', 'Alice')];
    let created: Thing | null = null;
    const id = getOrCreatePlace('Alice', nodes, (n) => {
      created = n as Thing;
    });
    expect(created).not.toBeNull();
    expect(id).not.toBe('p1');
  });

  it('throws on empty place name', () => {
    expect(() => getOrCreatePlace('', [], () => {})).toThrow();
    expect(() => getOrCreatePlace('   ', [], () => {})).toThrow();
  });
});

describe('applyEdit', () => {
  it('updates title and returns updated node', () => {
    const c = commitment('c1', { title: 'Old title' });
    const result = applyEdit('c1', { title: 'New title' }, [c], [], () => {}, () => {});
    expect(result.nodes[0].title).toBe('New title');
    expect(result.nodes[0].updatedAt).not.toBe(NOW); // should be newer
  });

  it('updates commitment time fields', () => {
    const c = commitment('c1');
    const fixedTime = '2026-10-04T10:00:00.000Z';
    const deadline = '2026-10-05T17:00:00.000Z';
    const result = applyEdit(
      'c1',
      { fixedTime, deadline, durationMinutes: 45 },
      [c],
      [],
      () => {},
      () => {},
    );
    const updated = result.nodes[0] as Commitment;
    expect(updated.fixedTime).toBe(fixedTime);
    expect(updated.deadline).toBe(deadline);
    expect(updated.durationMinutes).toBe(45);
  });

  it('can clear fixedTime and deadline', () => {
    const c = commitment('c1', { fixedTime: '2026-10-04T10:00:00.000Z', deadline: '2026-10-05T17:00:00.000Z' });
    const result = applyEdit('c1', { fixedTime: null, deadline: null }, [c], [], () => {}, () => {});
    const updated = result.nodes[0] as Commitment;
    expect(updated.fixedTime).toBeNull();
    expect(updated.deadline).toBeNull();
  });

  it('creates location link for new location', () => {
    const c = commitment('c1');
    const p = thing('p1', 'place', 'Coffee Shop');
    let createdNode: Thing | null = null;
    let createdLink: Link | null = null;
    const result = applyEdit(
      'c1',
      { location: 'Coffee Shop' },
      [c, p],
      [],
      (n) => {
        createdNode = n as Thing;
      },
      (l) => {
        createdLink = l;
      },
    );
    expect(createdNode).toBeNull(); // place already exists
    expect(createdLink).not.toBeNull();
    expect(createdLink!.type).toBe('at');
    expect(createdLink!.fromId).toBe('c1');
    expect(createdLink!.toId).toBe('p1');
    expect(result.links).toContain(createdLink);
  });

  it('removes old location link when updating location', () => {
    const c = commitment('c1');
    const p1 = thing('p1', 'place', 'Old Place');
    const p2 = thing('p2', 'place', 'New Place');
    const oldLink = link('l1', 'at', 'c1', 'p1');
    let createdLink: Link | null = null;
    const result = applyEdit(
      'c1',
      { location: 'New Place' },
      [c, p1, p2],
      [oldLink],
      () => {},
      (l) => {
        createdLink = l;
      },
    );
    expect(result.links).not.toContain(oldLink);
    expect(result.links).toContain(createdLink);
  });

  it('clears location link when location is null', () => {
    const c = commitment('c1');
    const p = thing('p1', 'place', 'Coffee Shop');
    const oldLink = link('l1', 'at', 'c1', 'p1');
    const result = applyEdit('c1', { location: null }, [c, p], [oldLink], () => {}, () => {});
    expect(result.links).not.toContain(oldLink);
  });

  it('creates dependency link', () => {
    const c1 = commitment('c1');
    const c2 = commitment('c2');
    let createdLink: Link | null = null;
    const result = applyEdit(
      'c1',
      { dependencyId: 'c2' },
      [c1, c2],
      [],
      () => {},
      (l) => {
        createdLink = l;
      },
    );
    expect(createdLink).not.toBeNull();
    expect(createdLink!.type).toBe('requires');
    expect(createdLink!.fromId).toBe('c1');
    expect(createdLink!.toId).toBe('c2');
  });

  it('rejects dependency that would create a cycle', () => {
    const c1 = commitment('c1');
    const c2 = commitment('c2');
    const existingLink = link('l1', 'requires', 'c2', 'c1');
    expect(() => {
      applyEdit('c1', { dependencyId: 'c2' }, [c1, c2], [existingLink], () => {}, () => {});
    }).toThrow('cycle');
  });

  it('removes old dependency link when setting new one', () => {
    const c1 = commitment('c1');
    const c2 = commitment('c2');
    const c3 = commitment('c3');
    const oldLink = link('l1', 'requires', 'c1', 'c2');
    let createdLink: Link | null = null;
    const result = applyEdit(
      'c1',
      { dependencyId: 'c3' },
      [c1, c2, c3],
      [oldLink],
      () => {},
      (l) => {
        createdLink = l;
      },
    );
    expect(result.links).not.toContain(oldLink);
    expect(createdLink!.toId).toBe('c3');
  });

  it('clears dependency when dependencyId is null', () => {
    const c1 = commitment('c1');
    const c2 = commitment('c2');
    const oldLink = link('l1', 'requires', 'c1', 'c2');
    const result = applyEdit('c1', { dependencyId: null }, [c1, c2], [oldLink], () => {}, () => {});
    expect(result.links).not.toContain(oldLink);
  });

  it('throws if node not found', () => {
    expect(() => {
      applyEdit('missing', { title: 'New' }, [], [], () => {}, () => {});
    }).toThrow('not found');
  });
});

describe('deleteNode', () => {
  it('removes the node and all links touching it', () => {
    const c1 = commitment('c1');
    const c2 = commitment('c2');
    const l1 = link('l1', 'requires', 'c1', 'c2');
    const l2 = link('l2', 'part_of', 'c2', 'goal');
    const l3 = link('l3', 'at', 'c1', 'place');
    const result = deleteNode('c1', [c1, c2], [l1, l2, l3]);
    expect(result.nodes).toEqual([c2]);
    expect(result.links).toEqual([l2]); // only l2 remains
  });

  it('removes a node with no links', () => {
    const c1 = commitment('c1');
    const c2 = commitment('c2');
    const result = deleteNode('c1', [c1, c2], []);
    expect(result.nodes).toEqual([c2]);
    expect(result.links).toEqual([]);
  });
});
