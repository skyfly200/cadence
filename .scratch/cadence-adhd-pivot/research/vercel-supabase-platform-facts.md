# Research: Vercel, Supabase and Web Push platform facts for scheduling and nudges

Researched 2026-09-29. Ticket: `.scratch/cadence-adhd-pivot/tickets/20-research-vercel-supabase-platform-facts.md`.
Extends (does not repeat) `research/claude-chatgpt-integration.md` and `research/assistant-capture-feasibility.md` (both on their own branches): MCP OAuth spec summary, Claude connector auth requirements, `mcp-handler` basics.

Method note: pages were read through a summarising fetch tool. Quote marks are the tool's rendering, not guaranteed verbatim, except where a page came back as raw text (Vercel docs pages and Apple's web push page came back as raw markdown, so those are close to verbatim). "last_updated" is the date in Vercel page front matter. Supabase docs pages carry no date in the fetched text, so their currency is UNVERIFIED beyond "fetched 2026-09-29". UNVERIFIED = not confirmed on a first-party page. "Secondary" = not a first-party page.

## Bottom line

| Question | Answer |
|---|---|
| Can Vercel Hobby run nudge-style cron? | No. Hobby cron is once per day, with +/-59 min timing. Sub-daily expressions fail the deployment. |
| Vercel Pro cron | Once per minute minimum, per-minute precision, 100 crons/project, UTC only. Delivery best effort: can miss or duplicate. No retries. |
| Function duration (Fluid compute, default on) | Hobby 300 s default and max. Pro 300 s default, 800 s max, 1800 s beta per function. Non-Fluid legacy projects (before 2025-04-23): Hobby 60 s max, Pro 300 s. |
| LLM route constraint | Duration is fine on both plans. Active CPU is not billed while waiting on LLM I/O, but provisioned memory is. Hobby is non-commercial only. |
| Supabase scheduling | pg_cron (Postgres 15.1.1.61+ allows `'30 seconds'`), calling `net.http_post` (pg_net) to a Nitro route or Edge Function. Docs read show no Free-plan restriction, but Free projects pause after 7 days of low activity. |
| Web Push on iOS | Works for Home Screen web apps only (iOS 16.4+). Permission must be requested from a tap. Must show a notification for every push or Safari revokes permission. Declarative Web Push (iOS 18.4) removes that risk. |
| Supabase Auth as MCP authorization server | Exists (OAuth 2.1 server, beta, all plans, DCR supported, PKCE) but a public issue opened 2026-09-20 reports it fails the exact combination MCP connectors send (public client + `resource` + `offline_access`). CIMD not supported. Treat as not ready for Claude/ChatGPT/Gemini/Grok connectors. |
| Postgres for the Life graph | Fine at single-user scale. Recursive CTEs via an RPC function, plain btree indexes, pgvector without an index or with HNSW. Watch the 8 s `authenticated` statement timeout. |

## 1. Vercel: cron, duration, Fluid compute, LLM routes

### Cron (page last_updated 2026-07-15 usage/pricing, 2026-09-16 overview, 2026-08-11 manage)
Sources: https://vercel.com/docs/cron-jobs/usage-and-pricing , https://vercel.com/docs/cron-jobs , https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Table: Hobby, Pro and Enterprise all get 100 cron jobs per project. Minimum interval: Hobby once per day, Pro and Enterprise once per minute. Precision: Hobby per hour (+/-59 min), Pro per minute.
- Hobby: expressions that run more than once per day "will fail during deployment". A `0 1 * * *` job may fire anywhere from 1:00 to 1:59. Manage page: Vercel "may invoke these cron jobs at any point within the specified hour".
- Mechanism: Vercel makes an HTTP GET to the project's production deployment URL at the configured `path`. User agent `vercel-cron/1.0`, header `x-vercel-cron-schedule`. Timezone always UTC. No day-of-month plus day-of-week together. No `MON`/`JAN` names.
- Auth: set env `CRON_SECRET`; Vercel sends it as `Authorization: Bearer <secret>`.
- No retries: "Vercel will not retry an invocation if a cron job fails." Delivery is best effort and can be missed (no log created) or duplicated. Vercel says to make jobs idempotent and reconciliation-based (process everything since last success) and to guard against overlap with a lock.
- Cron duration limits are identical to Vercel Functions. Cron does not follow redirects. Not runnable under `vercel dev`.
- Cron invocations are ordinary function invocations, so plan usage and pricing apply.
- Nitro: https://nitro.build/deploy/providers/vercel says Nitro converts `scheduledTasks` config into Vercel Cron Jobs at build time, "No manual `vercel.json` cron configuration is required", and needs `CRON_SECRET`. Read via summariser; confirm with a build. Minimum Nitro version for Nuxt 3 is UNVERIFIED.

