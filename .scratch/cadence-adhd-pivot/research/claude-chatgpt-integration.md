# Research: Claude and ChatGPT as capture/voice targets and as LLM providers

Researched 2026-09-29. Ticket: `.scratch/cadence-adhd-pivot/tickets/18-research-claude-chatgpt-integration.md`.
Builds on `research/assistant-capture-feasibility.md` (branch `research/assistant-capture-feasibility`, Gemini/Grok/Siri) and `research/llm-and-memory-options.md` (branch `research/llm-and-memory-options`). Not repeated here: MCP OAuth spec summary, Claude/OpenAI model tables, gateways, memory, local inference.

Method note: pages were read through a summarising fetch tool, so quotes are paraphrases unless in quote marks, and quote marks are the tool's rendering of the page, not guaranteed verbatim. UNVERIFIED = not confirmed on a first-party page. Every `help.openai.com` page returned HTTP 403 to the fetcher, so OpenAI help-center and release-note claims come from secondary reports that quote them (flagged) or from developers.openai.com.

Hosting discrepancy to resolve: the brief says Cadence is on Vercel; the repo root has `netlify.toml` and no `vercel.json`, and the earlier capture note assumed Netlify. Section 4 covers both.

## Bottom line

| | Claude | ChatGPT |
|---|---|---|
| Add a custom remote MCP server today | Yes, Free (1 connector), Pro, Max, Team, Enterprise | Yes, via Developer mode: Plus, Pro, Business, Enterprise, Edu (Free excluded per secondary source only) |
| Set up on | claude.ai web/desktop (Customize > Connectors); use on web, desktop, mobile | Web only for setup; used afterwards on web and (secondary source) mobile |
| Auth | OAuth (CIMD or DCR, PKCE S256), authless, or static header (beta, limited orgs) | OAuth (CIMD preferred, DCR, predefined), none, or mixed; no static bearer documented for developer mode |
| Voice invokes custom connector, hands-free | Voice is hands-free by default, but custom connectors in voice are UNVERIFIED and one unresolved bug report says they fail | Live Voice supports plugins/connected apps as of 2026-09-23 (secondary); custom developer-mode apps in Voice UNVERIFIED; approvals are on-screen only |
| Per-write confirmation | Per-tool: Allow once / Always allow / Needs approval / Blocked; "Always allow" removes the prompt | Writes require confirmation by default; configurable per tool per conversation; annotations drive framing |
| Tap-free capture | Possible with Always allow (voice caveat above) | Not reliably: spoken approval unsupported; whether an additive tool skips the prompt is UNVERIFIED |

Recommendation: one Streamable HTTP MCP server with a `capture` tool serves both (and, per the earlier note, Gemini and Grok), behind one OAuth layer. OAuth with CIMD plus DCR covers both clients. Claude is the better voice/capture target (hands-free default, Always allow); ChatGPT is workable but voice plus custom connector plus approval is the weakest link. Verify both by hand on the author's accounts (section 6).

## 1. Claude

### Plans and where
- Custom connectors by URL work on Free (limit one), Pro, Max, Team, Enterprise. Pro/Max add via Customize > Connectors > Add custom connector; on Team/Enterprise an Owner adds it (Organization settings > Connectors) and members connect individually. Sources: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp and https://claude.com/docs/connectors/custom/add-unlisted
- Connectors work in claude.ai web, Desktop, mobile (remote connectors only), Claude Code, Cowork. https://claude.com/docs/connectors/getting-started
- Adding a new server from the mobile app: a secondary search result says users cannot add servers from Claude Mobile, only use ones added via claude.ai. UNVERIFIED on a first-party page; getting-started only says connectors are available on mobile. Plan on adding from web/desktop.
- Each conversation has its own toggle (+ > Connectors); the connector must be on for that chat. How voice sessions default this: UNVERIFIED.

