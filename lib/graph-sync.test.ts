import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Commitment, Habit, Link, Occurrence } from './domain';
import {
  linkFromRow, linkToRow, mergeNewest, mergeOccurrences, nodeFromRow, nodeToRow, occurrenceFromRow, occurrenceToRow,
  pullGraph, pushGraph, resetGraphBaseline,
} from './graph-sync';
import {
  appendGraphOccurrences, getGraphLinks, getGraphNodes, getGraphOccurrences,
  saveGraphLinks, saveGraphNodes, saveGraphOccurrences,
} from './graph-storage';
import { exportAllData, getTasks, saveTasks } from './local-storage';
import { pullAll, pushAll, resetBaseline } from './sync';

// ── fakes ───────────────────────────────────────────────────

function stubBrowserStorage() {
  const store = new Map<string, string>();
  const ls = {
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  };
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('localStorage', ls);
  return store;
}

type Row = Record<string, any>;

/** In-memory stand-in for the Supabase client: just the calls the sync engine makes. */
class FakeDb {
  tables: Record<string, Row[]> = {};
  log: string[] = [];
  rows(t: string) { return (this.tables[t] ||= []); }
  seed(t: string, rows: Row[]) { this.rows(t).push(...rows); }

  from(table: string) {
    const db = this;
    return {
      select(_cols: string) {
        const q = { filters: [] as ((r: Row) => boolean)[], order: '', from: 0, to: Infinity };
        const run = () => {
          let out = db.rows(table).filter((r) => q.filters.every((f) => f(r)));
          if (q.order) out = [...out].sort((a, b) => (a[q.order] < b[q.order] ? -1 : a[q.order] > b[q.order] ? 1 : 0));
          db.log.push(`select ${table}`);
          return { data: out.slice(q.from, q.to + 1).map((r) => ({ ...r })), error: null };
        };
        const api: any = {
          eq(c: string, v: unknown) { q.filters.push((r) => r[c] === v); return api; },
          in(c: string, v: unknown[]) { q.filters.push((r) => v.includes(r[c])); return api; },
          order(c: string) { q.order = c; return api; },
          range(a: number, b: number) { q.from = a; q.to = b; return api; },
          async maybeSingle() { return { data: db.rows(table).filter((r) => q.filters.every((f) => f(r)))[0] ?? null, error: null }; },
          then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
        };
        return api;
      },
      upsert(payload: Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
        const run = () => {
          const keys = (opts.onConflict || 'id').split(',');
          for (const row of payload) {
            const rows = db.rows(table);
            const i = rows.findIndex((r) => keys.every((k) => r[k] === row[k]));
            if (i >= 0) {
              if (opts.ignoreDuplicates) { db.log.push(`ignore ${table}`); continue; }
              if (table === 'cadence_occurrences') return { data: null, error: { message: 'cadence_occurrences is append-only' } };
              rows[i] = { ...rows[i], ...row, updated_at: row.updated_at ?? new Date().toISOString() };
              db.log.push(`update ${table}`);
            } else {
              rows.push({ updated_at: new Date().toISOString(), ...row });
              db.log.push(`insert ${table}`);
            }
          }
          return { data: payload.map((r) => ({ key: r.key, updated_at: r.updated_at ?? 'now' })), error: null };
        };
        const api: any = {
          select() { return api; },
          then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
        };
        return api;
      },
      delete() {
        const filters: ((r: Row) => boolean)[] = [];
        const api: any = {
          eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return api; },
          in(c: string, v: unknown[]) { filters.push((r) => v.includes(r[c])); return api; },
          then: (res: any, rej: any) => {
            const run = () => {
              if (table === 'cadence_occurrences') return { data: null, error: null }; // owner deletes exist in the DB; the engine must not use them
              db.tables[table] = db.rows(table).filter((r) => !filters.every((f) => f(r)));
              db.log.push(`delete ${table}`);
              return { data: null, error: null };
            };
            return Promise.resolve(run()).then(res, rej);
          },
        };
        return api;
      },
    };
  }
}

const asClient = (db: FakeDb) => db as unknown as SupabaseClient;
const U = 'user-1';
const T0 = '2026-09-01T10:00:00.000Z';
const T1 = '2026-09-02T10:00:00.000Z';
const T2 = '2026-09-03T10:00:00.000Z';

