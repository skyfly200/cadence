/**
 * GitHub: what needs the person on GitHub, read with their own access token (a fine-grained,
 * read-only personal access token is the recommended kind). Framework-free with `fetch`
 * injected, so it is testable without a network.
 *
 * Rules: the token is stored encrypted on the server (service-tokens.ts) and never returned to
 * the browser; every call here is a read; only titles, numbers, repo names, links and states
 * leave this file. GitHub text (titles, repo names) is data, never instructions, wherever it ends
 * up, including an AI prompt.
 */
import type { ServiceVault } from './service-tokens';

type Fetch = typeof fetch;

export const GITHUB_API = 'https://api.github.com';
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  // GitHub rejects API requests without a User-Agent.
  'User-Agent': 'cadence',
};
const LIST_SIZE = 20;
const MAX_TOKEN = 300;
export const MAX_QUERY = 200;

export interface GithubDeps { vault: ServiceVault; fetch: Fetch }

export interface GithubItem {
  repo: string;
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  author?: string;
  draft?: boolean;
  /** The latest commit's combined checks, when GitHub reports them. */
  checks?: 'passing' | 'failing' | 'pending' | null;
  review?: 'approved' | 'changes_requested' | 'review_required' | null;
  conflict?: boolean;
}

export interface GithubList { count: number; items: GithubItem[] }

export interface GithubDigest {
  login: string;
  /** Open pull requests that ask for the person's review. */
  reviewRequested: GithubList;
  /** The person's own open pull requests. */
  myPullRequests: GithubList;
  /** Open issues assigned to the person. */
  assigned: GithubList;
}

const auth = (token: string) => ({ ...HEADERS, Authorization: `Bearer ${token}` });

/** GitHub logins are letters, digits and single hyphens; anything else never reaches a query. */
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** Who a token belongs to, or why it can't be used. */
export async function verifyToken(fetchFn: Fetch, token: string): Promise<{ ok: true; login: string } | { ok: false; reason: 'bad_token' | 'github_failed' }> {
  let res: Response;
  try { res = await fetchFn(`${GITHUB_API}/user`, { headers: auth(token) }); } catch { return { ok: false, reason: 'github_failed' }; }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: 'bad_token' };
  if (!res.ok) return { ok: false, reason: 'github_failed' };
  const login = (await res.json())?.login;
  return typeof login === 'string' && LOGIN.test(login) ? { ok: true, login } : { ok: false, reason: 'github_failed' };
}

const PR_FIELDS = 'number title url updatedAt isDraft author { login } repository { nameWithOwner }';
const search = (alias: string, query: string, fields: string) =>
  `${alias}: search(type: ISSUE, first: ${LIST_SIZE}, query: ${JSON.stringify(query)}) { issueCount nodes { ${fields} } }`;

/** One GraphQL request for the three lists, newest activity first. `login` is already validated. */
export function digestQuery(login: string): string {
  const base = 'is:open archived:false sort:updated-desc';
  return `query { ${[
    search('review', `${base} is:pr review-requested:${login}`, `... on PullRequest { ${PR_FIELDS} }`),
    search('mine', `${base} is:pr author:${login}`,
      `... on PullRequest { ${PR_FIELDS} reviewDecision mergeable commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } }`),
    search('assigned', `${base} is:issue assignee:${login}`, '... on Issue { number title url updatedAt repository { nameWithOwner } }'),
  ].join(' ')} }`;
}

const CHECKS: Record<string, GithubItem['checks']> = {
  SUCCESS: 'passing', FAILURE: 'failing', ERROR: 'failing', PENDING: 'pending', EXPECTED: 'pending',
};
const REVIEW: Record<string, GithubItem['review']> = {
  APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested', REVIEW_REQUIRED: 'review_required',
};

function toItem(n: any): GithubItem | null {
  if (!n || typeof n.number !== 'number' || typeof n.title !== 'string' || typeof n.url !== 'string') return null;
  const item: GithubItem = {
    repo: String(n.repository?.nameWithOwner ?? ''),
    number: n.number,
    title: n.title,
    url: n.url,
    updatedAt: String(n.updatedAt ?? ''),
  };
  if (typeof n.author?.login === 'string') item.author = n.author.login;
  if (typeof n.isDraft === 'boolean') item.draft = n.isDraft;
  if ('commits' in n) item.checks = CHECKS[n.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state] ?? null;
  if ('reviewDecision' in n) item.review = REVIEW[n.reviewDecision] ?? null;
  if ('mergeable' in n) item.conflict = n.mergeable === 'CONFLICTING';
  return item;
}

