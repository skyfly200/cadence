import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  createMemoryTokenStore, createTokenVault, decryptJson, encryptJson, parseKey, signState, verifyState,
  type GoogleTokens,
} from './google-tokens';

const key = () => randomBytes(32);
const tokens: GoogleTokens = { accessToken: 'ya29.secret-access', refreshToken: '1//secret-refresh', expiresAt: 1_700_000_000_000, email: 'sky@example.com' };

/** Flip one character in the middle of a base64url segment so it still decodes. */
function tamper(part: string): string {
  const i = Math.floor(part.length / 2);
  return part.slice(0, i) + (part[i] === 'A' ? 'B' : 'A') + part.slice(i + 1);
}

describe('parseKey', () => {
  it('accepts 32 bytes of base64', () => {
    expect(parseKey(randomBytes(32).toString('base64'))).toHaveLength(32);
  });
  it('rejects missing, short and long keys with a clear message', () => {
    expect(() => parseKey(undefined)).toThrow(/not set/);
    expect(() => parseKey('')).toThrow(/not set/);
    expect(() => parseKey(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
    expect(() => parseKey(randomBytes(48).toString('base64'))).toThrow(/32 bytes/);
  });
});

describe('AES-256-GCM encryption', () => {
  it('round-trips a value', () => {
    const k = key();
    const blob = encryptJson(k, 'user-1', tokens);
    expect(decryptJson<GoogleTokens>(k, 'user-1', blob)).toEqual(tokens);
  });

  it('uses a fresh IV each time (same input, different blob)', () => {
    const k = key();
    expect(encryptJson(k, 'u', tokens)).not.toBe(encryptJson(k, 'u', tokens));
  });

  it('never contains the plaintext', () => {
    const blob = encryptJson(key(), 'u', tokens);
    expect(blob).not.toContain('secret-access');
    expect(blob).not.toContain('secret-refresh');
    expect(blob).not.toContain('sky@example.com');
  });

  it('fails when the ciphertext is modified', () => {
    const k = key();
    const [v, iv, tag, ct] = encryptJson(k, 'u', tokens).split('.');
    expect(() => decryptJson(k, 'u', [v, iv, tag, tamper(ct!)].join('.'))).toThrow();
  });

  it('fails when the auth tag is modified', () => {
    const k = key();
    const [v, iv, tag, ct] = encryptJson(k, 'u', tokens).split('.');
    expect(() => decryptJson(k, 'u', [v, iv, tamper(tag!), ct].join('.'))).toThrow();
  });

  it('fails when the IV is modified', () => {
    const k = key();
    const [v, iv, tag, ct] = encryptJson(k, 'u', tokens).split('.');
    expect(() => decryptJson(k, 'u', [v, tamper(iv!), tag, ct].join('.'))).toThrow();
  });

  it('fails with the wrong key', () => {
    const blob = encryptJson(key(), 'u', tokens);
    expect(() => decryptJson(key(), 'u', blob)).toThrow();
  });

  it("fails for another user's id (a blob copied to another row is useless)", () => {
    const k = key();
    const blob = encryptJson(k, 'user-1', tokens);
    expect(() => decryptJson(k, 'user-2', blob)).toThrow();
  });

  it('rejects malformed or unknown-version blobs', () => {
    const k = key();
    expect(() => decryptJson(k, 'u', 'garbage')).toThrow();
    expect(() => decryptJson(k, 'u', 'v2.a.b.c')).toThrow(/Unsupported/);
    expect(() => decryptJson(k, 'u', 'v1.a.b')).toThrow();
  });
});

describe('token vault over the in-memory store', () => {
  it('saves ciphertext (never the tokens) and loads them back', async () => {
    const store = createMemoryTokenStore();
    const vault = createTokenVault(store, key());
    await vault.save('u1', tokens);
    const row = store.rows.get('u1')!;
    expect(row.blob.startsWith('v1.')).toBe(true);
    expect(JSON.stringify(row)).not.toContain('secret-refresh');
    expect(row.email).toBe('sky@example.com');
    expect(await vault.load('u1')).toEqual(tokens);
  });

  it('reports connection status without decrypting', async () => {
    const store = createMemoryTokenStore();
    const vault = createTokenVault(store, key());
    expect(await vault.status('u1')).toEqual({ connected: false, email: null });
    await vault.save('u1', tokens);
    expect(await vault.status('u1')).toEqual({ connected: true, email: 'sky@example.com' });
  });

  it('keeps users separate', async () => {
    const store = createMemoryTokenStore();
    const vault = createTokenVault(store, key());
    await vault.save('u1', tokens);
    expect(await vault.load('u2')).toBeNull();
  });

  it('overwrites on save and deletes on remove', async () => {
    const store = createMemoryTokenStore();
    const vault = createTokenVault(store, key());
    await vault.save('u1', tokens);
    await vault.save('u1', { ...tokens, accessToken: 'ya29.newer' });
    expect((await vault.load('u1'))!.accessToken).toBe('ya29.newer');
    await vault.remove('u1');
    expect(await vault.load('u1')).toBeNull();
    expect(store.rows.size).toBe(0);
  });

  it('cannot read a row with the wrong key', async () => {
    const store = createMemoryTokenStore();
    await createTokenVault(store, key()).save('u1', tokens);
    await expect(createTokenVault(store, key()).load('u1')).rejects.toThrow();
  });
});

describe('signed OAuth state', () => {
  const k = key();

  it('round-trips the user id', () => {
    expect(verifyState(k, signState(k, 'user-1'))).toBe('user-1');
  });

  it('rejects a state signed with a different key', () => {
    expect(verifyState(key(), signState(k, 'user-1'))).toBeNull();
  });

  it('rejects a tampered payload or signature', () => {
    const [payload, sig] = signState(k, 'user-1').split('.');
    expect(verifyState(k, `${tamper(payload!)}.${sig}`)).toBeNull();
    expect(verifyState(k, `${payload}.${tamper(sig!)}`)).toBeNull();
  });

  it('rejects a payload swapped to another user', () => {
    const [, sig] = signState(k, 'user-1').split('.');
    const other = signState(k, 'user-2').split('.')[0]!;
    expect(verifyState(k, `${other}.${sig}`)).toBeNull();
  });

  it('expires after ten minutes', () => {
    const t0 = 1_000_000;
    const s = signState(k, 'user-1', t0);
    expect(verifyState(k, s, t0 + 9 * 60_000)).toBe('user-1');
    expect(verifyState(k, s, t0 + 10 * 60_000 + 1)).toBeNull();
  });

  it('rejects empty and malformed input', () => {
    expect(verifyState(k, undefined)).toBeNull();
    expect(verifyState(k, '')).toBeNull();
    expect(verifyState(k, 'nodot')).toBeNull();
    expect(verifyState(k, 'a.b')).toBeNull();
  });

  it('is not interchangeable with token encryption (separate derived key)', () => {
    // A blob from encryptJson is never a valid state.
    expect(verifyState(k, encryptJson(k, 'user-1', { u: 'user-1', e: Date.now() + 1e6 }))).toBeNull();
  });
});