### Authentication
Source: https://claude.com/docs/connectors/building/authentication (first-party) and the add-unlisted page.
- Types: `oauth_dcr` and `oauth_cimd` default-supported; `none` (authless) default-supported; `static_headers` (API key or bearer entered by an org Owner in a "Request headers" section) is beta for a limited set of organizations, so a personal account may not see it. Up to four headers; `Authorization` cannot be used as a header alongside OAuth.
- Add dialog: Authentication "Sign in now" / "Sign in when needed" / "No sign-in"; OAuth client "Use Claude's published identity" (CIMD, recommended), "Register automatically" (DCR), or own client ID/secret.
- CIMD is used only if authorization server metadata advertises `client_id_metadata_document_supported: true` and `none` in `token_endpoint_auth_methods_supported`; otherwise Claude falls back to DCR.
- Requirements: PKCE S256 on every request; server must return `401` with `WWW-Authenticate: Bearer resource_metadata=...` (a header on a `200` is ignored); protected-resource metadata `resource` must exactly equal the URL entered; only the first `authorization_servers` entry is used; RFC 8414 or OIDC discovery must be reachable from Anthropic egress; redirect URI `https://claude.ai/api/mcp/auth_callback` (support article says it may become `claude.com`; allow both, this second point is from a search snippet of the support article, UNVERIFIED on the fetched page); `/token` must accept `application/x-www-form-urlencoded`; return `invalid_grant` on bad refresh; rotate refresh tokens for public clients; `offline_access` requested if advertised. `client_credentials` not supported.
- Latency: discovery, registration, token endpoints get 10 s; refresh 30 s. A cold-start serverless auth endpoint must stay well under that.
- Static token for a single-user self-hosted server: "No sign-in" plus `Authorization: Bearer <token>` under Request headers, only if the account has the beta. Otherwise the server must implement OAuth. Tokens in the URL query string are prohibited by the MCP spec.

