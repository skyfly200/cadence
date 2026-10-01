---
title: Roadmap and phasing
type: grilling
status: closed
assignee: skyler
blocked-by: []
parent: map.md
---
## Question

In what order is the settled design built, what is the smallest version the author can start living in daily (dog-fooding), how does the old app hand over to the new one without breaking the live site, which remaining design questions (the fog) must be resolved before which phase, and how are background agents and review used to build it?

Inputs: every closed ticket; the keep/cut audit (replace slice by slice, tag pre-pivot); the code branches feature/domain-core and feature/google-tokens-server; the prototype branch prototype/ui-concepts; the cost constraint (cheap upfront).

## Resolution

Decided in grilling (all recommendations accepted).

### Phases
- **Phase 0, Groundwork (operational).** Review and merge `feature/domain-core` (41 tests) and `feature/google-tokens-server` (93 tests) via pull requests; review and apply the draft SQL files (`0001_graph_core.sql`, `0002_google_tokens.sql`); set the Vercel environment variables (`NUXT_PUBLIC_SITE_URL`, `CADENCE_TOKEN_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, the Google variables) and re-point `cadence.skylerfly.com`; remove `netlify.toml` once Vercel is live; test Calendar end to end; push the `pre-pivot` tag when the author chooses.
- **Phase 1, Capture-first core (the dog-fooding threshold).** The new tables and sync; the capture endpoint (raw text to an Idea, source-tagged, idempotent, acknowledging in under a second); the new Home (Now card with simple ordering by deadline and dependencies, the coming-up strip, the small habits line); the visible bottom bar and the capture sheet with **Add**; the Today lens and the Parking lot; the Habits lens with periods and logging; the dark toggle, density and basic settings; the weekly "kept" tally. A simple ordering rule starts the Now card.
- **Phase 2, Nudges and voice.** `nudge_queue`, the Supabase scheduler and Web Push; on-device templates, caps and quiet hours; the transition ritual; spoken output and tap-to-talk with the browser's speech; "Stay with me".
- **Phase 3, Understanding.** The provider-agnostic AI layer; extraction of Nodes and Links (after the extraction spike); the Goals lens with milestone bars; the **Discuss** conversation; the Planning session; the "why this one" line; AI-off, the Private flag, the transparency screen, export and the 7-day delete.
- **Phase 4, Reinforcement and signals.** The Garden and the Pressed book; reward lines and the slog tag; opt-in recaps; the Signals screen, the weekly feeling check, the Experiment button and the checkpoints at weeks 2, 4, 6, 8 and 12.
- **Phase 5, Reach.** Assistant connectors (Claude first) and the MCP sign-in server; the hand tests; the optional "Go deeper" views; Trips and Map as a module; onboarding for other people; later audio modules; Google Tasks ingest.

### Decisions
- **Dog-fooding starts at the end of Phase 1** (capture, Home, Today and Habits replace daily use of the old app), so the week-2 checkpoint has real use to measure.
- **Handover:** a "Classic view" switch keeps the old tabbed app available while the new Home is built; the new app is the default from the end of Phase 1; the switch is removed after Phase 3 once nothing relies on it. Old screens are deleted only when their replacement ships. No data migration, so old data stays visible only in the classic view.
- **Order:** nudges and voice (Phase 2) before AI understanding (Phase 3): nudges run on the deterministic core, need no API spend and do not wait on the spike. Until Phase 3, captures stay Ideas.
- **Design tickets created now** (the rest are settled in context): Now card selection logic (needed by Phase 1), Crisis-language handling (a safety item before Phase 3) and Planning session and Discuss flow (before Phase 3). The remaining fog items (garden art, Go deeper, body-double presence beyond audio, Google Calendar approach, onboarding for others, conditions on Things, later audio modules, assistant-connectors rollout) are resolved when their phase nears.
- **How it is built:** each slice is one branch built by a background agent, tests run by the assistant, a pull request reviewed by the author before merge, with a Vercel preview per pull request. Independent slices (the schema, the capture endpoint, the Home shell) run in parallel. Nothing merges to `main` without the author's review and nothing is pushed without the author saying so.

## Status

Phase 0 is complete (2026-09-30); see docs/SPEC.md section 13. Next: Phase 1, starting with the Now card selection logic ticket (23) and the first independent slices (sync for the new tables, the capture endpoint, the Home shell).
