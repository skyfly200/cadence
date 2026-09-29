# Research: LLM provider and memory options for Cadence

Date researched: 2026-09-29. Ticket: `.scratch/cadence-adhd-pivot/tickets/05-research-llm-and-memory-options.md`.

**Question.** For a provider-agnostic companion with persistent memory of a user's life graph, what are the current options and trade-offs for model access, memory/retrieval, cost, latency, structured extraction of dependency trees, and local vs cloud inference?

**Method and caveats.** Facts below were pulled from first-party docs and repos (URLs per claim). Pages were read through a summarising fetch tool, so exact figures should be re-checked before they drive a decision. Anything marked **[unverified]** is judgement or came from a page that did not state it. Prices and model names move monthly; treat every number as "as of 2026-09-29".

Repo context (from `package.json`, `CONTEXT.md`): Nuxt 3 + Vue 3 + Pinia app, Supabase client, `lib/local-storage.ts` and `lib/sync.ts` already exist, a `server/api` directory exists. So a TypeScript-first, server-route-friendly stack is the natural fit. The domain glossary defines the **Life graph** as Nodes plus dependencies inferred from behaviour, which is the thing memory must persist.

---

## 1. Model access

### 1.1 Claude (first-party API)

Current lineup (https://platform.claude.com/docs/en/about-claude/models/overview, fetched 2026-09-29):

| Model | API ID | Price in/out per MTok | Latency (Anthropic's label) | Context |
|---|---|---|---|---|
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | $1 / $5 | Fastest | 200K |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | $2 / $10 | Fast | 1M |
| Claude Opus 5.5 | `claude-opus-5-5` | $4 / $20 | Moderate | 1M |
| Claude Fable 5.1 | `claude-fable-5-1` | $10 / $50 | Slower | 1M |

Source for prices: https://platform.claude.com/docs/en/about-claude/pricing. Cost levers from the same page:
- Prompt cache reads cost 0.1x base input (0.05x on Opus 5.5, 0.025x on Fable 5.1). 5-minute cache write is 1.25x, 1-hour write is 2x.
- Batch API is 50% off input and output (not for interactive chat).
- Sonnet 5's $2/$10 is now standard; the scheduled rise to $3/$15 on 2026-09-01 was cancelled (same page, footnote 3).
- Claude 4.7+ tokenizer yields ~30% more tokens for the same text than earlier ones, so per-token comparisons with older models understate cost.
- Data residency `inference_geo: "us"` adds 1.1x.

Data handling: retained data is never used for training without permission; zero data retention (ZDR) is available by arrangement, and the memory tool and structured outputs are listed in the ZDR feature-eligibility material (https://platform.claude.com/docs/en/manage-claude/api-and-data-retention). **[unverified]** exact ZDR eligibility per feature; check the table before relying on it. ZDR is an enterprise arrangement, so a single-user app should assume standard commercial retention.

Anthropic does not offer an embedding model; it points to Voyage AI (https://platform.claude.com/docs/en/build-with-claude/embeddings). Voyage 4 family listed: `voyage-4-large`, `voyage-4`, `voyage-4-lite`, and `voyage-4-nano` (open-weight, Apache 2.0, Hugging Face), all 32K context, 1024 default dims with 256/512/2048 options.

### 1.2 Other model providers (for the "agnostic" part)

- **Google Gemini** (https://ai.google.dev/gemini-api/docs/pricing): Flash-Lite tiers are the cheap end, e.g. Gemini 3.1 Flash-Lite $0.25 in / $1.50 out, 2.5 Flash-Lite $0.10 / $0.40; Gemini 3.7/3.8 Flash $0.75 / $3.75. Free tier exists, but on the free tier content is used to improve Google products; on paid it is not. For a personal-data app, use paid tier only. Embedding: Gemini Embedding 2 text at $0.20/MTok.
- **OpenAI** (https://developers.openai.com/api/docs/pricing): page lists gpt-6-astra $10/$50, gpt-6.1-sol $2/$10, gpt-6-luna $0.10/$0.50, and text-embedding-3-small at $0.02/MTok; batch 50% off; regional residency +10% on newer models. **[unverified]** these model names came through a summarising fetch; re-read the live page.
- **Local** (see section 5): Ollama, WebLLM.

### 1.3 Gateway / abstraction options

| Option | What it is | Fit for Cadence | Source |
|---|---|---|---|
| **Vercel AI SDK** (`ai`) | TypeScript toolkit, unified API across providers, structured output, tools, agents; runs in Node, edge and browsers; needs Node 22+; open source; 27k stars | Best fit: Nuxt/TS, works from a Nitro `server/api` route or client, provider swap is a one-line model change | https://ai-sdk.dev/docs/introduction, https://github.com/vercel/ai |
| **LiteLLM** | Python SDK plus a proxy server presenting an OpenAI-format API over 100+ providers; fallbacks, cost tracking per key/user; MIT; proxy needs Postgres | Overkill for single user; a Python service is a second runtime. Worth it only if a self-hosted multi-user gateway appears later | https://docs.litellm.ai/docs/, https://github.com/BerriAI/litellm |
| **OpenRouter** | Hosted single OpenAI-compatible endpoint over hundreds of models with automatic fallbacks | Easiest breadth, but adds a third party in the path of very personal data; quickstart page did not state data-retention policy, so read their privacy docs first | https://openrouter.ai/docs/quickstart |
| **Own thin interface** | A small `LlmClient` interface (`complete`, `extract<T>(schema)`, `embed`) with adapters for Anthropic, OpenAI-compatible (covers Ollama, LM Studio, OpenRouter) | Cheapest to own; the OpenAI-compatible adapter alone reaches most local servers | design judgement **[unverified]** |

Recommendation for the ticket's design step: a thin domain interface, implemented initially on the AI SDK. The interface matters more than the library: the hard part of agnosticism is the *capabilities* that differ per provider (schema-constrained output, prompt caching, tool use), not the request shape.

Key portability trap: Anthropic's structured outputs and prompt caching are provider features with no exact equivalent everywhere. Ollama supports schema-constrained `format` locally but "Ollama's Cloud currently does not support structured outputs" (https://docs.ollama.com/capabilities/structured-outputs). Always validate output with a schema library (Zod) in Cadence regardless of what the provider guarantees.

---

## 2. Structured extraction of dependency trees from conversation

Anthropic structured outputs (https://platform.claude.com/docs/en/build-with-claude/structured-outputs):
- Two features: JSON outputs via `output_config.format` (`type: "json_schema"`) and strict tool use (`strict: true`). Output is guaranteed schema-valid, so no retry for parse errors.
- GA on the current Claude models including Haiku 4.5, Sonnet 5.5, Opus 5.5, on the Claude API, Bedrock, Google Cloud and Foundry.
- **Schema limits that matter for trees**: recursive schemas are **not supported**; no `minimum/maximum`, `minLength/maxLength`, `pattern`. `$ref`/`$defs`, `anyOf`, `enum`, `const` are supported. `minItems` only 0 or 1.
- First request with a new schema pays a grammar-compilation latency; compiled grammars are cached 24 hours; changing schema structure invalidates the cache (description-only changes do not).
- The param moved from `output_format` to `output_config.format`; the old one is deprecated and needs the `structured-outputs-2025-11-13` beta header.

**Design consequence.** Do not ask the model for a nested tree. Because recursion is unsupported, extract a **flat edge list**:

```
nodes: [{ id, kind, label, ... }]
edges: [{ from, to, relation: "blocks" | "requires" | "part_of" | ..., confidence }]
```

Trees/DAGs are reassembled in code, where cycles can be detected and rejected. This also matches how a graph store wants the data (Node table plus Edge table) and makes incremental updates (add/merge nodes and edges) simpler than re-emitting whole trees. Dependencies "inferred from behaviour" should carry a `confidence` and `evidence` reference so Cadence can decay or ask the user to confirm (`confidence` as a plain number field, since numeric-range constraints cannot be enforced by the schema and must be validated in code).

Local models: Ollama compiles a JSON schema into constrained decoding and recommends also putting the schema in the prompt and temperature 0 (https://docs.ollama.com/capabilities/structured-outputs). Small local models are reliably *syntactically* valid but weaker at inferring implicit dependencies; **[unverified]** no primary benchmark gathered on extraction quality for local models, so it needs a spike with real Cadence transcripts.

Cost shape: extraction runs on every capture or on batches. Since it is not latency-critical, it can use Haiku 4.5 interactive, or the Batch API (50% off) if run overnight as part of a "consolidation" job.

---

## 3. Memory and retrieval approaches

Cadence's memory is a **typed, evolving graph** (Nodes, dependencies, status changes over time), not a bag of chat facts. That drives the comparison.

### 3.1 Approaches

| Approach | How it works | Strengths | Weaknesses |
|---|---|---|---|
| **A. Own relational store (SQLite/Postgres) with nodes + edges tables, plus optional vectors** | Extraction writes rows; retrieval = SQL/graph traversal (recursive CTEs) plus optional embedding lookup; a compact "state of the world" summary injected into the prompt | Total control, works offline, matches the domain model exactly, no extra service; Supabase already in repo | You write the merge/dedupe/decay logic |
| **B. Model-driven file memory (Anthropic memory tool)** | Claude reads/writes files under `/memories` via client-side handler you implement; you choose the storage; commands: view, create, str_replace, insert, delete, rename; pairs with context editing and compaction | Cheap to try, storage stays in your app, model curates its own notes, available on all Claude 4+ models | Anthropic-specific tool type (`memory_20250818`), not portable to other providers; unstructured text is poor for a dependency graph; must implement path-traversal protection | 
| **C. Temporal knowledge graph framework (Graphiti/Zep)** | Ingests "episodes", extracts entities/relations with an LLM, keeps validity windows and provenance | Purpose-built for facts that change over time; Apache-2.0; claims sub-second query latency; has an MCP server | Needs a graph DB (Neo4j 5.26+, FalkorDB 1.1.2+, Neptune; Kuzu backend deprecated as unmaintained); defaults to OpenAI for LLM and embeddings and "works best" with structured-output providers, so extraction cost/latency accrues per episode; heavy for single-user local-first |
| **D. Agent-memory frameworks (Mem0, Letta)** | Mem0: library or Docker stack (self-host) or managed platform; single-pass ADD-only LLM extraction, memories accumulate; default embedding text-embedding-3-small. Letta: memory blocks (human/persona), archival memory, and newer git-tracked MemFS; self-hostable | Quick path to "it remembers"; integrations (Mem0 lists 22, incl. Vercel AI SDK) | Their memory model is facts/notes, not typed dependency graphs; Mem0's headline benchmarks (LoCoMo 92.5, LongMemEval 94.4) are for the *managed platform with proprietary optimisations not in the open-source SDK*; Letta's V1 SDK is being deprecated in favour of the Agent SDK (churn risk) |
| **E. Summarisation only** (rolling summary, compaction) | Periodically compress history; Anthropic offers server-side compaction and context editing | Simple; keeps prompts small | Lossy; cannot answer "what blocks X" reliably; poor for a graph. Best used as a complement, e.g. compaction plus a store |

Sources: memory tool https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool; Graphiti https://github.com/getzep/graphiti; Mem0 https://docs.mem0.ai/introduction and https://github.com/mem0ai/mem0; Letta https://docs.letta.com/concepts/memgpt.

### 3.2 Embeddings and vector search (if needed)

- Cloud: Voyage (recommended by Anthropic), OpenAI text-embedding-3-small ($0.02/MTok), Gemini Embedding 2 ($0.20/MTok). Local: `voyage-4-nano` (open weights, Apache 2.0) or any Ollama embedding model via `/api/embed` (https://github.com/ollama/ollama/blob/main/docs/api.md).
- Vector index: **sqlite-vec** is a tiny pure-C SQLite extension, Apache-2.0/MIT, runs on Linux/macOS/Windows, **in the browser via WASM**, brute-force KNN (with IVF/DiskANN options mentioned) - but it is **pre-v1, expect breaking changes** (https://github.com/asg017/sqlite-vec). Postgres `pgvector` on Supabase is the cloud analogue **[unverified: not fetched]**.
- Scale reality: a single user's graph is at most thousands of nodes, so brute-force search is fast enough and an ANN index is unnecessary. **[unverified]** this is arithmetic judgement, not a benchmark.
- Important: embeddings mostly help *finding* a Node from a fuzzy utterance ("that thing with the landlord"). Dependency reasoning should come from explicit edges, not embedding similarity.

### 3.3 Suggested shape (for the design ticket to challenge)

1. Source of truth = own Node/Edge store (SQLite locally, synced to Supabase via the existing `lib/sync.ts` pattern), each edge with confidence, evidence pointer, timestamps (bi-temporal fields borrowed from Graphiti's idea without its infrastructure).
2. Extraction step (LLM, flat edge-list schema) proposes graph diffs; deterministic code merges/dedupes and rejects cycles.
3. Retrieval = (a) always-included compact summary of the active/at-risk subgraph, (b) on-demand lookup by embedding + traversal, exposed to the model as ordinary tools (`find_node`, `get_neighbors`) so it works on any tool-calling provider.
4. Keep Anthropic's memory tool as an optional adapter for free-text "coach notes", not the graph.

---

## 4. Cost and latency

Back-of-envelope (assumptions are mine, marked **[estimate]**; prices from section 1.1):

- Companion turn on Sonnet 5.5 with a 6K-token context (system + graph summary) and 300 output tokens: input 6K x $2/M = $0.012, output 300 x $10/M = $0.003, about **$0.015/turn**; with the 6K prefix cached (read at 0.1x = $0.20/M) input drops to about $0.0012, about **$0.004/turn**. At 100 turns/day, about $0.4-1.5/day, or roughly $12-45/month **[estimate]**.
- Same turn on Haiku 4.5: about $0.006 uncached / $0.002 cached **[estimate]**.
- Extraction on Haiku 4.5 at ~2K in / 500 out: about $0.0045 each, halved on Batch **[estimate]**.
- Cache economics: 5-minute cache pays off after one read, 1-hour after two (pricing page). Nudge/coach interactions spaced hours apart will miss a 5-minute cache; the 1-hour tier or a stable prefix ordering (static system prompt, then graph summary, then conversation) matters.
- Latency: Anthropic only publishes relative labels (Haiku fastest, Sonnet fast, Opus moderate, Fable slower) and states actual latency depends on prompt/output length and thinking effort. **No absolute first-token numbers were found in primary docs; measure on device.** Anthropic also offers "fast mode" (research preview, Opus only, premium $8/$40 for Opus 5.5) which is out of scope for a cost-sensitive app. Voice/Nudge use cases (Body double) want low time-to-first-token, favouring Haiku 4.5 or a small local model for short utterances and routing heavier planning sessions to Sonnet/Opus.
- Adaptive thinking is on by default for the larger models; set `effort` explicitly to control cost/latency (models overview page).
- Structured-output first-call grammar compile adds latency (section 2); keep schemas stable.

---

## 5. Local vs cloud inference

| Option | What it gives | Limits | Source |
|---|---|---|---|
| **Ollama (local server)** | REST API: `/api/chat`, structured outputs via `format` JSON schema, tool calling, `/api/embed`, OpenAI-compatible endpoint, `keep_alive` for model residency | User must install and run it and have hardware; local quality is below frontier for inference of implicit dependencies **[unverified]**; Ollama Cloud lacks structured outputs | https://github.com/ollama/ollama/blob/main/docs/api.md, https://docs.ollama.com/capabilities/structured-outputs |
| **WebLLM (in browser)** | WebGPU-accelerated in-browser inference, OpenAI-compatible API, web-worker support, Llama/Phi/Gemma/Mistral families; package v0.2.85 | Needs WebGPU-capable device, large first download, small models only; mobile/PWA viability **[unverified]** | https://webllm.mlc.ai/docs/ |
| **Cloud (Claude etc.)** | Best quality, no local hardware, structured outputs GA | Data leaves device; cost per turn; needs network | sections 1-4 |

Privacy angle for this product: the life graph contains intimate behavioural data (health-adjacent, ADHD/AuDHD). Cloud options differ: Anthropic and Google paid tiers state API content is not used for training/product improvement (Anthropic: "never used for model training without your express permission"; Google: paid tier content not used to improve products); Google's free tier does use content. Local-first storage plus cloud inference that sends only the minimum needed subgraph per request is a sensible middle path, with a fully local mode (Ollama) as a configured provider for users who want it.

Hybrid routing sketch **[design judgement]**: local small model for cheap classification/embedding and short nudges; cloud Haiku/Sonnet for extraction and planning sessions; cloud Opus only for rare deep-planning jobs. The provider interface from section 1.3 makes that a config choice.

---

## 6. Open questions for the next ticket

1. Is the first release cloud-inference-only (fastest) with local providers as a later adapter, or is offline/local a launch requirement?
2. Where does the graph live day one: browser-local (IndexedDB/SQLite-WASM) with Supabase sync, or Supabase-first? This decides sqlite-vec vs pgvector.
3. Extraction cadence: per message, per session, or nightly batch (the Batch API halves cost but adds delay)?
4. How should low-confidence inferred dependencies be confirmed by the user without adding cognitive load (ties to the "Recede" and "Planning session" glossary terms)?
5. Spike needed: run 20-30 real transcripts through Haiku 4.5, Sonnet 5.5 and one local model with the flat edge-list schema, measure edge precision/recall and latency. No primary source answers this.

## Source list

- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/about-claude/models/overview
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- https://platform.claude.com/docs/en/build-with-claude/embeddings
- https://ai.google.dev/gemini-api/docs/pricing
- https://developers.openai.com/api/docs/pricing
- https://ai-sdk.dev/docs/introduction and https://github.com/vercel/ai
- https://docs.litellm.ai/docs/ and https://github.com/BerriAI/litellm
- https://openrouter.ai/docs/quickstart
- https://github.com/getzep/graphiti
- https://docs.mem0.ai/introduction and https://github.com/mem0ai/mem0
- https://docs.letta.com/concepts/memgpt
- https://github.com/ollama/ollama/blob/main/docs/api.md and https://docs.ollama.com/capabilities/structured-outputs
- https://webllm.mlc.ai/docs/
- https://github.com/asg017/sqlite-vec
