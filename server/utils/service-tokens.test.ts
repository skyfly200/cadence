import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createMemoryServiceTokenStore, createServiceVault } from './service-tokens';

const key = randomBytes(32);

describe('service vault', () => {
  it('round-trips a token, keeps the label readable and the token encrypted', async () => {
    const store = createMemoryServiceTokenStore();
    const vault = createServiceVault(store, key);
    await vault.save('u1', 'github', { token: 'secret-token', label: 'me' });
    expect(store.rows.get('u1:github')).toEqual({ blob: expect.not.stringContaining('secret-token'), label: 'me' });
    expect(await vault.load('u1', 'github')).toEqual({ token: 'secret-token', label: 'me' });
    expect(await vault.status('u1', 'github')).toEqual({ connected: true, label: 'me' });
    expect(await vault.status('u1', 'vercel')).toEqual({ connected: false, label: null });
  });

  it('keeps services and users apart: a blob moved to another row fails to decrypt', async () => {
    const store = createMemoryServiceTokenStore();
    const vault = createServiceVault(store, key);
    await vault.save('u1', 'github', { token: 't', label: 'me' });
    const row = store.rows.get('u1:github')!;
    await store.put('u1', 'netlify', row);
    await store.put('u2', 'github', row);
    await expect(vault.load('u1', 'netlify')).rejects.toThrow();
    await expect(vault.load('u2', 'github')).rejects.toThrow();
  });

  it('removes one service without touching another', async () => {
    const vault = createServiceVault(createMemoryServiceTokenStore(), key);
    await vault.save('u1', 'github', { token: 'a', label: 'gh' });
    await vault.save('u1', 'vercel', { token: 'b', label: 'vc' });
    await vault.remove('u1', 'github');
    expect(await vault.load('u1', 'github')).toBeNull();
    expect(await vault.load('u1', 'vercel')).toEqual({ token: 'b', label: 'vc' });
  });
});
