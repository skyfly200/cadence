import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createMemoryServiceTokenStore, createServiceVault } from './service-tokens';
import {
  digestQuery, digestToContext, githubContextSource, handleConnect, handleDigest, handleDisconnect, handleSearch, handleStatus,
  type GithubDeps, type GithubDigest,
} from './github';

const key = randomBytes(32);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function setup(route: (url: string, init?: RequestInit) => Response | Promise<Response>, saved?: { token: string; label: string }) {
  const store = createMemoryServiceTokenStore();
  const vault = createServiceVault(store, key);
  if (saved) await vault.save('u1', 'github', saved);
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => route(String(url), init));
  const deps: GithubDeps = { vault, fetch: f as unknown as typeof fetch };
  return { deps, f, store, vault };
}
const SAVED = { token: 'github_pat_abc', label: 'skyfly200' };

const pr = (n: number, extra: Record<string, unknown> = {}) => ({
  number: n, title: `PR ${n}`, url: `https://github.com/skyfly200/cadence/pull/${n}`, updatedAt: '2026-10-17T10:00:00Z',
  isDraft: false, author: { login: 'alice' }, repository: { nameWithOwner: 'skyfly200/cadence' }, ...extra,
});
const GRAPHQL = {
  data: {
    review: { issueCount: 1, nodes: [pr(12)] },
    mine: {
      issueCount: 2,
      nodes: [
        pr(3, { author: { login: 'skyfly200' }, reviewDecision: 'CHANGES_REQUESTED', mergeable: 'CONFLICTING', commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] } }),
        pr(4, { author: { login: 'skyfly200' }, isDraft: true, reviewDecision: null, mergeable: 'MERGEABLE', commits: { nodes: [{ commit: { statusCheckRollup: null } }] } }),
      ],
    },
    assigned: { issueCount: 0, nodes: [] },
  },
};

