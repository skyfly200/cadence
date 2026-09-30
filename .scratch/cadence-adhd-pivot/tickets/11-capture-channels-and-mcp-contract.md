---
title: Capture channels and MCP contract
type: grilling
status: closed
assignee: skyler
blocked-by: [10-architecture-and-storage, 18-research-claude-chatgpt-integration, 19-research-own-app-handsfree-voice]
parent: map.md
---
## Question

What are the capture channels (typed, spoken, external assistants over MCP or similar), what is the contract for pushing raw input in, and how is it classified on arrival without asking the user which bucket?

Input: the capture feasibility research (branch research/assistant-capture-feasibility) recommends one authenticated capture endpoint plus a thin remote MCP server on top; Siri via Shortcuts works now; Gemini needs a per-write confirmation and in-car goes through Google Tasks; in-car Grok has no documented path. Resolve the contract and which channels ship first.

Settled by the author: Nuxt/Vue/Pinia on Vercel at https://cadence.skylerfly.com/ (own domain possible later). The contract must be hosted-function friendly (Vercel limits), and the MCP OAuth issuer, redirect URIs and endpoint URLs must survive a later domain change (or be designed to be re-pointed cheaply).

Author addition: Claude and ChatGPT are capture/voice-assistant targets alongside Gemini, Grok and Siri, and Cadence's own app should offer a hands-free voice experience of its own (the most controllable route). Inputs: the Claude/ChatGPT integration research and the own-app hands-free research. Decide which channels ship first and how the own-app voice mode relates to the external assistants.

Author decision: ChatGPT and Siri are OUT as capture/voice integrations (skipped). Targets are Claude, Gemini and Grok (custom MCP connectors) plus Cadence's own app; Siri/Shortcuts and ChatGPT findings stay in the research files as reference only. OpenAI remains a possible swappable LLM provider for Cadence's own AI layer unless the author says otherwise.

Input (from the closed Architecture and storage ticket): captures land in Supabase (source of truth) and sync down to devices; the MCP sign-in is a thin Nuxt authorization server reusing the Supabase passkey login and issuing its own short-lived tokens (re-test Supabase issue #2820 first as a cheap spike); background and scheduled work runs from a Supabase pg_cron job calling a Nuxt route, so route acknowledgement must beat pg_net's 2 s default timeout; author is on Android, in-car Gemini reaches Google Tasks, Keep and Calendar.

## Resolution

Decided in grilling (the author's answers, with two departures from the recommendations):

- **Channels: own app only in v1 (author: Q1 c).** Cadence's own app (typed input and tap-to-talk voice) is the only channel until it is polished. Claude, Gemini and Grok connectors come afterwards, on the same capture path, so the connector work is designed now but sequenced later. This also defers the MCP sign-in server to that later phase.
- **One shared capture path.** Every channel, including the app itself, posts to the same authenticated capture endpoint, tagged with a `source` (app now; claude, gemini, grok later). The app's tap-to-talk uses the browser's free speech recognition in v1 (the author is on Android Chrome); a paid streaming service is an opt-in upgrade later; screen-off listening, a wake word and in-car listening stay out (native-only).
- **Tools an assistant will get (author: Q2 a, plus completion).** Four tools: `capture` (adds raw text as an Idea; additive), `whats_next` (read-only: the Now card and a few items coming up), `log_kept` (logs an occurrence on a Habit by name), and `complete` (marks a Commitment, or a milestone Goal, done by name; added at the author's request). Each write is idempotent, undoable in the app, logged with its source, and asks a short question when the match is unclear instead of guessing. Nothing can delete or edit. Replies are short, plain and spoken-friendly, in the coach voice ("Got it, parked."), with no formatting.
- **Classification on arrival (author: Q3 a).** Acknowledge instantly, classify afterwards: the raw text lands as an Idea in under a second and the reply goes back at once; an asynchronous server step then extracts Nodes and Links with a confidence, matching existing Nodes silently when sure; anything unclear stays an Idea for a Planning session. The user is never asked which bucket. Which model runs the extraction waits on the extraction spike.
- **Permissions and revoking (author: Q4 a).** Two scopes: `read` (`whats_next`) and `write` (`capture`, `log_kept`, `complete`; ASSUMPTION: the write scope is named that way now that completion is included). Each connected assistant gets its own short-lived, rotating tokens. A "Connected assistants" list in Settings shows what is connected, when each was last used, and a Revoke button.
- **Domain and registration (author: Q5 a).** Register connectors against `cadence.skylerfly.com` when the connector phase starts, with the issuer and all URLs coming from one config value (the same site URL setting the app already uses). If the domain changes, the connectors are re-added (about a minute each).
- **In the car (author: Q6 c).** Skipped for now: no hand-test task and no Google Tasks ingest in v1. The hands-free unknowns stay listed in the research (voice mode with a custom connector, Grok in the car, Gemini in the car); Google Tasks ingest stays an opt-in module in the fog.
- **Safeguards (author: Q8 a).** Captured text is data, never instructions. Every capture is logged with its source in the occurrence log. Identical captures from the same source within a few minutes count once. Size and rate limits apply. There are no destructive tools.

Left for later: which channel comes first when connectors start (Claude is the strongest per the research), the hand tests, the MCP sign-in server (a thin Nuxt authorization server reusing the passkey login), and the exact connector registration steps.
