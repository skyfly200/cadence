---
title: Research: Vercel, Supabase and push platform facts
type: research
status: closed
assignee: research-subagent
blocked-by: []
parent: map.md
---
## Question

Which platform limits and capabilities decide how Cadence schedules background work and delivers closed-app nudges, on Nuxt (Nitro) hosted on Vercel with Supabase? Specifically: (1) Vercel Cron frequency limits and function duration limits by plan (Hobby vs Pro), including Fluid compute; (2) Supabase scheduled work (pg_cron, Edge Functions, cron invocation) and its limits; (3) Web Push for PWAs on iOS (home-screen requirement, permission rules, reliability) and Android; (4) whether Supabase Auth can act as an OAuth 2.1 authorization server for remote MCP connectors (Claude, Gemini, Grok apps), or what the alternatives on Vercel are; (5) Supabase Row Level Security and pgvector or recursive-query suitability for a personal graph of nodes, links and an append-only occurrence log.

## Resolution

Findings: branch `research/vercel-supabase-platform-facts`, copied to `research/vercel-supabase-platform-facts.md`. Pages were read through a summarising fetch tool, so quotes are paraphrases; Supabase pages carry no dates; unverified items are flagged in the file.

- **Vercel Cron:** Hobby is once per day with about plus or minus 59 minutes of timing, and sub-daily expressions fail the deploy; Pro allows per-minute schedules (UTC only). Delivery is best effort with no retries, and runs can be missed or duplicated, so jobs must be idempotent and reconciling. Hobby is non-commercial only.
- **Function duration:** with Fluid compute (default), Hobby 300 s; Pro 300 s default, 800 s max, 1800 s beta. Active CPU is not billed while waiting on LLM I/O, but memory is. Fine for LLM routes.
- **Supabase scheduling:** pg_cron supports intervals down to '30 seconds' and calls routes via `net.http_post` (pg_net: 2 s default timeout, at-most-once). Edge Functions: 2 s CPU, 150 s wall-clock on Free, 400 s paid. Free projects pause after 7 days of low activity (whether pg_cron activity prevents this is unverified).
- **Web Push:** iOS needs 16.4+, a Home Screen install, and permission requested from a tap; every push must show a notification or Safari revokes permission (Declarative Web Push, iOS 18.4, removes that risk). Android does not appear to require install (no first-party statement found). Supabase's push guide covers only FCM and Expo; sending Web Push from Nitro with `web-push` is the simplest path.
- **Supabase Auth as MCP authorization server:** beta OAuth 2.1 with PKCE and DCR, but a GitHub issue (supabase/auth #2820, opened 2026-09-20, open, single report, not reproduced) says it fails with public clients, `resource` and `offline_access`, which MCP clients send; no Client ID Metadata Document support. `mcp-handler` v2 only verifies tokens. Alternatives: a thin authorization server in Nitro, or an external provider (not checked).
- **Graph on Postgres:** fits at single-user scale. Use recursive CTEs through an RPC function with the built-in `CYCLE` clause; watch the 8 s `authenticated` statement timeout. Skip a pgvector index until data is large (HNSW is the default choice then).
- **Suggested shape from the report:** a `nudge_queue` table, pg_cron each minute calling one Nitro route that sends Web Push with `web-push`, on Supabase Pro to avoid pausing.