describe('handleConnect', () => {
  it('checks the token with GitHub, then stores it encrypted under the login', async () => {
    const { deps, f, store, vault } = await setup(() => json({ login: 'skyfly200' }));
    const r = await handleConnect(deps, { userId: 'u1', body: { token: '  github_pat_abc  ' } });
    expect(r).toEqual({ status: 200, body: { ok: true, login: 'skyfly200' } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/user');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer github_pat_abc');
    expect(init.method).toBeUndefined();
    const row = store.rows.get('u1:github')!;
    expect(row.label).toBe('skyfly200');
    expect(row.blob).not.toContain('github_pat_abc');
    expect(await vault.load('u1', 'github')).toEqual(SAVED);
  });

  it('refuses a token GitHub rejects, and stores nothing', async () => {
    const { deps, store } = await setup(() => json({ message: 'Bad credentials' }, 401));
    const r = await handleConnect(deps, { userId: 'u1', body: { token: 'nope' } });
    expect(r).toMatchObject({ status: 400, body: { error: 'bad_token' } });
    expect(store.rows.size).toBe(0);
  });

  it('refuses an empty or malformed token without calling GitHub', async () => {
    const { deps, f } = await setup(() => json({ login: 'x' }));
    for (const body of [null, {}, { token: '' }, { token: 'two words' }, { token: 'x'.repeat(301) }, { token: 5 }]) {
      expect(await handleConnect(deps, { userId: 'u1', body })).toMatchObject({ status: 400, body: { error: 'invalid' } });
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('says GitHub is unavailable when it errors or cannot be reached', async () => {
    const { deps } = await setup(() => json({}, 500));
    expect(await handleConnect(deps, { userId: 'u1', body: { token: 't' } })).toMatchObject({ status: 502, body: { error: 'github_failed' } });
    const down = await setup(() => { throw new Error('offline'); });
    expect(await handleConnect(down.deps, { userId: 'u1', body: { token: 't' } })).toMatchObject({ status: 502 });
  });

  it('never stores a login that could change a search query', async () => {
    const { deps, store } = await setup(() => json({ login: 'x review-requested:other' }));
    expect(await handleConnect(deps, { userId: 'u1', body: { token: 't' } })).toMatchObject({ status: 502 });
    expect(store.rows.size).toBe(0);
  });
});

describe('handleStatus and handleDisconnect', () => {
  it('reports the login without decrypting or returning the token, and forgets it on disconnect', async () => {
    const { deps } = await setup(() => json({}), SAVED);
    const s = await handleStatus(deps, 'u1');
    expect(s).toEqual({ connected: true, login: 'skyfly200' });
    expect(JSON.stringify(s)).not.toContain('github_pat');
    expect(await handleDisconnect(deps, 'u1')).toEqual({ ok: true });
    expect(await handleStatus(deps, 'u1')).toEqual({ connected: false, login: null });
  });
});

describe('handleDigest', () => {
  it('reads the three lists in one GraphQL request and maps CI, review and conflict state', async () => {
    const { deps, f } = await setup(() => json(GRAPHQL), SAVED);
    const r = await handleDigest(deps, 'u1');
    expect(r.status).toBe(200);
    const d = (r.body as { digest: GithubDigest }).digest;
    expect(d.reviewRequested).toEqual({ count: 1, items: [expect.objectContaining({ repo: 'skyfly200/cadence', number: 12, author: 'alice' })] });
    expect(d.myPullRequests.items[0]).toMatchObject({ number: 3, checks: 'failing', review: 'changes_requested', conflict: true, draft: false });
    expect(d.myPullRequests.items[1]).toMatchObject({ number: 4, checks: null, review: null, conflict: false, draft: true });
    expect(d.assigned).toEqual({ count: 0, items: [] });

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/graphql');
    const query = JSON.parse(String(init.body)).query as string;
    expect(query).toContain('review-requested:skyfly200');
    expect(query).toContain('author:skyfly200');
    expect(query).toContain('assignee:skyfly200');
    expect(query).not.toMatch(/mutation/);
  });

  it('asks to connect when nothing is saved', async () => {
    const { deps, f } = await setup(() => json(GRAPHQL));
    expect(await handleDigest(deps, 'u1')).toMatchObject({ status: 409, body: { error: 'not_connected' } });
    expect(f).not.toHaveBeenCalled();
  });

  it('forgets a token GitHub no longer accepts and asks to reconnect', async () => {
    const { deps, store } = await setup(() => json({ message: 'Bad credentials' }, 401), SAVED);
    expect(await handleDigest(deps, 'u1')).toMatchObject({ status: 409, body: { error: 'reauth' } });
    expect(store.rows.size).toBe(0);
  });

  it('keeps the token when GitHub only has a bad moment', async () => {
    const { deps, store } = await setup(() => json({}, 502), SAVED);
    expect(await handleDigest(deps, 'u1')).toMatchObject({ status: 502, body: { error: 'github_failed' } });
    expect(store.rows.size).toBe(1);
    const noData = await setup(() => json({ errors: [{ message: 'x' }] }), SAVED);
    expect(await handleDigest(noData.deps, 'u1')).toMatchObject({ status: 502 });
  });
});

describe('handleSearch', () => {
  const ISSUES = {
    items: [{ number: 7, title: 'Venue address', html_url: 'https://github.com/o/r/issues/7', repository_url: 'https://api.github.com/repos/o/r', updated_at: '2026-10-01T00:00:00Z', user: { login: 'sam' } }],
  };

  it('searches only what the person is involved in', async () => {
    const { deps, f } = await setup(() => json(ISSUES), SAVED);
    const r = await handleSearch(deps, { userId: 'u1', query: 'venue' });
    expect(r).toEqual({ status: 200, body: { ok: true, items: [{ repo: 'o/r', number: 7, title: 'Venue address', url: 'https://github.com/o/r/issues/7', updatedAt: '2026-10-01T00:00:00Z', author: 'sam' }] } });
    const url = new URL(String(f.mock.calls[0]![0]));
    expect(url.pathname).toBe('/search/issues');
    expect(url.searchParams.get('q')).toBe('venue involves:skyfly200');
  });

  it('refuses an empty or overlong query without calling GitHub', async () => {
    const { deps, f } = await setup(() => json(ISSUES), SAVED);
    for (const query of ['', '   ', 'x'.repeat(201), undefined, 3]) {
      expect(await handleSearch(deps, { userId: 'u1', query })).toMatchObject({ status: 400 });
    }
    expect(f).not.toHaveBeenCalled();
  });
});

describe('digestToContext', () => {
  it('writes counts and the newest few items as compact lines', () => {
    const digest: GithubDigest = {
      login: 'skyfly200',
      reviewRequested: { count: 1, items: [{ repo: 'o/r', number: 12, title: 'Add  login\nflow', url: 'u', updatedAt: '', author: 'alice' }] },
      myPullRequests: { count: 1, items: [{ repo: 'o/r', number: 3, title: 'Fix', url: 'u', updatedAt: '', draft: false, checks: 'failing', review: 'changes_requested', conflict: true }] },
      assigned: { count: 0, items: [] },
    };
    expect(digestToContext(digest)).toBe([
      'GitHub (skyfly200):',
      'Pull requests waiting on their review (1):',
      '- o/r#12 "Add login flow" by alice',
      'Their open pull requests (1):',
      '- o/r#3 "Fix" (CI failing, merge conflict, changes requested)',
    ].join('\n'));
  });

  it('says so when nothing is open', () => {
    const empty = { count: 0, items: [] };
    expect(digestToContext({ login: 'me', reviewRequested: empty, myPullRequests: empty, assigned: empty })).toBe('GitHub (me): nothing open needs them.');
  });

  it('only builds queries from a validated login', () => {
    expect(digestQuery('skyfly200')).toContain('"is:open archived:false sort:updated-desc is:pr review-requested:skyfly200"');
  });
});

describe('githubContextSource', () => {
  it('gives the always-on summary and pull-in-more search, or null when not connected', async () => {
    const { deps } = await setup((url) => (url.endsWith('/graphql') ? json(GRAPHQL) : json({ items: [] })), SAVED);
    const src = githubContextSource(deps);
    expect(src.id).toBe('github');
    expect(await src.summary('u1')).toContain('skyfly200/cadence#12');
    expect(await src.search!('u1', 'anything')).toBe('No matching GitHub issues or pull requests.');
    expect(await src.summary('nobody')).toBeNull();
    expect(await src.search!('nobody', 'x')).toBeNull();
  });
});
