---
title: Research: Claude and ChatGPT as capture and voice targets
type: research
status: closed
assignee: research-subagent
blocked-by: []
parent: map.md
---
## Question

Can Claude (Claude apps on mobile/desktop/web, voice mode) and ChatGPT (ChatGPT apps, voice mode, custom connectors / apps SDK / developer mode) reach a self-hosted Cadence over remote MCP or similar today, so the user can capture and query by voice from either assistant? For each: what plans or account types are required, how custom connectors are added and authenticated (OAuth expectations, dynamic client registration), whether voice mode can invoke connectors hands-free, per-write confirmation behaviour, hosting requirements, and limits. Also: how do Claude and OpenAI compare as LLM providers behind Cadence's own AI layer for structured extraction and coaching, beyond what the earlier LLM-and-memory research already covers?

## Resolution

Findings: branch `research/claude-chatgpt-integration`, copied to `research/claude-chatgpt-integration.md`.

- **One server serves both:** a single Streamable HTTP MCP server with OAuth (client ID metadata document and dynamic registration, PKCE S256, `iss` in authorization responses) works for Claude and ChatGPT, on top of the earlier Gemini/Grok plan.
- **Claude is the better capture target:** custom connectors on all plans (Free gets one), on web, desktop and mobile; voice is hands-free by default; each tool can be Always allow / Needs approval / Blocked, so the write prompt can be removed. Auth: OAuth, none, or static bearer (beta for limited orgs). Limits: ~150,000-character tool results, 240 s per call; Anthropic connects from 160.79.104.0/21.
- **ChatGPT is weaker for hands-free:** needs a paid plan and Developer mode on web; writes need confirmation, and approvals in Live Voice must be tapped on screen (no spoken approval), so tap-free capture is not reliable.
- **Voice with custom connectors is unproven for both:** one Claude GitHub issue (#77312, July 2026) reports connector tools failing in voice while working in text; ChatGPT Live plugin support is known only from secondary sources (help.openai.com returned 403).
- **As LLM providers:** close on structured output (both reject recursive schemas, so the flat nodes+edges approach suits both) and price (gpt-6.1-sol matches Sonnet 5.5 at $2/$10; OpenAI's small tiers are about 10x cheaper than Haiku 4.5 on input). Data handling: OpenAI keeps API data 30 days by default (set `store:false`); Claude's API MCP connector is not eligible for zero data retention. OpenAI's Realtime API can call remote MCP tools; no Claude speech API found.
- **Vercel note:** Vercel's `mcp-handler` package handles bearer verification and protected-resource metadata but does not issue tokens. Whether Supabase Auth can be the OAuth authorization server for MCP is unverified.
- **By-hand checks for the author's own accounts:** voice with a custom connector on both assistants, and whether ChatGPT prompts on an additive capture tool (the file lists 7).

Author decision after this research: skip ChatGPT (and Siri) as integration targets. Only the Claude findings and the LLM-provider comparison feed later tickets.