const habit = (id: string, updatedAt = T1, title = 'Stretch'): Habit => ({
  id, kind: 'habit', title, private: false, createdAt: T0, updatedAt,
  recurrence: { period: 'week', target: 3 }, quiet: false,
});
const commitment = (id: string, updatedAt = T1): Commitment => ({
  id, kind: 'commitment', title: 'Load the car', private: true, createdAt: T0, updatedAt,
  fixedTime: T2, slog: true, quiet: false,
});
const link = (id: string, updatedAt = T1, over: Partial<Link> = {}): Link => ({
  id, type: 'part_of', fromId: 'n1', toId: 'n2', origin: 'proposed_accepted', confidence: 0.8,
  evidence: ['o1', 'took the cooler out 3 times'], createdAt: T0, updatedAt, ...over,
});
const occ = (id: string, over: Partial<Occurrence> = {}): Occurrence => ({ id, nodeId: 'n1', type: 'logged', at: T1, source: 'app', ...over });

let store: Map<string, string>;
beforeEach(() => { store = stubBrowserStorage(); resetBaseline(); resetGraphBaseline(); });
afterEach(() => { vi.unstubAllGlobals(); });

// ── mapping ─────────────────────────────────────────────────

describe('row mapping', () => {
  it('round-trips nodes and keeps kind and updated_at in columns', () => {
    for (const n of [habit('h1'), commitment('c1')]) {
      const row = nodeToRow(U, n);
      expect(row).toMatchObject({ user_id: U, id: n.id, kind: n.kind, updated_at: n.updatedAt });
      expect(nodeFromRow(row)).toEqual(n);
    }
  });

  it('maps links to the real columns, with snake_case types and origins unchanged', () => {
    const l = link('l1');
    const row = linkToRow(U, l);
    expect(row).toEqual({
      user_id: U, id: 'l1', type: 'part_of', from_id: 'n1', to_id: 'n2', origin: 'proposed_accepted',
      confidence: 0.8, evidence: ['o1', 'took the cooler out 3 times'], updated_at: T1,
    });
    expect(linkFromRow(row, l)).toEqual(l);
  });

  it('has no created_at column for links: createdAt falls back to updated_at when the link is new locally', () => {
    const row = linkToRow(U, link('l1', T2));
    expect(linkFromRow(row).createdAt).toBe(T2);
    expect(linkFromRow(row, link('l1', T1)).createdAt).toBe(T0);
  });

  it('round-trips occurrences, omitting null undoes and note', () => {
    const plain = occ('o1');
    expect(occurrenceToRow(U, plain)).toMatchObject({ undoes: null, note: null });
    expect(occurrenceFromRow(occurrenceToRow(U, plain))).toEqual(plain);
    const undo = occ('o2', { type: 'undone', undoes: 'o1', note: 'oops' });
    expect(occurrenceFromRow(occurrenceToRow(U, undo))).toEqual(undo);
  });
});

// ── merge rules ─────────────────────────────────────────────

describe('merge rules', () => {
  const ts = (x: { updatedAt?: string }) => x.updatedAt;
  it('newer wins, ties go to the cloud, local-only rows are kept', () => {
    const local = [habit('a', T2, 'local-newer'), habit('b', T1, 'local-tie'), habit('c', T0, 'local-only')];
    const server = [habit('a', T1, 'server-older'), habit('b', T1, 'server-tie'), habit('d', T1, 'server-only')];
    const merged = Object.fromEntries(mergeNewest(local, server, ts).map((h) => [h.id, h.title]));
    expect(merged).toEqual({ a: 'local-newer', b: 'server-tie', c: 'local-only', d: 'server-only' });
  });

  it('merges links by updatedAt', () => {
    const merged = mergeNewest([link('l', T0, { confidence: 0.1 })], [link('l', T1, { confidence: 0.9 })], ts);
    expect(merged[0]!.confidence).toBe(0.9);
  });

  it('occurrences are a union by id and a local row is never replaced', () => {
    const merged = mergeOccurrences([occ('o1', { note: 'local' })], [occ('o1', { note: 'server' }), occ('o2')]);
    expect(merged.map((o) => o.id).sort()).toEqual(['o1', 'o2']);
    expect(merged.find((o) => o.id === 'o1')!.note).toBe('local');
  });
});

// ── pull ────────────────────────────────────────────────────

