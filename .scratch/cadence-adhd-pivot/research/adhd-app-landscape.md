# ADHD / neurodivergent app landscape (for Cadence)

Ticket: `.scratch/cadence-adhd-pivot/tickets/16-research-adhd-app-landscape.md`. Researched 2026-09-29. Fabulous and Sunsama excluded (covered elsewhere).

## Method and honesty notes

- Primary sources = vendor sites, pricing pages, app-store listings, help docs. Pricing and feature claims below are from those unless marked.
- **Reddit and forums could not be read directly** (the fetch tool blocks reddit.com; search returned no thread URLs). "What users say" therefore comes from app-store review excerpts, Trustpilot summaries, and third-party review sites that quote Reddit. Treat user-voice claims as second-hand. Direct Reddit mining is a follow-up.
- Many "best ADHD apps" articles are vendor content marketing (Lifestack ranks itself first; Inflow, Tiimo, Kinmory, Saner.AI all publish comparison posts). Marked **[vendor]** where used.
- "Novelty decay" is asserted widely but I found **no measured retention data for ADHD samples**. One source admits this explicitly (Kinmory, below).
- Inflow's real domain is getinflow.io (inflow.app does not resolve). Routine's own site makes no ADHD claims.

## Comparison table

| App | Exists now? | Core mechanism | Works for ADHD users (reported) | Fails / abandoned (reported) | Pricing | AI / voice |
|---|---|---|---|---|---|---|
| **Tiimo** | Yes | Visual day planner: icons, colours, circular timer; energy-based planning | "Only one that has actually helped" (App Store review); iPhone App of the Year 2025, 4.6/5 from 20K ratings, 4M+ downloads | Bugs ("one step forward and two steps back", App Store review); web planner + AI paywalled | Free mobile; Pro ~$7.99/mo or $79.99/yr (Lifestack **[vendor]**); App Store says $7-$54/yr by region | AI Co-Planner: voice or text to tasks with time estimates; Siri integration (Tiimo site, App Store) |
| **Goblin.tools** | Yes | Single-purpose AI tools; Magic ToDo breaks tasks into steps with a "spiciness" slider | Zero signup, free, no learning curve; viral on TikTok/Reddit 2023-24 (thawly.ai, 2026-05-07, third-party) | Plans but no execution: no timer, no persistence, no notifications/widgets; "list was never the problem" | Web free, no ads; native apps ~$4 one-time; optional Pro; Patreon/Ko-Fi (goblin.tools/About) | LLM-backed; no native voice found |
| **Structured** | Yes | Visual timeline merging tasks and calendar | Colour tasks, end-of-day time visibility (Saner.AI **[vendor]**) | Paywall at install, setup complexity (same source); no ADHD claims on own site | Free + Pro; $2.99-$6.49/mo, $9.99-$29.99/yr, lifetime $64.99-$99.99 by region (third-party); 15M+ downloads (structured.app) | "Plan with AI" page exists; details unverified |
| **Motion** | Yes | AI auto-schedules tasks into calendar, reschedules on change | Removes "when do I do this" decision (ChoosingTherapy) | Rigid, packs days tightly, clunky UI, weak mobile, trial auto-converts (Trustpilot via Saner.AI **[vendor]**); Reddit "mixed to negative" 2025-26 (second-hand) | Pro AI $19/seat/mo (annual, 33% off), Business $29; no free plan, 7-day trial (usemotion.com/pricing); monthly ~$49 per Saner | AI chat, credits (7,500/mo Pro) |
| **Akiflow** | Yes | Time-blocking inbox to calendar | Not ADHD-specific; power-user tool | Price; no free plan | $34/mo, $19/mo yearly, 2- and 5-year "Believer" plans; 7-day trial, card required (akiflow.com/pricing) | Aki AI; **MCP connector launched 2026-06-30** (Product Hunt, via search) for Claude/ChatGPT/Cursor |
| **Amazing Marvin** | Yes | 100+ toggleable "strategies" (Procrastination Wizard, Super Focus) built on behavioural psych | Deep customisation, nested tasks | First week "genuinely overwhelming"; setup is itself a task; old-feeling mobile; no notes; no collab (Saner.AI, 2026-08-10 **[vendor]**) | $8/mo or $96/yr, one plan, 14-day trial no card; pay-what-you-can (amazingmarvin.com/pricing) | No native AI (Saner review) |
| **Inflow** | Yes (getinflow.io) | CBT-based ADHD coaching program: 5-min daily lessons, community, co-working | Brain Hacks, practical CBT tools (ChoosingTherapy, reviewed 2025-03, updated 2026-07) | Heavy reading for ADHD users; billing/cancellation complaints incl. Reddit (second-hand); "downloaded and didn't use" | $47.99/mo or $199/yr, 7-day trial (getinflow.io/faqs); ChoosingTherapy also lists $22.49/mo, $95.99/yr without coaching | None notable |
| **Finch** | Yes | Self-care pet: complete small goals to grow a bird | No streak punishment; can lapse two weeks without penalty (third-party); ~4.9 stars, ~754K US ratings (third-party) | Dense onboarding; iOS/Android price disparity (third-party) | Free tier comprehensive; Plus $9.99/mo or $69.99/yr, cosmetic (autonomous.ai; Finch help page returned 403) | Not a feature |
| **Focusmate** | Yes | Scheduled video body-doubling: 25/50/75 min sessions with strangers | External presence helps initiation | Camera on, advance booking, rigid; stranger matching uncomfortable; no controlled evidence (search summaries) | Free 3 sessions/wk; Plus $8/mo annual, $12 monthly (focusmate.com/pricing) | None |
| **Llama Life** | Yes | Single-task list with per-task timers, list end-time | Llama mascot gentle motivation; chimes counter time blindness (Focus Bear AuDHD review, 2024-08-05 **[competitor vendor]**) | Doesn't stop hyperfocus | 7-day trial, monthly/annual; amounts unverified (page did not render) | None found |
| **Routine** | Yes (YC-backed, 100K+ users claimed) | Tasks + calendar + notes + meetings in one | Generalist; no ADHD claims on own site | Not evaluated for ADHD | Free tier; amounts unverified | "Smart scheduling suggestions" |
| **Todoist** | Yes | List/project manager with natural-language quick add | Ubiquitous, fast capture | Generic; lists demand executive function | Free (5 projects); Pro/Business paid (amounts not extracted) (todoist.com/pricing) | **Ramble** voice-to-tasks (GA Jan 2026): streams speech, live edits, 40+ languages, 10 sessions/mo free, unlimited Pro; cannot create subtasks or custom reminders (Todoist help) |
| **TickTick** | Yes | Tasks + calendar + habits + Pomodoro | Pomodoro built into every task (BrightMind, third-party) | ADHD-useful features (Pomodoro, calendar sync, habits) are Premium-only; feature sprawl | Premium ~$2.99/mo, $35.99/yr (third-party) | Voice dictation (third-party) |