const toList = (s: any): GithubList => {
  const items = Array.isArray(s?.nodes) ? s.nodes.map(toItem).filter((i: GithubItem | null): i is GithubItem => !!i) : [];
  return { count: typeof s?.issueCount === 'number' ? s.issueCount : items.length, items };
};

export type GithubCallError = 'bad_token' | 'github_failed';

export async function fetchDigest(fetchFn: Fetch, token: string, login: string): Promise<{ ok: true; digest: GithubDigest } | { ok: false; reason: GithubCallError }> {
  if (!LOGIN.test(login)) return { ok: false, reason: 'github_failed' };
  let res: Response;
  try {
    res = await fetchFn(`${GITHUB_API}/graphql`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: digestQuery(login) }),
    });
  } catch { return { ok: false, reason: 'github_failed' }; }
  if (res.status === 401) return { ok: false, reason: 'bad_token' };
  if (!res.ok) return { ok: false, reason: 'github_failed' };
  const body = await res.json().catch(() => null);
  // GraphQL reports partial failures in `errors` with whatever data it could read; use what came back.
  if (!body?.data) return { ok: false, reason: 'github_failed' };
  return {
    ok: true,
    digest: { login, reviewRequested: toList(body.data.review), myPullRequests: toList(body.data.mine), assigned: toList(body.data.assigned) },
  };
}

const ref = (i: GithubItem) => `${i.repo}#${i.number}`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

function prState(i: GithubItem): string {
  const bits: string[] = [];
  if (i.draft) bits.push('draft');
  if (i.checks === 'failing') bits.push('CI failing');
  else if (i.checks === 'pending') bits.push('CI running');
  else if (i.checks === 'passing') bits.push('CI green');
  if (i.conflict) bits.push('merge conflict');
  if (i.review === 'changes_requested') bits.push('changes requested');
  else if (i.review === 'approved') bits.push('approved');
  else if (i.review === 'review_required') bits.push('awaiting review');
  return bits.length ? ` (${bits.join(', ')})` : '';
}

/**
 * The digest as a few compact lines for an AI prompt's always-on context: counts plus the
 * newest few of each list. The caller wraps it in its own data tags.
 */
export function digestToContext(d: GithubDigest, perList = 5): string {
  const line = (i: GithubItem, extra = '') => `- ${ref(i)} "${clip(oneLine(i.title), 120)}"${extra}`;
  const section = (label: string, l: GithubList, extra: (i: GithubItem) => string) =>
    l.count === 0 ? [] : [`${label} (${l.count}):`, ...l.items.slice(0, perList).map((i) => line(i, extra(i)))];
  const lines = [
    ...section('Pull requests waiting on their review', d.reviewRequested, (i) => (i.author ? ` by ${i.author}` : '')),
    ...section('Their open pull requests', d.myPullRequests, prState),
    ...section('Issues assigned to them', d.assigned, () => ''),
  ];
  return lines.length ? [`GitHub (${d.login}):`, ...lines].join('\n') : `GitHub (${d.login}): nothing open needs them.`;
}

/**
 * Search issues and pull requests the person is involved in (author, assignee, mentioned,
 * commented or review requested), for "pull in more" when a conversation needs it.
 */
export async function searchInvolved(fetchFn: Fetch, token: string, login: string, query: string): Promise<{ ok: true; items: GithubItem[] } | { ok: false; reason: GithubCallError | 'bad_query' }> {
  const q = oneLine(query);
  if (!q || q.length > MAX_QUERY) return { ok: false, reason: 'bad_query' };
  if (!LOGIN.test(login)) return { ok: false, reason: 'github_failed' };
  const params = new URLSearchParams({ q: `${q} involves:${login}`, sort: 'updated', order: 'desc', per_page: '10' });
  let res: Response;
  try { res = await fetchFn(`${GITHUB_API}/search/issues?${params}`, { headers: auth(token) }); } catch { return { ok: false, reason: 'github_failed' }; }
  if (res.status === 401) return { ok: false, reason: 'bad_token' };
  if (!res.ok) return { ok: false, reason: 'github_failed' };
  const body = await res.json().catch(() => null);
  const items = (Array.isArray(body?.items) ? body.items : []).map((n: any): GithubItem | null => {
    if (typeof n?.number !== 'number' || typeof n?.title !== 'string' || typeof n?.html_url !== 'string') return null;
    // repository_url is https://api.github.com/repos/<owner>/<name>
    const repo = String(n.repository_url ?? '').split('/repos/')[1] ?? '';
    return { repo, number: n.number, title: n.title, url: n.html_url, updatedAt: String(n.updated_at ?? ''), ...(typeof n.user?.login === 'string' ? { author: n.user.login } : {}) };
  }).filter((i: GithubItem | null): i is GithubItem => !!i);
  return { ok: true, items };
}