describe('pullGraph', () => {
  it('merges server rows into local storage for all three tables', async () => {
    const db = new FakeDb();
    db.seed('cadence_nodes', [nodeToRow(U, habit('h1', T2, 'from cloud'))]);
    db.seed('cadence_links', [linkToRow(U, link('l1'))]);
    db.seed('cadence_occurrences', [occurrenceToRow(U, occ('o1'))]);
    saveGraphNodes([habit('h1', T0, 'old local'), commitment('c1')]);

    await pullGraph(asClient(db), U);

    const titles = Object.fromEntries(getGraphNodes().map((n) => [n.id, n.title]));
    expect(titles).toEqual({ h1: 'from cloud', c1: 'Load the car' });
    expect(getGraphLinks().map((l) => l.id)).toEqual(['l1']);
    expect(getGraphOccurrences().map((o) => o.id)).toEqual(['o1']);
  });

  it('reads past the 1000-row page limit', async () => {
    const db = new FakeDb();
    db.seed('cadence_occurrences', Array.from({ length: 2300 }, (_, i) => occurrenceToRow(U, occ(`o${String(i).padStart(5, '0')}`))));
    await pullGraph(asClient(db), U);
    expect(getGraphOccurrences()).toHaveLength(2300);
  });

  it('ignores rows that belong to another user', async () => {
    const db = new FakeDb();
    db.seed('cadence_nodes', [nodeToRow('someone-else', habit('x'))]);
    await pullGraph(asClient(db), U);
    expect(getGraphNodes()).toEqual([]);
  });
});

// ── push ────────────────────────────────────────────────────

describe('pushGraph', () => {
  it('upserts nodes and links and inserts new occurrences', async () => {
    const db = new FakeDb();
    saveGraphNodes([habit('h1')]);
    saveGraphLinks([link('l1')]);
    saveGraphOccurrences([occ('o1')]);
    await pushGraph(asClient(db), U);
    expect(db.rows('cadence_nodes')).toHaveLength(1);
    expect(db.rows('cadence_links')[0]).toMatchObject({ from_id: 'n1', to_id: 'n2', type: 'part_of' });
    expect(db.rows('cadence_occurrences')).toHaveLength(1);
  });

  it('deletes only rows that were on the server at the last pull and are now gone locally', async () => {
    const db = new FakeDb();
    db.seed('cadence_nodes', [nodeToRow(U, habit('a')), nodeToRow(U, habit('b'))]);
    db.seed('cadence_links', [linkToRow(U, link('la')), linkToRow(U, link('lb'))]);
    await pullGraph(asClient(db), U);
    // another device creates c after our pull
    db.seed('cadence_nodes', [nodeToRow(U, habit('c'))]);
    db.seed('cadence_links', [linkToRow(U, link('lc'))]);
    // we delete a and la locally
    saveGraphNodes(getGraphNodes().filter((n) => n.id !== 'a'));
    saveGraphLinks(getGraphLinks().filter((l) => l.id !== 'la'));

    await pushGraph(asClient(db), U);

    expect(db.rows('cadence_nodes').map((r) => r.id).sort()).toEqual(['b', 'c']);
    expect(db.rows('cadence_links').map((r) => r.id).sort()).toEqual(['lb', 'lc']);
  });

  it('never updates or deletes an occurrence, even when the local copy differs or is gone', async () => {
    const db = new FakeDb();
    db.seed('cadence_occurrences', [occurrenceToRow(U, occ('o1', { note: 'server original' }))]);
    saveGraphOccurrences([occ('o1', { note: 'local edit' }), occ('o2')]);

    await pushGraph(asClient(db), U); // would error in the fake if an UPDATE were attempted

    expect(db.rows('cadence_occurrences').find((r) => r.id === 'o1')!.note).toBe('server original');
    expect(db.rows('cadence_occurrences').map((r) => r.id).sort()).toEqual(['o1', 'o2']);

    saveGraphOccurrences([]); // drop everything locally
    await pushGraph(asClient(db), U);
    expect(db.rows('cadence_occurrences')).toHaveLength(2);
    expect(db.log.filter((l) => l.startsWith('update cadence_occurrences'))).toHaveLength(0);
  });

  it('only sends occurrences the server is not known to have after a pull', async () => {
    const db = new FakeDb();
    db.seed('cadence_occurrences', [occurrenceToRow(U, occ('o1'))]);
    await pullGraph(asClient(db), U);
    appendGraphOccurrences([occ('o2')]);
    db.log.length = 0;
    await pushGraph(asClient(db), U);
    expect(db.log.filter((l) => l.includes('cadence_occurrences'))).toEqual(['insert cadence_occurrences']);
  });

  it('accepts a link whose nodes are not on the server (no foreign keys, out-of-order push)', async () => {
    const db = new FakeDb();
    saveGraphLinks([link('l1', T1, { fromId: 'missing-a', toId: 'missing-b' })]);
    await expect(pushGraph(asClient(db), U)).resolves.toBeUndefined();
    expect(db.rows('cadence_links')).toHaveLength(1);
    expect(db.rows('cadence_nodes')).toHaveLength(0);
    // the nodes arrive later and the link is untouched
    saveGraphNodes([habit('missing-a'), habit('missing-b')]);
    await pushGraph(asClient(db), U);
    expect(db.rows('cadence_nodes')).toHaveLength(2);
    expect(db.rows('cadence_links')).toHaveLength(1);
  });
});

