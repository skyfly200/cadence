import { describe, expect, it, vi } from 'vitest';
import {
  DELETION_WINDOW_MS, USER_DATA_TABLES, createMemoryPrivacyStore, createSupabasePrivacyStore,
  PURGE_BATCH, handleDeletion, handleGetAi, handlePurgeRun, handleSetAi, purgeDueDeletions,
} from './privacy';

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);
const deps = (store = createMemoryPrivacyStore(), now = T0) => ({ store, now: () => now });

describe('handleSetAi', () => {
  it('stores the switch for the signed-in user', async () => {
    const d = deps();
    expect(await handleSetAi(d, { userId: 'u1', body: { enabled: false } })).toEqual({ status: 200, body: { ok: true, enabled: false } });
    expect(d.store.aiEnabled.get('u1')).toBe(false);
  });
  it('rejects anything but a boolean', async () => {
    for (const body of [null, {}, { enabled: 'no' }, { enabled: 1 }]) {
      expect((await handleSetAi(deps(), { userId: 'u1', body })).status).toBe(400);
    }
  });
  it('answers calmly when the store fails', async () => {
    const d = deps();
    d.store.setAiEnabled = async () => { throw new Error('x'); };
    expect((await handleSetAi(d, { userId: 'u1', body: { enabled: true } })).status).toBe(503);
  });
});

describe('handleDeletion', () => {
  it('requests, reports the purge date 7 days out, and does not push the deadline back when asked twice', async () => {
    const d = deps();
    const r = await handleDeletion(d, { userId: 'u1', body: { action: 'request' } });
    expect(r).toEqual({ status: 200, body: { ok: true, pending: true, requestedAt: new Date(T0).toISOString(), purgeAt: new Date(T0 + DELETION_WINDOW_MS).toISOString() } });
    const again = await handleDeletion(deps(d.store, T0 + 1000), { userId: 'u1', body: { action: 'request' } });
    expect(again.status === 200 && again.body.requestedAt).toBe(new Date(T0).toISOString());
  });
  it('cancels a pending request (the undo)', async () => {
    const d = deps();
    await handleDeletion(d, { userId: 'u1', body: { action: 'request' } });
    expect(await handleDeletion(d, { userId: 'u1', body: { action: 'cancel' } })).toEqual({ status: 200, body: { ok: true, pending: false, requestedAt: null, purgeAt: null } });
    expect(d.store.deletions.size).toBe(0);
  });
  it('status reflects only the caller', async () => {
    const d = deps();
    await handleDeletion(d, { userId: 'u1', body: { action: 'request' } });
    const other = await handleDeletion(d, { userId: 'u2', body: { action: 'status' } });
    expect(other.status === 200 && other.body.pending).toBe(false);
  });
  it('allows a new request after a purge, and cannot cancel a purged one', async () => {
    const d = deps();
    await handleDeletion(d, { userId: 'u1', body: { action: 'request' } });
    await purgeDueDeletions(deps(d.store, T0 + DELETION_WINDOW_MS));
    await handleDeletion(deps(d.store, T0 + DELETION_WINDOW_MS + 1), { userId: 'u1', body: { action: 'cancel' } });
    expect(d.store.deletions.get('u1')?.purgedAt).not.toBeNull();
    const r = await handleDeletion(deps(d.store, T0 + DELETION_WINDOW_MS + 5), { userId: 'u1', body: { action: 'request' } });
    expect(r.status === 200 && r.body.pending).toBe(true);
  });
  it('rejects an unknown action', async () => {
    expect((await handleDeletion(deps(), { userId: 'u1', body: { action: 'nuke' } })).status).toBe(400);
  });
});

describe('purgeDueDeletions', () => {
  const seeded = () => createMemoryPrivacyStore({ tables: Object.fromEntries(USER_DATA_TABLES.map((t) => [t, ['u1', 'u2']])) });

  it('does nothing inside the 7-day window', async () => {
    const store = seeded();
    await store.requestDeletion('u1', new Date(T0).toISOString());
    expect(await purgeDueDeletions(deps(store, T0 + DELETION_WINDOW_MS - 1))).toEqual({ purged: 0 });
    expect(store.tables.cadence_nodes).toEqual(['u1', 'u2']);
  });
  it('after the window, deletes that user from every user-owned table and nobody else, and stamps the request', async () => {
    const store = seeded();
    await store.requestDeletion('u1', new Date(T0).toISOString());
    expect(await purgeDueDeletions(deps(store, T0 + DELETION_WINDOW_MS))).toEqual({ purged: 1 });
    for (const t of USER_DATA_TABLES) expect(store.tables[t]).toEqual(['u2']);
    expect(store.deletions.get('u1')?.purgedAt).toBe(new Date(T0 + DELETION_WINDOW_MS).toISOString());
    expect(await purgeDueDeletions(deps(store, T0 + DELETION_WINDOW_MS + 60_000))).toEqual({ purged: 0 }); // idempotent
  });
  it('never purges a request that was cancelled', async () => {
    const store = seeded();
    await handleDeletion(deps(store), { userId: 'u1', body: { action: 'request' } });
    await handleDeletion(deps(store), { userId: 'u1', body: { action: 'cancel' } });
    expect(await purgeDueDeletions(deps(store, T0 + 2 * DELETION_WINDOW_MS))).toEqual({ purged: 0 });
  });
  it('keeps going when one user fails', async () => {
    const store = seeded();
    await store.requestDeletion('u1', new Date(T0).toISOString());
    await store.requestDeletion('u2', new Date(T0).toISOString());
    const real = store.purgeUser;
    store.purgeUser = vi.fn(async (id, at) => { if (id === 'u1') throw new Error('x'); return real(id, at); });
    expect(await purgeDueDeletions(deps(store, T0 + DELETION_WINDOW_MS))).toEqual({ purged: 1 });
  });
});