// ── route handlers ─────────────────────────────────────────────

type Fail = { ok: false; error: string; message: string };
const fail = <S extends number>(status: S, error: string, message: string) => ({ status, body: { ok: false as const, error, message } });
const RECONNECT = 'GitHub no longer accepts the saved token. Connect again with a new one.';
const UNAVAILABLE = 'GitHub did not answer just now. Try again in a moment.';

/** Body: { token }. Checks the token with GitHub, then stores it encrypted with the login as its label. */
export async function handleConnect(deps: GithubDeps, input: { userId: string; body: unknown }):
  Promise<{ status: 200; body: { ok: true; login: string } } | { status: 400 | 502; body: Fail }> {
  const token = (input.body as { token?: unknown } | null)?.token;
  if (typeof token !== 'string' || !token.trim() || token.trim().length > MAX_TOKEN || /\s/.test(token.trim())) {
    return fail(400, 'invalid', 'Paste a GitHub token.');
  }
  const v = await verifyToken(deps.fetch, token.trim());
  if (!v.ok) return v.reason === 'bad_token' ? fail(400, 'bad_token', 'GitHub did not accept that token.') : fail(502, 'github_failed', UNAVAILABLE);
  await deps.vault.save(input.userId, 'github', { token: token.trim(), label: v.login });
  return { status: 200, body: { ok: true, login: v.login } };
}

export async function handleStatus(deps: Pick<GithubDeps, 'vault'>, userId: string): Promise<{ connected: boolean; login: string | null }> {
  const s = await deps.vault.status(userId, 'github');
  return { connected: s.connected, login: s.label };
}

/** Forgets the token. (GitHub has no API to revoke a personal access token; the person deletes it on GitHub.) */
export async function handleDisconnect(deps: Pick<GithubDeps, 'vault'>, userId: string): Promise<{ ok: true }> {
  await deps.vault.remove(userId, 'github');
  return { ok: true };
}

/** A rejected token is forgotten, so the app asks to connect again instead of failing forever. */
async function withToken<T>(deps: GithubDeps, userId: string, run: (token: string, login: string) => Promise<{ ok: true } & T | { ok: false; reason: string }>):
  Promise<{ status: 200; body: { ok: true } & T } | { status: 400 | 409 | 502; body: Fail }> {
  const saved = await deps.vault.load(userId, 'github');
  if (!saved) return fail(409, 'not_connected', 'GitHub is not connected.');
  const r = await run(saved.token, saved.label);
  if (r.ok) return { status: 200, body: r };
  if (r.reason === 'bad_token') {
    await deps.vault.remove(userId, 'github');
    return fail(409, 'reauth', RECONNECT);
  }
  if (r.reason === 'bad_query') return fail(400, 'invalid', 'Say what to look for.');
  return fail(502, 'github_failed', UNAVAILABLE);
}

export const handleDigest = (deps: GithubDeps, userId: string) =>
  withToken<{ digest: GithubDigest }>(deps, userId, (token, login) => fetchDigest(deps.fetch, token, login));

export const handleSearch = (deps: GithubDeps, input: { userId: string; query: unknown }) =>
  withToken<{ items: GithubItem[] }>(deps, input.userId, (token, login) =>
    searchInvolved(deps.fetch, token, login, typeof input.query === 'string' ? input.query : ''));

// ── context source ─────────────────────────────────────────────

/**
 * GitHub as a source for the conversation's layered context: `summary` is the small always-on
 * layer, `search` is the "pull in more" layer. Both return null when GitHub is not connected or
 * does not answer, so a conversation never fails because of it.
 */
export interface ContextSource {
  id: string;
  label: string;
  summary(userId: string): Promise<string | null>;
  search?(userId: string, query: string): Promise<string | null>;
}

export function githubContextSource(deps: GithubDeps): ContextSource {
  return {
    id: 'github',
    label: 'GitHub',
    async summary(userId) {
      const r = await handleDigest(deps, userId).catch(() => null);
      return r?.status === 200 ? digestToContext(r.body.digest) : null;
    },
    async search(userId, query) {
      const r = await handleSearch(deps, { userId, query }).catch(() => null);
      if (r?.status !== 200) return null;
      if (!r.body.items.length) return 'No matching GitHub issues or pull requests.';
      return r.body.items.map((i) => `- ${ref(i)} "${clip(oneLine(i.title), 120)}" (updated ${i.updatedAt.slice(0, 10)})`).join('\n');
    },
  };
}