// ── storage ─────────────────────────────────────────────────

describe('graph storage', () => {
  it('appendGraphOccurrences leaves an existing id untouched', () => {
    appendGraphOccurrences([occ('o1', { note: 'first' })]);
    const fresh = appendGraphOccurrences([occ('o1', { note: 'second' }), occ('o2')]);
    expect(fresh.map((o) => o.id)).toEqual(['o2']);
    expect(getGraphOccurrences().find((o) => o.id === 'o1')!.note).toBe('first');
  });

  it('is included in the full backup export, and the Google token scrub still applies', () => {
    saveGraphNodes([habit('h1')]);
    store.set('cadence:googleCalendar', JSON.stringify({ connected: true, accessToken: 'secret', refreshToken: 'secret2', calendarEmail: 'a@b.c' }));
    const out = exportAllData() as Record<string, any>;
    expect(out['cadence:graphNodes']).toHaveLength(1);
    expect(JSON.stringify(out['cadence:googleCalendar'])).not.toContain('secret');
  });
});

// ── delete everything: sync holds and the cache is wiped ────

describe('delete everything', () => {
  const task = { id: 't1', title: 'mine', status: 'backlog', updatedAt: T1, createdAt: T0 } as any;
  beforeEach(() => { vi.stubGlobal('dispatchEvent', () => true); });

  it('while a request is pending, pushAll and pullAll do nothing and the local cache is cleared', async () => {
    const db = new FakeDb();
    db.seed('deletion_requests', [{ user_id: U, requested_at: T1, purged_at: null }]);
    db.seed('cadence_nodes', [nodeToRow(U, habit('server'))]);
    saveTasks([task]);
    saveGraphNodes([habit('h1')]);
    await pushAll(asClient(db), U);
    expect(db.rows('cadence_tasks')).toEqual([]);
    expect(db.rows('cadence_nodes')).toHaveLength(1); // only the seeded server row
    expect(getTasks()).toEqual([]);
    expect(getGraphNodes()).toEqual([]);
    await pullAll(asClient(db), U);
    expect(getGraphNodes()).toEqual([]);
  });

  it('after the purge, a device that never saw it wipes its stale cache once instead of re-uploading it', async () => {
    const db = new FakeDb();
    db.seed('deletion_requests', [{ user_id: U, requested_at: T0, purged_at: T2 }]);
    saveGraphNodes([habit('stale')]);
    await pushAll(asClient(db), U);
    expect(db.rows('cadence_nodes')).toEqual([]);
    expect(getGraphNodes()).toEqual([]);
    saveGraphNodes([habit('fresh')]); // new data after the purge syncs normally
    await pushAll(asClient(db), U);
    expect(db.rows('cadence_nodes')).toHaveLength(1);
  });

  it('with no request, sync is unchanged', async () => {
    const db = new FakeDb();
    saveTasks([task]);
    await pushAll(asClient(db), U);
    expect(db.rows('cadence_tasks')).toHaveLength(1);
  });
});

// ── existing collections still sync as before ───────────────

describe('existing collections', () => {
  const task = (id: string, updatedAt: string, title: string) => ({ id, title, status: 'backlog', updatedAt, createdAt: T0 }) as any;

  it('pushAll and pullAll still move tasks through { user_id, id, data }', async () => {
    const db = new FakeDb();
    saveTasks([task('t1', T1, 'local task')]);
    await pushAll(asClient(db), U);
    expect(db.rows('cadence_tasks')).toEqual([expect.objectContaining({ user_id: U, id: 't1', data: expect.objectContaining({ title: 'local task' }) })]);

    db.rows('cadence_tasks')[0]!.data = task('t1', T2, 'edited elsewhere');
    db.seed('cadence_tasks', [{ user_id: U, id: 't2', data: task('t2', T1, 'from other device') }]);
    await pullAll(asClient(db), U);
    expect(Object.fromEntries(getTasks().map((t: any) => [t.id, t.title]))).toEqual({ t1: 'edited elsewhere', t2: 'from other device' });
  });

  it('pushAll also pushes the graph in the same call', async () => {
    const db = new FakeDb();
    saveGraphNodes([habit('h1')]);
    await pushAll(asClient(db), U);
    expect(db.rows('cadence_nodes')).toHaveLength(1);
  });
});
