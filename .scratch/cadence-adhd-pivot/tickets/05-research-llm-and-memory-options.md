---
title: Research: LLM provider and memory options
type: research
status: closed
assignee: research-subagent
blocked-by: []
parent: map.md
---
## Question

For a provider-agnostic companion with persistent memory of a user's life graph, what are the current options and trade-offs for model access, memory/retrieval approaches, cost, latency, structured extraction of dependency trees, and local vs cloud inference?

## Resolution

Findings: branch `research/llm-and-memory-options`, file `research/llm-and-memory-options.md` (dated 2026-09-29).

- **Model access:** Claude API is the sensible default (Haiku 4.5 $1/$5, Sonnet 5.5 $2/$10 per MTok; cache reads 0.1x). Anthropic has no embeddings model (points to Voyage). Put a thin Cadence LLM interface (`complete`, `extract<T>(schema)`, `embed`) over the Vercel AI SDK; LiteLLM is overkill for one user, OpenRouter adds a third party in the data path.
- **Extraction:** Claude structured outputs don't support recursive schemas and ignore numeric/length constraints, so extract a flat nodes-plus-edges list with confidence and evidence, rebuild trees and reject cycles in code, and validate with Zod.
- **Memory:** own Node/Edge store as the source of truth (SQLite local, optional sync), with optional embeddings and graph-traversal tools. Graphiti needs a graph DB; Mem0/Letta are fact memory; Anthropic's memory tool is Claude-only, good only for free-text coach notes.
- **Cost:** roughly $12-45/month at 100 Sonnet turns/day, about $4-15 with the prompt prefix cached (estimates, not measured). Route short voice/nudge turns to Haiku or a small local model.
- **Local vs cloud:** Ollama and WebLLM work as adapters; Ollama Cloud lacks structured outputs; use paid tiers only for personal data.

Caveats (verify before relying on them): pages were read through a summarising fetch tool; OpenAI model names and prices are unconfirmed; cost estimates, local-model extraction quality and Supabase pgvector are unverified. **Error in the report:** it describes the repo as Nuxt/Vue/Pinia; it is actually Next.js/React/Zustand. Only the "fits Nuxt" remark is affected, and the AI SDK works in Next.js.

Open follow-up (belongs to Architecture and storage): a spike running 20-30 real transcripts through Haiku, Sonnet and one local model to measure edge precision, recall and latency.

Update: the author has decided the target stack is Nuxt/Vue/Pinia on Vercel, so the report's "fits Nuxt" remark is now correct in intent (the local repo is still Next.js/React until the rewrite). The Vercel AI SDK works from Nitro server routes, but check Vercel function duration limits for extraction and memory work.