### Newer AI-assistant entrants (thinly sourced)

- **Numo**: shame-free, voice brain-dump builds routine (store listing; Lifestack **[vendor]** review).
- **Lifestack**: energy-aware scheduling, proactive nudges (vendor's own claim, unverified).
- **Saner.AI**: chat AI assistant that nudges to next priority (its own blog).
- **Focus One, Win Todo, DoThisNow**: small App Store apps built on "one task / three priorities" (listings only).
- **Lunatask**: encrypted tasks/habits/journal that "remembers what to work on next" (search result only).

No independent evidence of retention or efficacy found for any of these.

## Recurring patterns of success

1. **Near-zero capture cost.** Goblin.tools (no signup) and Todoist Ramble (speak, edit live) win on friction. Kinmory **[vendor]** (updated 2026-09-28) argues abandonment is caused by high capture cost at the moment of intention, citing Gilbert et al. 2022 (external reminders cut forgetting roughly 45% to 5%) and Daminger 2019, but states the studies are general-population and "we have no evidence that any of this reduces measured cognitive load".
2. **Make time visible.** Tiimo, Structured, Llama Life externalise time (timelines, end times, timers, chimes) against time blindness.
3. **Single-tasking / removing the "what next?" decision.** Motion (auto-schedule), Llama Life, Focus One.
4. **Non-punishing tone.** Finch (no streaks), Llama mascot, Numo. Tiimo names shame reinforcement as a core failure cause (Tiimo resource hub, 2026-04-28 **[vendor]**).
5. **External presence / accountability.** Focusmate body doubling; evidence still thin.
6. **Task breakdown on demand** (Goblin Magic ToDo spiciness slider).

## Recurring patterns of failure

1. **Novelty decay.** Widely asserted (Tiimo blog, AFFiNE, Edge Foundation): engagement collapses in weeks 2-3. No ADHD-sample retention data found.
2. **Setup and configuration overwhelm.** Amazing Marvin, Structured, TickTick, Finch onboarding.
3. **Planning without execution.** Goblin.tools produces lists but no follow-through.
4. **Rigid or over-packed AI scheduling** (Motion) adds load when a day goes wrong.
5. **Paywalls and billing friction.** Motion and Inflow trial auto-conversion and cancellation complaints; Structured paywall at install; TickTick's useful features premium-only.
6. **Reading/text-heavy content** (Inflow modules).
7. **Feature bloat, weak mobile**, where the moment of need is (Goblin, Marvin, Motion).
8. **Guilt-inducing backlogs**: overdue lists and broken streaks (general claim; Finch is the counterexample).

## Gaps relative to Cadence's vision

Mapping is my synthesis. Absence in marketing pages is not proof of absence in product.

| Cadence principle | Closest competitor | Gap |
|---|---|---|
| Lowest-friction capture, incl. voice assistants via MCP | Todoist Ramble (in-app voice); Akiflow MCP (Jun 2026) | Ramble is in-app only, no subtasks or custom reminders. Akiflow's MCP targets power users at $19-34/mo. None found built for "tell a voice assistant and it lands in the right place, ADHD-tuned". |
| Life graph of dependencies | Marvin (nested hierarchy), Routine (custom types) | Only hierarchies/projects. No competitor found modelling cross-domain dependencies. Notion setups not surveyed. |
| Recede to a notepad when the user goes quiet | Finch (no penalty on lapse) | Finch forgives lapses but stays a full app. Nobody found that actively simplifies itself on absence. |
| Never punish absence | Finch, Numo | Only wellness/habit apps; task/planner tools keep overdue debt. |
| Ambient spoken nudges | Llama Life chimes; Lifestack/Numo "proactive nudges" (vendor claims) | No verified spoken, ambient, context-aware nudging. Mostly push notifications and timers. |
| No clutter | Goblin.tools | Minimal but stateless. Rich apps (Marvin, TickTick, Motion) are cluttered. |
| Coach + planner in one | Inflow (education), Motion (scheduling) | Coaching and task system are separate products; Inflow is $200/yr content, not an assistant that knows your tasks. |

Open follow-ups: direct Reddit/forum sentiment (r/ADHD, r/productivity); Notion templates; verified prices for Todoist, TickTick, Llama Life, Routine; retention data.

## Sources

- Tiimo: https://www.tiimoapp.com/product ; https://apps.apple.com/us/app/tiimo-to-do-list-planner/id1480220328 ; https://www.tiimoapp.com/resource-hub/why-productivity-systems-fail-adhd ; https://lifestack.ai/blog/tiimo-pricing (third-party)
- Goblin.tools: https://goblin.tools/About ; https://thawly.ai/reviews/goblin-tools
- Structured: https://structured.app/ ; https://www.saner.ai/blogs/best-structured-alternatives
- Motion: https://www.usemotion.com/pricing ; https://www.saner.ai/blogs/motion-reviews ; https://www.choosingtherapy.com/motion-app-review/
- Akiflow: https://akiflow.com/pricing ; https://product.akiflow.com/p/mcp-model-context-protocol-connector-for-ai-assistants
- Amazing Marvin: https://amazingmarvin.com/pricing/ ; https://www.saner.ai/blogs/amazing-marvin-review
- Inflow: https://www.getinflow.io/faqs ; https://www.choosingtherapy.com/inflow-adhd-app-review/
- Finch: https://finchcare.com/ ; https://www.autonomous.ai/ourblog/finch-self-care-app-review-full-breakdown
- Focusmate: https://www.focusmate.com/pricing/ ; https://arxiv.org/html/2509.12153v1 (not opened)
- Llama Life: https://www.focusbear.io/blog-post/review-of-llama-life-by-an-audhder
- Routine: https://routine.co/compare/routine-vs-todoist
- Todoist: https://www.todoist.com/pricing ; https://www.todoist.com/help/todoist/todoist-and-ai/dictate-to-add-tasks-with-ramble-P1Raq7vVF
- TickTick: https://brightmind.club/blog/ticktick-for-adhd (search snippet only)
- Abandonment: https://www.kinmory.ai/blog/adhd_app_graveyard ; https://edgefoundation.org/adhd-and-the-search-for-the-perfect-system/ (snippet only)
- AI entrants: https://lifestack.ai/blog/best-ai-assistants-for-adhd (vendor)