### Hosting and limits
- Public HTTPS, reachable from Anthropic's egress range `160.79.104.0/21` (https://claude.com/docs/connectors/building/authentication, network reference). Streamable HTTP recommended; legacy HTTP+SSE supported but being deprecated. https://claude.com/docs/connectors/building/index
- Max tool result ~150,000 characters on claude.ai/Desktop; tool call timeout 240 s. Not supported: resource subscriptions, sampling, draft capabilities. Tools must declare `readOnlyHint` and `destructiveHint` (https://claude.com/docs/connectors/building/mcp).
- Per-user rate limits or connector caps beyond Free = 1: not found. UNVERIFIED.

### Confirmation on writes
- Claude "can ask for your approval before it uses one of the connector's tools": Allow once or Always allow; permissions per tool or group under Customize > Connectors: Always allow / Needs approval / Blocked. https://claude.com/docs/connectors/getting-started
- A personal capture tool can therefore be set to Always allow. Contrast Gemini, which always confirms writes (earlier note).

### Voice mode
- Voice mode: iOS, Android, Desktop, web, all plans; hands-free is the default ("listens continuously and responds to natural pauses"), push-to-talk optional. Help page says voice supports "connected tools including Gmail, Google Calendar, Google Docs, and Slack"; several tools add delay; not every result can be shown on screen. https://support.claude.com/en/articles/11101966-use-voice-mode
- The page does not say custom connectors work in voice. Counter-evidence: anthropics/claude-code issue #77312 (opened 2026-07-13, Pro plan, claude.ai web voice mode) reports every tool on a custom OAuth MCP connector failing in voice with "tool ... is not registered" while text mode works; closed "not planned" as belonging to claude.ai, no substantive Anthropic reply. https://github.com/anthropics/claude-code/issues/77312 . Single report, web, ~2.5 months old; current state UNVERIFIED. Test on the author's account, mobile app first.
- Fallback that works regardless: OS dictation into a normal text chat with the connector on and Always allow.

## 2. ChatGPT

Naming note: OpenAI's developer docs now say "plugins" (skills + MCP server + optional UI) where 2025 docs said "apps"; both `developers.openai.com/plugins/...` and `.../apps-sdk/...` resolve. No single first-party rename statement was read; treat "apps", "plugins", "connectors" as one mechanism.

### Plans and setup
- Developer mode: "Available to Pro, Plus, Business, Enterprise, and Education accounts on the web." Enable Settings > Security and login > Developer mode; then ChatGPT Plugins > plus button > create a developer-mode app for a remote MCP server; SSE and streaming HTTP supported. https://developers.openai.com/api/docs/guides/developer-mode . Availability "can depend on account and workspace policy" (https://developers.openai.com/apps-sdk/deploy/connect-chatgpt). Free excluded: secondary only.
- Connection methods: public HTTPS endpoint with streamable HTTP, typically `/mcp`, or a "Secure MCP Tunnel" by tunnel ID. After changing tools, use Refresh at ChatGPT Plugins (developer mode only).
- Mobile: setup is web-only per secondary sources; that a developer-mode connector then appears in iOS/Android apps is also secondary (contextprotocol.dev and similar). No first-party statement read. UNVERIFIED.
- Developer mode carries "elevated risk" warnings (prompt injection, data-integrity errors, malicious MCP servers).

### Authentication
Source: https://developers.openai.com/apps-sdk/build/auth
- OAuth 2.1 with PKCE S256; authorization server must publish `code_challenge_methods_supported` with `S256`.
- Protected resource metadata at `/.well-known/oauth-protected-resource` (RFC 9728).
- Client registration: CIMD (preferred), DCR (called once per connection, `client_id` reused), or predefined client.
- Token endpoint auth: `none` or `private_key_jwt`.
- Must set `authorization_response_iss_parameter_supported: true` and return `iss` in authorization responses. Stable redirect URI `https://chatgpt.com/connector_platform_oauth_redirect`.
- ChatGPT does not validate tokens; the server verifies signature (JWKS), issuer, audience/resource, expiry, scopes, and answers failures with `401` + `WWW-Authenticate`. Auth UI triggered by per-tool `securitySchemes` and `_meta["mcp/www_authenticate"]` errors.
- The developer-mode page lists OAuth, no authentication, and mixed. Static bearer entry not documented there; community summaries mention "paste a token", UNVERIFIED.
- Net: one authorization server with CIMD+DCR, PKCE S256, the `iss` parameter and audience-bound tokens serves both Claude and ChatGPT. `iss` and per-tool `securitySchemes` are the ChatGPT-specific extras.

### Write confirmation and annotations
- Developer mode: "Write actions by default require confirmation"; users can set confirmation preferences per tool per conversation. https://developers.openai.com/api/docs/guides/developer-mode
- `readOnlyHint`, `destructiveHint`, `openWorldHint` required; "hints only influence how ChatGPT or Codex frames the tool call to the user; servers must still enforce their own authorization logic"; `destructiveHint` helps the host "know to elicit explicit approval first". https://developers.openai.com/apps-sdk/reference . Whether an additive `capture` tool (`readOnlyHint:false, destructiveHint:false`) skips the prompt: UNVERIFIED, test.

### Voice mode
- Secondary reports of OpenAI release notes dated 2026-09-23: "Live now supports plugins on web, iOS, and Android. You can use the plugins and connected apps available to your account during a Voice conversation and follow written responses in the chat"; "Existing app connections, permissions, and usage limits apply"; Free and Go can use Voice in Chat with plan-supported plugins. Sources: releasebot.io mirror of the release notes, mixed-news.com, Unite.AI, Notebookcheck. First-party help.openai.com release notes and Voice article (20001274) returned 403.
- Approvals: "actions requiring approval must be approved or declined through on-screen controls; spoken approval is not supported" (secondary quoting OpenAI). Writes needing approval break hands-free use; in a car that means a screen tap.
- Earlier: community thread from 2026-05-30 reported MCP connectors working in text but failing in Voice on web and Android, no OpenAI reply (https://community.openai.com/t/chatgpt-support-of-mcp-in-voice-mode-on-web-and-android/1382072). Likely superseded by the 09-23 change, but no coverage says developer-mode custom apps are included. UNVERIFIED; test.
- Live voice is time-metered per plan (secondary). UNVERIFIED first-party.

### Limits
No rate limits or tool-count limits stated on the fetched developer-mode or connect pages. UNVERIFIED. Production servers should use "stable HTTPS endpoints using the streamable HTTP transport" (https://developers.openai.com/apps-sdk/concepts/mcp-server).

## 3. Side-by-side for Cadence

| Need | Claude | ChatGPT |
|---|---|---|
| Personal account can add it | Yes, any plan | Paid plan + Developer mode toggle, policy permitting |
| Static bearer for single-user server | Only via beta request headers; else OAuth | Not documented; OAuth or no-auth |
| Authorization endpoint the author must build | Yes | Yes |
| Registration | CIMD or DCR | CIMD or DCR |
| Tap-free write | Yes with Always allow | Uncertain; spoken approval unsupported |
| Voice with custom server | Unknown; one failing report | Unknown; plugins in Voice announced |
| Tool result / timeout | ~150k chars / 240 s | Not stated |
| Egress IPs | 160.79.104.0/21 | Not found; UNVERIFIED |

## 4. Hosting Cadence's MCP server

- Both need a public, CA-signed HTTPS endpoint; local dev needs a tunnel (ChatGPT documents a Secure MCP Tunnel).
- Vercel (as briefed): first-party docs (page last updated 2026-09-18) show `mcp-handler` v2 for Next.js App Router with Streamable HTTP (v2 removes legacy SSE), `withMcpAuth` for bearer verification and `protectedResourceHandler` for `/.well-known/oauth-protected-resource`. It does not issue tokens; an authorization server is still required. https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel . Related links on that page include a Vercel KB guide "How to build an MCP server with Nuxt" (Nuxt MCP Toolkit) and one for a ChatGPT connector; not read. Function duration limits not on that page; stateless Streamable HTTP capture calls are short.
- Netlify (what `netlify.toml` says): same constraints; function timeouts remain UNVERIFIED from the earlier note.
- `.well-known` routing: Claude accepts a `resource_metadata` URL on any HTTPS location, so path-restricted hosts can work; ChatGPT docs describe the standard well-known location.
- Authorization server: whether Supabase Auth can serve as an MCP authorization server (CIMD/DCR, PKCE, `iss`, audience binding) is still UNVERIFIED, as in the earlier note. Endpoints must respond within Claude's 10 s / 30 s limits.

## 5. Claude vs OpenAI as Cadence's own LLM providers (delta only)

Model and price tables live in the earlier LLM note. Checked 2026-09-29 against https://developers.openai.com/api/docs/pricing: gpt-6-astra $10 in / $50 out (cached $1.00), gpt-6.1-sol $2 / $10 (cached $0.10), gpt-6-luna $0.10 / $0.50 (cached $0.01), gpt-5-mini $0.25 / $2, gpt-5-nano $0.05 / $0.40; batch 50% off. This resolves the earlier note's flag on those names (the live page lists them). Sonnet 5.5 ($2/$10) matches gpt-6.1-sol on list price; OpenAI's small tier undercuts Haiku 4.5 ($1/$5) by roughly 10x on input. Claude's ~30% tokenizer inflation (earlier note) makes Claude's list price understate cost.

Structured extraction:
- OpenAI Structured Outputs: strict `json_schema` (`text.format` in Responses API), `additionalProperties:false`, limited nesting and property counts, extra latency on the first request per schema, refusals in a dedicated `refusal` field, zod helper in the JS SDK; gpt-4o-mini/gpt-4o-2024-08-06 and later. https://developers.openai.com/api/docs/guides/structured-outputs
- Claude structured outputs: GA on current models including Haiku 4.5 and Sonnet 5.5 (`output_config.format`, plus `strict:true` tools). Unsupported: recursive schemas, numeric and string length constraints, `additionalProperties` other than false; `minItems` only 0 or 1. Limits: 20 strict tools per request, 24 optional parameters, 16 union-typed parameters, 180 s compile timeout; grammars cached 24 h; `refusal` and `max_tokens` stop reasons can return non-conforming output (billed). `output_format` is deprecated for `output_config.format`. https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Implication: both reject recursive schemas, so the flat edge-list the earlier note proposes suits both. Claude's 24-optional-parameter cap argues for required-with-null fields. Extraction quality for ADHD coaching is not answered by any primary source; add an OpenAI mid tier and gpt-6-luna to the earlier note's spike.
- Both sit behind the Vercel AI SDK, so switching is configuration.

Data handling delta:
- OpenAI API: 30-day abuse-monitoring retention by default; not used for training unless opted in; `store` keeps Responses data at least 30 days when true; approved ZDR forces `store` false. https://developers.openai.com/api/docs/guides/your-data . Set `store:false` explicitly for a personal-data app.
- Anthropic: see earlier note. New: the Messages API MCP connector is beta (`mcp-client-2025-11-20`) and marked ZDR "not-eligible" (https://platform.claude.com/docs/en/agents-and-tools/mcp-connector); prefer Cadence's own server-side data layer for tool calls. Structured outputs are ZDR-processed per the structured-outputs page. Keep sensitive terms out of schema property names (schemas cached 24 h).

Voice in Cadence's own layer: OpenAI's Realtime API supports remote MCP tools (`server_url`, `authorization` field, `mcp_approval_request`/`mcp_approval_response` items) for models released after 2026-09-01 (https://developers.openai.com/api/docs/guides/realtime-mcp). I found no first-party Claude speech-to-speech API in the docs read; that absence is UNVERIFIED. A self-built voice coach has a documented OpenAI path; Claude would need separate STT/TTS.

## 6. Open items to verify by hand
1. Claude mobile app, hands-free voice, calling a custom connector on the author's plan; whether the toggle is on by default in voice sessions; whether bug #77312 still reproduces.
2. Does the author's Claude account see the beta "Request headers" (static bearer) option?
3. ChatGPT: do developer-mode custom apps work in Live Voice on iOS/Android; does an additive, non-destructive `capture` tool avoid the approval prompt; is the app usable on mobile after web setup.
4. First-party plan eligibility for ChatGPT Developer mode (help.openai.com not fetchable).
5. Supabase Auth (or a small OAuth layer) as MCP authorization server passing both clients' checklists.
6. Real hosting target (Vercel vs Netlify) and function duration limits.
7. Whether Deployment Protection or a firewall blocks Anthropic's egress range.

## Sources
- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- https://support.claude.com/en/articles/11101966-use-voice-mode
- https://claude.com/docs/connectors/getting-started
- https://claude.com/docs/connectors/custom/add-unlisted
- https://claude.com/docs/connectors/building/index
- https://claude.com/docs/connectors/building/authentication
- https://claude.com/docs/connectors/building/mcp
- https://github.com/anthropics/claude-code/issues/77312
- https://developers.openai.com/api/docs/guides/developer-mode
- https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- https://developers.openai.com/apps-sdk/build/auth
- https://developers.openai.com/apps-sdk/reference
- https://developers.openai.com/apps-sdk/concepts/mcp-server
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/your-data
- https://developers.openai.com/api/docs/guides/realtime-mcp
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/agents-and-tools/mcp-connector
- https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel
- Secondary (ChatGPT Voice plugins, 2026-09-23): https://releasebot.io/updates/openai/chatgpt, https://mixed-news.com/en/chatgpt-voice-plugins-web-ios-android-on-screen-approval/
- Community: https://community.openai.com/t/chatgpt-support-of-mcp-in-voice-mode-on-web-and-android/1382072
