---
label: wayfinder:map
---
# Map: Cadence ADHD/AuDHD pivot

## Destination

A build-ready **product spec** for Cadence as one calm app for basic todo, planning, habits and goals, acting as a personal assistant / life coach / career coach for ADHD/AuDHD people: vision and principles, domain model (Life graph), UI concept, sensory design, companion/coach behaviour, architecture, and a phased roadmap Claude Code can build from over time. Planning only: no code is built by this map.

## Notes

- Domain glossary: `/CONTEXT.md` (Capture, Parking lot, Node, Life graph, Nudge, Recede...). Use its terms; update it as terms resolve.
- Settled at charting:
  - First user is the author (dog-fooding), but design for the general ADHD/AuDHD pattern; nothing built for others until it is relied on personally.
  - Stack (author's decision): Nuxt / Vue / Pinia, hosted on Vercel (moving off Netlify). Live now at https://cadence.skylerfly.com/; may get its own domain later, so endpoint, OAuth and webhook identifiers must survive a domain change. Existing code (Next.js/Prisma/SQLite/Zustand, ~4,900 lines) is disposable as code; the Architecture and storage ticket decides the rest (data location, graph store, AI layer, background work), not the framework or host.
  - Core loop: capture, classify, connect, nudge. Never punish absence; positive reinforcement only; complexity lives in the system, not in the user's head.
  - Interaction starting point: a "now" view showing only what's next, conversation always one tap away.
  - AI layer must be provider-agnostic (author uses Gemini and Grok as capture entry points).
  - Coaching (life + career) is in scope; it is a persona/safety question as much as a feature (not therapy, never shame).
- Author's firsthand input (Fabulous): the original tone and its low-pressure gamification genuinely helped form habits; the audio and the clutter did not. Scope is broader than tasks: todo, planning, habits and goals in one app, without the clutter.
- Author's design premise: gamification works for ADHD because it raises dopamine around planning and tasks that are draining or boring, so reinforcement should reach the boring parts (planning, starting, small steps), not only completion. Build it in and test it; the evidence research found no direct efficacy data for gamification in adult ADHD apps.
- Assistant targets and LLM providers: Claude and ChatGPT join Gemini, Grok and Siri as capture/voice targets and as swappable LLM providers. Grok's custom MCP connector support is confirmed by the author (in-car use unconfirmed). Cadence's own app should also offer a hands-free voice experience.
- Research findings live in `research/` next to this map (copied from the throwaway `research/*` branches).
- Ticket files: `tickets/*.md`. Frontmatter: `type`, `status` (open|closed), `assignee`, `blocked-by`. Claim a ticket by setting `assignee` first. Frontier = open, unassigned, all `blocked-by` closed.

## Decisions so far

<!-- one line per closed ticket: [title](tickets/file.md): gist -->

- [Research: Fabulous app teardown](tickets/14-research-fabulous-app-teardown.md): keep the short warm "letter" voice, one tiny ask with a reason, one thing on screen, forgiveness by default; avoid pop-ups, upsells, cross-promotion, brittle streaks, unsourced statistics and borrowed science prestige. No early in-app copy was retrievable, so the author's memory of the original tone is the main source for the persona ticket.
- [Research: ADHD-oriented todo/planner app landscape](tickets/16-research-adhd-app-landscape.md): success = near-zero capture cost, visible time, no "what next" decision, non-punishing tone; failure = setup overwhelm, plans without execution, rigid AI scheduling, paywalls, bloat. Closest capture rivals are Todoist Ramble and Akiflow's MCP; none does life-graph dependencies, ambient spoken nudges or receding when quiet.
- [Research: Sunsama teardown](tickets/15-research-sunsama-teardown.md): adopt today-only framing, a workload guard, silent rollover with auto-archive and opt-in machine-written shutdown highlights (all inferred from the Life graph, not typed); avoid a ritual as the entry point, manual estimates, work-only framing and a paywall.
- [Research: voice-assistant capture feasibility](tickets/06-research-assistant-capture-feasibility.md): one authenticated capture endpoint plus a thin remote MCP server; Siri works now via Shortcuts; Gemini needs a confirmation tap per write and reaches the car only through Google Tasks; no documented in-car Grok path.
- [Research: ADHD/AuDHD design evidence](tickets/04-research-adhd-design-evidence.md): time blindness, working-memory deficit, delay aversion and sensory atypicality are supported; body doubling, gamification and the "startle" case for spoken nudges are weak or folk wisdom, so treat them as testable hypotheses and justify sensory controls on their own evidence.
- [Research: LLM provider and memory options](tickets/05-research-llm-and-memory-options.md): Claude API as default behind a thin provider-agnostic interface (Vercel AI SDK); own Node/Edge store as the memory source of truth; extract flat nodes+edges and validate rather than rely on recursive schemas; an extraction spike is still needed (goes to Architecture and storage).

## Not yet specified

- **Roadmap and phasing**: what ships first for daily dog-fooding vs later; only sharp once the graph, architecture and UI concept are known.
- **Spec assembly**: pulling the decisions into the single build-ready spec document.
- **Planning session flow**: the conversational weekly decompression; depends on graph model and coach persona.
- **Body-double presence beyond audio**: ambient/visual presence; depends on sensory principles and audio system.
- **Google Calendar approach**: keep/replace the current sync; depends on architecture and the keep/cut audit.
- **Onboarding for other ADHD/AuDHD users**: accounts, hosting, first-run; depends on trust model and architecture.

## Out of scope

- Deep ingestion of Gmail, texts, Drive, Docs/Sheets and Maps timeline: opt-in integration modules for a later effort; this spec only leaves seams.
- Notion / Trello / Google Keep sync: same, later modules.
- Multi-user hosting and public release: later effort.
