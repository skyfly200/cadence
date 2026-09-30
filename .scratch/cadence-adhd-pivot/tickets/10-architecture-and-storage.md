---
title: Architecture and storage
type: grilling
status: closed
assignee: skyler
blocked-by: [03-life-graph-domain-model]
parent: map.md
---
## Question

What stack and architecture fit: local-first vs hosted, where the Life graph and LLM memory live, provider-agnostic AI layer, background processing, and what can be reused from the current code?

Input: the LLM research (branch research/llm-and-memory-options) recommends a thin provider-agnostic interface, own Node/Edge store, flat nodes+edges extraction, and an extraction spike (20-30 real transcripts across Haiku, Sonnet and a local model). Decide whether that spike is a prerequisite ticket.

Settled by the author (not to be re-decided here): the stack is Nuxt / Vue / Pinia, hosted on Vercel (moving off Netlify). It currently runs at https://cadence.skylerfly.com/ and may later get its own domain. What this ticket still decides: local-first vs hosted data, where the Life graph and LLM memory live, the provider-agnostic AI layer, background/scheduled work within Vercel's serverless limits (nudges, pattern learning), and what carries over from the current code. Design so that a later domain change does not break stable identifiers (auth/OAuth issuer and redirect URIs, webhook URLs, Shortcuts and MCP endpoints).

CORRECTION: the existing Nuxt app on origin/main already has Supabase (accounts, passkeys, normalized cross-device sync in lib/sync.ts), Pinia state (stores/app.ts), local-first storage and Nitro server routes, so this ticket starts from that baseline instead of a blank slate. Note it still depends on z-ai-web-dev-sdk for AI, which conflicts with the provider-agnostic goal. Decide what to keep (Supabase as the hosted store? local-first?), what to add for the Life graph and memory, and how the AI layer is replaced.

Input (from the closed Life graph domain model ticket): the store must hold five Node kinds, typed Links carrying origin, confidence and evidence, and an append-only Occurrence log; deep Goal nesting; mirror Nodes for external items; patterns computed from the log. See the ticket's Resolution for the model summary.

In progress: the scheduling, closed-app nudge and MCP-auth questions wait for the platform-facts research ticket (Vercel, Supabase and push).

## Resolution

Decided in grilling. Framework (Nuxt, Vue, Pinia) and host (Vercel) were settled before this ticket. Standing constraint from the author: **keep it as cheap as possible upfront**.

- **Where the truth lives:** Supabase is the durable source of truth once signed in; the browser keeps an offline-first cache; signed-out use still works purely locally. Stay on Supabase (accounts and passkeys already exist).
- **Stored shape:** Nodes stay as JSON rows in one table with a `kind` column (fits the existing sync engine). Links and the Occurrence log get their own real tables (links need querying; the log is append-only). Nesting and dependency chains use Postgres recursive queries through an RPC function with the `CYCLE` clause, watching the 8 s statement timeout. No graph database.
- **Sync:** keep and extend the existing last-writer-wins engine; Nodes and Links stay last-writer-wins; the Occurrence log merges by union. Revisit only if conflicts hurt.
- **AI layer:** a thin provider-agnostic interface on the Vercel AI SDK with two adapters from the start (Anthropic as default, and an OpenAI-compatible one that also reaches local models), replacing `z-ai-web-dev-sdk`. Small fast models for voice and nudge wording; stronger models for extraction and coaching. Keys live only on the server, with a per-user usage cap (also serves the cost constraint).
- **What the AI decides:** a deterministic core picks the Now card (deadlines, dependencies, opening windows, learned patterns), running on device and working offline. The AI handles language and extraction: the "why this one" line, turning a Capture into Nodes and Links, and conversation. The AI may rank ties but never has the last word on urgency.
- **Memory:** the Life graph is the memory. Each conversation gets the relevant slice (focus Node, Nodes within a couple of Links, recent Occurrences). No vector database in v1; pgvector only if matching Ideas to Nodes needs it. The Claude memory tool is not used (it is Claude-only).
- **Migration (author: start fresh):** new tables (`cadence_nodes`, `cadence_links`, `cadence_occurrences`) with **no migration** of existing data. The old tables are left in place untouched. The mapping in the Life graph ticket is reference only.
- **Extraction spike:** a separate task ticket (20 to 30 real transcripts through Haiku, Sonnet and one local model, measuring edge precision, recall and latency). It does not block this decision but must finish before the extraction design is final.
- **Plans and cost (author: free on both):** stay on the free plans for now: Vercel Hobby (non-commercial, so fine only while Cadence stays personal; Pro needed when it becomes a product) and Supabase Free. Timely nudges use **Supabase scheduling** so Vercel's daily-only cron on Hobby does not matter.
- **Scheduled work:** a `nudge_queue` table plus a Supabase pg_cron job every minute (intervals down to 30 seconds are supported) that calls one Nuxt server route, which sends the push and also runs pattern learning and Background risk checks. Delivery is best effort (missed or duplicated runs possible), so every job is idempotent and reconciling. The route must acknowledge within pg_net's 2 s default timeout and do longer work after responding (or the timeout must be raised).
- **Closed-app nudges (author: Web Push, on Android):** Web Push sent from the Nuxt server with the `web-push` library; in-app nudges stay client-side. Android appears not to require an install (no first-party statement found); iPhone would need a Home Screen install and a tap to subscribe. A native app is a later option only if this proves too weak.
- **MCP sign-in:** do not depend on Supabase's OAuth server for now (beta; open issue supabase/auth #2820, 2026-09-20, one report, not reproduced). Plan a thin sign-in server inside Nuxt that reuses the existing Supabase passkey login and issues its own short-lived tokens; re-test the Supabase issue when ticket 11 starts. The exact contract belongs to Capture channels and MCP contract.

Risks to carry (from the platform research, flagged there as unverified): free Supabase projects pause after 7 days of low activity, and it is unverified whether pg_cron activity prevents the pause (daily app use probably does), so a silent database means silent nudges: monitor it. Free Supabase has no point-in-time backups, so backup and export belong in the Trust and transparency ticket. Vercel Hobby cron and non-commercial limits are irrelevant to scheduling but relevant to any future paid launch.

## Update (author): Vercel project created

The author has set up a new Vercel project connected to this repo. Notes from checking the repo: `nuxt.config.ts` sets no fixed Nitro preset (Vercel should auto-detect Nuxt), but `netlify.toml` still exists and `siteUrl` defaults to `https://cadencetodo.netlify.app`; the Supabase URL and publishable key have baked-in defaults; Google Calendar needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `NUXT_PUBLIC_GOOGLE_CLIENT_ID`. A new Vercel project starts with no environment variables, so it needs at least `NUXT_PUBLIC_SITE_URL` (the auth and passkey redirect target, which must also be allow-listed in Supabase Auth URL Configuration) and, for Calendar, the Google variables. The live domain `cadence.skylerfly.com` still points at Netlify until it is re-pointed. The prototype is gated to dev only, so it does not appear in Vercel preview or production builds. This is deployment work for the roadmap, not a decision left open here.

Input (from the closed Habit formation and reinforcement ticket): a Commitment carries an optional "slog" flag; garden growth and the weekly tally are derived from the Occurrence log; each calendar-season turn writes a small "pressed plants" record so the book survives; reward lines are templates rendered on the device.
