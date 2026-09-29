---
title: Architecture and storage
type: grilling
status: open
assignee:
blocked-by: [03-life-graph-domain-model]
parent: map.md
---
## Question

What stack and architecture fit: local-first vs hosted, where the Life graph and LLM memory live, provider-agnostic AI layer, background processing, and what can be reused from the current code?

Input: the LLM research (branch research/llm-and-memory-options) recommends a thin provider-agnostic interface, own Node/Edge store, flat nodes+edges extraction, and an extraction spike (20-30 real transcripts across Haiku, Sonnet and a local model). Decide whether that spike is a prerequisite ticket.

Settled by the author (not to be re-decided here): the stack is Nuxt / Vue / Pinia, hosted on Vercel (moving off Netlify). It currently runs at https://cadence.skylerfly.com/ and may later get its own domain. What this ticket still decides: local-first vs hosted data, where the Life graph and LLM memory live, the provider-agnostic AI layer, background/scheduled work within Vercel's serverless limits (nudges, pattern learning), and what carries over from the current code. Design so that a later domain change does not break stable identifiers (auth/OAuth issuer and redirect URIs, webhook URLs, Shortcuts and MCP endpoints).

CORRECTION: the existing Nuxt app on origin/main already has Supabase (accounts, passkeys, normalized cross-device sync in lib/sync.ts), Pinia state (stores/app.ts), local-first storage and Nitro server routes, so this ticket starts from that baseline instead of a blank slate. Note it still depends on z-ai-web-dev-sdk for AI, which conflicts with the provider-agnostic goal. Decide what to keep (Supabase as the hosted store? local-first?), what to add for the Life graph and memory, and how the AI layer is replaced.

Input (from the closed Life graph domain model ticket): the store must hold five Node kinds, typed Links carrying origin, confidence and evidence, and an append-only Occurrence log; deep Goal nesting; mirror Nodes for external items; patterns computed from the log. See the ticket's Resolution for the model summary.