### Function duration and limits (last_updated 2026-08-24)
Sources: https://vercel.com/docs/functions/configuring-functions/duration , https://vercel.com/docs/functions/limitations , https://vercel.com/docs/fluid-compute
- Fluid compute is on by default for new projects since 2025-04-23. With it: Hobby default 300 s, max 300 s. Pro and Enterprise default 300 s, max 800 s (generally available), extended max 1800 s (30 min) in beta, only per function in code or `vercel.json`, only Node 20/22/24, Bun, Python, and not with Secure Compute or Static IPs.
- Projects deployed before 2025-04-23 not on Fluid (https://vercel.com/docs/limits, last_updated 2026-09-16): Hobby default 10 s max 60 s; Pro default 15 s max 300 s.
- Nitro config example on the duration page: `vercel: { functions: { maxDuration: 5 } }`. The Nitro Vercel page instead mentions `vercel.functionRules` per route. UNVERIFIED which key the installed Nitro version wants.
- Other limits: 2 GB memory on Hobby (4 GB on Pro), 250 MB uncompressed bundle, 4.5 MB request/response body, 1,024 shared file descriptors. Concurrency auto-scales to 30,000 on Hobby/Pro.
- Exceeding duration returns 504 `FUNCTION_INVOCATION_TIMEOUT`. Unlimited-duration work is pointed at Vercel Workflows (not researched here; the docs also list Vercel Queues).

### Background work after the response
Source: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package (last_updated 2026-09-03)
- `waitUntil()` from `@vercel/functions` (Next.js 15.1+ should use `after()`) extends the handler lifetime. "Promises passed to `waitUntil()` will have the same timeout as the function itself. If the function times out, the promises will be cancelled." `getDeadline()` returns when the invocation will be killed. Whether Nitro exposes `event.waitUntil` on the Vercel preset was not checked (UNVERIFIED).

### What constrains an LLM-calling route
Sources: https://vercel.com/docs/functions/usage-and-pricing (2026-06-16), https://vercel.com/docs/limits/fair-use-guidelines (2026-09-14)
- Active CPU is billed only during code execution, not I/O "like AI model calls". Provisioned memory is billed for the whole time a request is in flight, including I/O.
- Hobby includes 1,000,000 invocations, 4 hours Active CPU, 360 GB-hrs provisioned memory per month. Pro bills on demand (Active CPU from $0.128/hr in iad1, memory from $0.0106/GB-hr, $0.60 per million invocations) against a monthly credit. Pro plan price per seat not read (UNVERIFIED).
- Hobby is "restricted to non-commercial personal use only". Whether Cadence counts as commercial depends on plans to charge; if it will, Hobby is out.
- Duration cap (300 s) is well above typical LLM call time; a cron-triggered batch over many nodes should chunk work and be resumable, since cron does not retry. Streaming time counts toward duration.

## 2. Supabase scheduled work

Sources: https://supabase.com/docs/guides/cron , /cron/quickstart , /functions/schedule-functions , /functions/limits , /database/extensions/pg_net , /deployment/going-into-prod , https://supabase.com/pricing (no dates shown on any).
- pg_cron: SQL or an HTTP request (via pg_net) on a schedule. Standard 5-field cron, plus sub-minute `'30 seconds'` on Postgres 15.1.1.61+. All times GMT. Docs recommend no more than 8 concurrent jobs and jobs of no more than 10 minutes.
- Invoking HTTP: `select net.http_post(url, headers, body)` inside `cron.schedule`. The scheduling guide stores the project URL and key in Vault and calls `/functions/v1/<name>`. The same call can hit any HTTPS URL, such as a Nitro route on Vercel with a shared-secret header (not shown on the pages; standard pg_net use).
- pg_net: async, request runs after transaction commit. Default timeout 2000 ms (raising it per call is likely supported but not confirmed on the page read: UNVERIFIED). Designed for at most 200 requests/s. Responses kept 6 hours. "At-most-once" delivery: requests can be lost on unclean shutdown. Only POST/GET/DELETE with JSON.
- Edge Functions limits: memory 256 MB; wall-clock 150 s on Free, 400 s on paid; CPU time 2 s per request (async I/O such as LLM waits excluded); request idle timeout 150 s; function size 20 MB (CLI bundle) or 5 MB (dashboard); 100 functions Free, 1000 Pro. Deno runtime, so `web-push` npm needs testing there (UNVERIFIED).
- Free plan: 500 MB database, 500,000 Edge invocations, 50,000 MAU, 5 GB egress, "paused after 1 week of inactivity". Pro from $25/month: 8 GB, 2M Edge invocations, never paused.
- Free pausing matters: a nudge system run from pg_cron keeps the project "active" only if the platform counts cron traffic as activity (UNVERIFIED). A paused project stops all scheduled nudges. Pro removes this risk.

Options for Cadence:
1. pg_cron every minute (or 30 s) selects due rows from a nudge queue table, then `net.http_post` to one Nitro route (auth by secret header) that sends Web Push. Independent of the Vercel plan tier; wants Supabase Pro for reliability.
2. Vercel Cron on Pro, per-minute, to the same route. Simple and colocated, but best-effort delivery and UTC only. Use a reconciliation query ("everything due since last success") so a missed minute self-heals.
3. Daily pattern learning: either works, including Hobby (the +/-59 min drift is harmless for learning).
Do not rely on pg_net as an exactly-once transport; make the receiving route idempotent (queue row states such as `sent_at`).

## 3. Web Push for PWAs

### iOS and iPadOS
Sources: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers (raw text, Copyright 2026), https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ , https://webkit.org/blog/16535/meet-declarative-web-push/
- Web Push on iOS/iPadOS needs 16.4 or later and the site added to the Home Screen; manifest `display` `standalone` or `fullscreen`.
- Permission: ask "with a gesture, such as clicking or tapping a button" and call the push subscription method "immediately from the gesture's event handler code". No permission prompt on page load.
- "Safari doesn't support invisible push notifications. Present push notifications to the user immediately after your service worker receives them. If you don't, Safari revokes the push notification permission for your site." So a "silent data sync push" pattern is not available; every push must be a visible notification. Declarative Web Push (iOS/iPadOS 18.4, macOS 15.5 beta per the blog) sends a JSON payload with `"web_push": 8030` and a `notification` object (`title` and `navigate` required), needs no service worker, and the browser shows a fallback if JS fails.
- Delivery goes through APNs (`*.push.apple.com`), VAPID key pair required, RFC 8030 protocol, no Apple Developer Program membership needed. Headers: `TTL` (push service may store up to 30 days, storage while offline is limited, then dropped), `Urgency` (`very-low`/`low`/`normal`/`high`, use `high` to try immediate delivery), `Topic` (coalescing, max 32 chars). Don't refresh the VAPID JWT more than once per hour; JWT expiry at most one day ahead. Payload limit 4 KB (`PayloadTooLarge`). 410 means expired, 429 too many requests to one device. Badging via `navigator.setAppBadge`; users control badge permission in Notifications settings.
- Focus modes affect notifications (WebKit blog). Users can turn off notifications in Settings like any app.
- iOS 26: every site added to the Home Screen defaults to opening as a web app (secondary: search summaries of MobiLoud / MagicBell, not read; UNVERIFIED first-party).
- EU: secondary sources (The Register, 2024) say iOS 17.4 removed Home Screen web apps and push in the EU; that plan was later reported reversed. Current status UNVERIFIED. Only matters if EU users are in scope.
- Reliability: no first-party delivery-rate figures found. Design consequences: the user must install first, so the install step is part of onboarding; keep a fallback channel (in-app, email or calendar) for users who deny permission; use short TTLs for time-boxed nudges.

### Android and desktop Chrome
- MDN Push API (https://developer.mozilla.org/en-US/docs/Web/API/Push_API): needs a service worker and HTTPS; user opt-in; VAPID; RFC 8030; "widely available since March 2023" across modern browsers. Subscription endpoints are capability URLs: keep secret. Chrome: no message limits; Firefox has a quota for non-notifying pushes.
- Android does not require Home Screen install for Web Push in Chrome (implicit in MDN's requirements; no explicit first-party statement found: UNVERIFIED). Chrome's permission guidance page (developer.chrome.com/docs/web-platform/notifications/permissions) returned 404; not verified.
- Doze: https://developer.android.com/training/monitoring-device-state/doze-standby says FCM high-priority messages wake the device; normal priority are deferred to maintenance windows when in Doze. Chrome routes web push over FCM; that Web Push `Urgency: high` maps to FCM high priority is plausible but UNVERIFIED. RFC 8030 (https://www.rfc-editor.org/rfc/rfc8030) defines urgency semantics by device state (high = low battery / time-sensitive) and says a missing Urgency defaults to `normal`; zero TTL means immediate delivery only if the device is reachable. So set `Urgency: high` only for genuinely time-boxed nudges, and choose TTL to match the nudge's usefulness window.

### Sending from Nitro or Supabase
- Nitro (Node runtime on Vercel): the `web-push` npm library (https://github.com/web-push-libs/web-push; 3.6k stars, active CI) offers `generateVAPIDKeys()` and `sendNotification(subscription, payload, {TTL, urgency})`. Store `endpoint`, `p256dh`, `auth` per device. Delete subscriptions on 404/410 (the library returns `statusCode`; its README does not spell out 410 handling). Generate VAPID keys once; keep the private key in env.
- Supabase Edge Functions: Supabase's push guide covers only native FCM/Expo, not VAPID Web Push (https://supabase.com/docs/guides/functions/examples/push-notifications). Web Push from Deno is possible in principle (`npm:web-push` or hand-rolled RFC 8291 encryption) but not documented by Supabase: UNVERIFIED. Simplest: send from Nitro, triggered by pg_cron via `net.http_post`.
- Database webhooks/triggers can call a function when a row is inserted into a `notifications` table (pattern from Supabase's guide).

## 4. Supabase Auth as OAuth 2.1 authorization server for MCP connectors

Sources: https://supabase.com/docs/guides/auth/oauth-server (and /getting-started, /mcp-authentication, /oauth-flows, /token-security); https://github.com/supabase/auth/issues/2820 ; https://github.com/orgs/supabase/discussions/41695 ; https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel (2026-09-18); https://vercel.com/kb/guide/mcp-server-chatgpt-connector (2026-08-18).

What Supabase documents:
- OAuth 2.1 server, "in beta and available on all Supabase plans", no separate charge; sign-ins count toward MAU (per distinct user).
- Authorization code flow with PKCE; optional Dynamic Client Registration (toggle in dashboard or `allow_dynamic_registration` in config.toml); you build the consent page (Authorization Path, for example `/oauth/consent`; supabase-js `oauth.getAuthorizationDetails`, `approveAuthorization`, `denyAuthorization`).
- Endpoints: authorize `https://<ref>.supabase.co/auth/v1/oauth/authorize`, token `.../auth/v1/oauth/token` (form-urlencoded), JWKS `.../auth/v1/.well-known/jwks.json`, RFC 8414 metadata `https://<ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`, OIDC discovery `.../auth/v1/.well-known/openid-configuration`.
- Access token default 3600 s, authorization code 10 min, refresh tokens rotate. Access tokens carry a `client_id` claim; RLS can distinguish OAuth-client tokens from direct sessions with `(auth.jwt() ->> 'client_id') is null`. Scopes limited to openid/email/profile/phone and do not gate database access; RLS does. `audience` can be customised via Custom Access Token Hooks.
- Redirect URIs must match exactly.
- Supabase's MCP guide shows `@supabase/server` helpers `withOAuthProtectedResource()` and `withSupabase({auth:'user'})` for an Edge Function resource server.

What contradicts readiness (GitHub issues read via summariser; first-party repo but user reports, not maintainer statements):
- supabase/auth issue #2820, opened 2026-09-20, open, no maintainer reply visible: `GET /oauth/authorizations/{id}` returns 400 for public clients with PKCE, for `offline_access`, and when the RFC 8707 `resource` parameter is present; "Only one combination works: confidential client + `openid email profile` + no `resource`". MCP clients send `resource` and `offline_access`, so it is described as unusable for MCP connectors (reported against ChatGPT developer mode). One user's report; not reproduced here.
- Discussion #41695 (Jan 2026): CIMD support requested; no Supabase team reply; a community workaround is an OAuth bridge (mcp-sso) in front of Supabase Auth. Loopback redirect URIs must match port exactly (breaks RFC 8252).
- Docs do not mention RFC 8707 resource/audience binding for OAuth clients (the oauth-flows page read said so explicitly).
- Consequence versus prior research: Claude uses CIMD if the AS advertises it and otherwise falls back to DCR, and needs `resource`/`offline_access`/PKCE S256 and 401 `WWW-Authenticate` from the resource server. Supabase covers DCR and PKCE, but the reported `resource`/`offline_access`/public-client failure is a blocker. Retest on the current auth version before deciding; the report is 9 days old.
- The Vercel KB says the "2026-07-28 specification deprecates Dynamic Client Registration in favor of Client ID Metadata Documents" (summariser rendering; not checked against modelcontextprotocol.io in this pass). If true, DCR-only servers are on a deprecation path, which weakens Supabase's position further.

Alternatives on Vercel:
- `mcp-handler` v2 (2.1.1 in the docs) is a resource-server helper only: `withMcpAuth(handler, verifyToken, {required, requiredScopes, resourceMetadataPath})` and `protectedResourceHandler({authServerUrls, resourceUrl})` for `/.well-known/oauth-protected-resource`, plus `metadataCorsOptionsRequestHandler`. "The package does not issue tokens or run an authorization server." The docs example is Next.js App Router; a search snippet says the repo supports Nuxt and Svelte (UNVERIFIED). Vercel's KB has "How to build an MCP server with Nuxt" using the Nuxt MCP Toolkit (nuxt.com/blog/building-nuxt-mcp; not read in full). One search snippet warns Nuxt MCP middleware should not throw 401 on missing auth because that triggers OAuth discovery; decide the auth mode first.
- Pair it with an external authorization server that supports CIMD/DCR, PKCE, `resource`, `offline_access`. Candidates: a hosted provider (Clerk, WorkOS AuthKit, Auth0, Descope) or an open-source AS. Vercel's docs and KB name no specific provider, and none of those providers' MCP support was verified in this pass. Users would log in with Supabase identities only if the provider federates to them, adding complexity.
- Build a thin authorization server inside Nitro that reuses the Supabase session for login and consent, issues its own signed JWTs (audience = MCP URL), publishes RFC 8414 metadata with `client_id_metadata_document_supported: true`, accepts DCR as fallback, and rotates refresh tokens. Single-user makes it small but security-sensitive; endpoints must answer within Claude's 10 s / 30 s limits (prior note), fine on Fluid compute.
- Static bearer token: only where the client allows custom headers (Claude's static-header type is beta for limited orgs, per prior research). Not portable to the consumer apps.
- If Supabase-issued tokens are used anyway: verify with the JWKS endpoint and add RLS policies keyed on `client_id`; only after issue #2820 is fixed.

## 5. Postgres/Supabase for a personal graph

Sources: https://supabase.com/docs/guides/database/postgres/row-level-security , /database/postgres/timeouts , /ai/vector-columns , /ai/vector-indexes/hnsw-indexes , https://www.postgresql.org/docs/current/queries-with.html (PostgreSQL 18.6 docs).
- RLS: enabling RLS with no policies denies all API access for the publishable key. Performance guidance: use `(select auth.uid())` so it is evaluated once per statement; index columns used in policies (indexed column first in btree); always specify `to authenticated`; security definer functions can bypass RLS and avoid circular policy dependencies; views should use `security_invoker = true` (Postgres 15+); `service_role` bypasses RLS (needed for cron/push server code; keep its key server-side only).
- Append-only log: the page does not document it. With RLS, the standard approach is to grant `insert` and `select` and create only insert/select policies, so update/delete are denied for API roles. `service_role` and `postgres` bypass that, so it is a client-side guarantee, not tamper-proofing; a trigger raising on update/delete is stronger. UNVERIFIED on Supabase pages; standard Postgres behaviour.
- Recursive queries: `WITH RECURSIVE` (base term, `UNION`/`UNION ALL`, recursive term); evaluated iteratively; must terminate. Use `CYCLE id SET is_cycle USING path` (built in) or an array path to stop cycles; `SEARCH BREADTH|DEPTH FIRST` for ordering. PostgREST does not expose recursive CTEs; wrap them in a SQL function and call via `rpc()` (Supabase says the same for pgvector operators). RLS applies to the tables a function reads unless it is `security definer`; prefer `security invoker` and add `where user_id = (select auth.uid())` explicitly.
- Statement timeouts (Supabase docs): anon 3 s, authenticated 8 s, service_role none (falls back to the authenticator's 8 s if unset), postgres capped at 2 min; dashboard and client queries max-configurable 60 s; role-level change needs `NOTIFY pgrst, 'reload config'`. A traversal of a small personal graph takes milliseconds; cap depth anyway.
- pgvector: `create extension vector with schema extensions;`; operators `<=>` cosine, `<->` L2, `<#>` negative inner product; "embeddings with fewer dimensions perform best" (no hard limit on the page read). HNSW is "your default choice" for an index and can be built on an empty table; for small tables a sequential scan "may suffice". With a `WHERE user_id = ...` filter, a selective filter can return fewer results than asked; pgvector 0.8.0+ has iterative scans (`strict_order`/`relaxed_order`). For one user with thousands of nodes, skip the index at first.
- Size: Free 500 MB, Pro 8 GB included. An append-only occurrence log for one user is tiny; embeddings at 1536 dims are about 6 KB each (my arithmetic, 4 bytes per float), so 100k embeddings is roughly 600 MB, relevant on Free.
- Row-per-entity JSONB sync (from the brief): fine; index `(user_id, updated_at)` for sync pulls; GIN only if querying inside the JSONB; a typed `links(src, dst, type, user_id)` table with btree indexes on both endpoints keeps recursive CTEs cheap.

## 6. Decisions this feeds, and open items to verify by hand

1. Pick the plan: Hobby cannot run sub-daily cron and forbids commercial use. If nudges fire "at time X", use Supabase pg_cron (Pro to avoid pausing) or Vercel Pro cron.
2. Recommended scheduling shape: one `nudge_queue` table, pg_cron each minute calls one Nitro route; the route is idempotent and reconciling; LLM pattern learning is a separate daily route, chunked and resumable.
3. Web Push: plan for install-first on iOS (Home Screen, tap to subscribe, always show a notification); consider Declarative Web Push for iOS 18.4+ while keeping the service worker path for older iOS and Android.
4. MCP auth: do not commit to Supabase Auth as the AS until issue #2820 is re-tested; otherwise plan a thin Nitro AS or an external provider. Confirm the MCP spec version and CIMD/DCR expectations on modelcontextprotocol.io.
5. Verify by hand: Nitro cron conversion and the `maxDuration` key on the installed Nitro version; `event.waitUntil` on the Vercel preset; pg_net per-call timeout parameter; whether pg_cron traffic prevents Free-plan pausing; EU web push status; Android install requirement wording; Vercel Pro seat price; `web-push` inside Supabase Edge (Deno).