describe('createSupabasePrivacyStore.purgeUser', () => {
  it('deletes by user_id from each user-owned table, then stamps purged_at', async () => {
    const calls: string[] = [];
    const db = {
      from: (t: string) => ({
        delete: () => ({ eq: (col: string, v: string) => { calls.push(`delete ${t} ${col}=${v}`); return Promise.resolve({ error: null }); } }),
        update: () => ({ eq: () => { calls.push(`stamp ${t}`); return Promise.resolve({ error: null }); } }),
      }),
    };
    await createSupabasePrivacyStore(db).purgeUser('u1', new Date(T0).toISOString());
    expect(calls.slice(0, -1)).toEqual(USER_DATA_TABLES.map((t) => `delete ${t} user_id=u1`));
    expect(calls.at(-1)).toBe('stamp deletion_requests');
  });
  it('does not stamp the request if a table failed, so the purge is retried', async () => {
    const db = {
      from: (t: string) => ({
        delete: () => ({ eq: () => Promise.resolve({ error: t === 'nudge_queue' ? new Error('x') : null }) }),
        update: () => ({ eq: () => { throw new Error('should not stamp'); } }),
      }),
    };
    await expect(createSupabasePrivacyStore(db).purgeUser('u1', 'x')).rejects.toThrow('nudge_queue');
  });
});

describe('handleGetAi', () => {
  it('reads the server switch: on by default, off after it was turned off', async () => {
    const d = deps();
    expect(await handleGetAi(d, { userId: 'u1' })).toEqual({ status: 200, body: { ok: true, enabled: true } });
    await handleSetAi(d, { userId: 'u1', body: { enabled: false } });
    expect(await handleGetAi(d, { userId: 'u1' })).toEqual({ status: 200, body: { ok: true, enabled: false } });
    expect(await handleGetAi(d, { userId: 'u2' })).toEqual({ status: 200, body: { ok: true, enabled: true } });
  });
  it('answers 503 when the store fails', async () => {
    const store = createMemoryPrivacyStore();
    store.getAiEnabled = async () => { throw new Error('x'); };
    expect((await handleGetAi(deps(store), { userId: 'u1' })).status).toBe(503);
  });
});

describe('purge batching and handlePurgeRun', () => {
  const due = (n: number) => {
    const store = createMemoryPrivacyStore();
    for (let i = 0; i < n; i++) store.deletions.set(`u${i}`, { requestedAt: new Date(T0 + i).toISOString(), purgedAt: null });
    return store;
  };
  it('purges at most one batch per call, oldest first, and the rest on the next call', async () => {
    const store = due(PURGE_BATCH + 2);
    const later = T0 + DELETION_WINDOW_MS + 1000;
    expect(await purgeDueDeletions(deps(store, later))).toEqual({ purged: PURGE_BATCH });
    expect(store.deletions.get('u0')?.purgedAt).not.toBeNull();
    expect(store.deletions.get(`u${PURGE_BATCH}`)?.purgedAt).toBeNull();
    expect(await purgeDueDeletions(deps(store, later))).toEqual({ purged: 2 });
  });
  it('rejects a wrong, missing or unconfigured secret without purging anything', async () => {
    const store = due(1);
    const d = { ...deps(store, T0 + DELETION_WINDOW_MS + 1000), cronSecret: 's3cret' };
    expect((await handlePurgeRun(d, { secret: 'nope' })).status).toBe(401);
    expect((await handlePurgeRun(d, { secret: null })).status).toBe(401);
    expect((await handlePurgeRun({ ...d, cronSecret: '' }, { secret: '' })).status).toBe(401);
    expect(store.deletions.get('u0')?.purgedAt).toBeNull();
  });
  it('purges with the right secret, with no web push configuration involved', async () => {
    const store = due(1);
    const d = { ...deps(store, T0 + DELETION_WINDOW_MS + 1000), cronSecret: 's3cret' };
    expect(await handlePurgeRun(d, { secret: 's3cret' })).toEqual({ status: 200, body: { ok: true, purged: 1 } });
  });
  it('answers 503 when the store cannot list what is due', async () => {
    const store = due(1);
    store.dueDeletions = async () => { throw new Error('x'); };
    expect((await handlePurgeRun({ ...deps(store), cronSecret: 's' }, { secret: 's' })).status).toBe(503);
  });
});
