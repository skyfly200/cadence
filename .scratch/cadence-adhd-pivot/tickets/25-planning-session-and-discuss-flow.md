---
title: Planning session and Discuss flow
type: grilling
status: closed
assignee: skyler
blocked-by: []
parent: map.md
---
## Question

What does the Planning session do (surfaces what was captured and organised since last time, proposes connections, flags conflicts, suggests priorities from stated goals, reconciles Ideas, offers the weekly and quarterly recaps) and how does a Discuss conversation from the capture sheet behave (asking what is nagging, extracting Nodes and Links, offering to add to a checklist or park, how it ends and returns to Home)? How does it stay opt-in, short and shame-free? Needed before Phase 3.

## Resolution

Decided in grilling (all recommendations accepted, 2026-10-01; the extraction spike (21) is deferred until there are enough real captures, so extraction starts on Sonnet 5.5 behind the model setting and is provisional):

- **Discuss:** opt-in per use (second button on the capture sheet), hidden when AI is off, about six exchanges, one question at a time, ends with a plain summary ("Here's what I heard: 3 things"). The user taps what to keep; nothing is written without a tap. "Done" is always visible; ending returns to Home with "Got it, parked." No advice beyond organising, no judgement. The transcript lives in memory only and is discarded at the end. First use shows one line of disclosure ("This sends this conversation and the relevant part of your list to Claude").
- **Proposals:** one strong-tier extraction call returns a flat list of Nodes and Links with confidence and quoted evidence, validated with Zod (invalid dropped). Proposals at 0.6 or above show as tap-to-keep cards; below that they stay plain Ideas. A tapped Link is saved with origin `proposed_accepted`.
- **Planning session:** user-started only (header menu, Plan lens, or an opt-in weekly reminder that is off by default). Five minutes or less, a sequence of cards: Ideas since last time (keep, park, drop); one or two proposed connections; conflicts; the weekly recap if on. Stop on any card and progress is kept. Reward-eligible when finished; no streak.
- **Conflicts:** found by the deterministic core (overlapping fixed times, the workload guard, dependency cycles), never by the AI, which at most rewords them with the Why now validation. One suggested fix each, never red, always optional.
- **Recaps:** at most three lines: the weekly tally, habits kept against targets, one goal that moved. Never misses, streaks or anything undone. Monthly and quarterly are separate opt-in toggles shown in the same session.
- **AI-off:** Discuss is hidden; the Planning session still runs on the deterministic core (triage, conflicts, recap) without AI proposals.
- **Privacy:** Private nodes are excluded from the slice with one quiet line ("2 private items not included"); nothing stores conversation text.
- **Build order:** crisis detector, then Discuss, then Planning session.
