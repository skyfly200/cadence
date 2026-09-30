---
title: UI concept prototypes
type: prototype
status: closed
assignee: skyler
blocked-by: [01-sensory-and-interaction-principles, 04-research-adhd-design-evidence, 14-research-fabulous-app-teardown, 15-research-sunsama-teardown, 16-research-adhd-app-landscape]
parent: map.md
---
## Question

What should Cadence look and feel like? Produce 2-3 radically different rough UI concepts (now-view, capture, parking lot, conversation, receded state) to react to, and pick a direction.

Input (from the closed Nudge and audio system ticket): the prototypes should show a nudge (with "Not now" and "Stop these"), the morning briefing opened as a Today lens, the habit summary list, and the mute control, so the two choices that stretch the one-calm-thing rule can be reacted to.

Input (from the amendment to Sensory and interaction principles): the author found the original rules too extreme ("simple yet not overly minimal"). Prototype the Home (Now card, a strip of what is coming, a habit row), the visible bottom bar, the richer soft palette with light illustration, celebratory progress numbers, and show all three densities (Simple, Balanced, Rich) side by side so the author can react to real screens.

## Resolution

Three prototype variants were built (A Companion, B Day river, C Conversation) on the throwaway branch `prototype/ui-concepts` in the Nuxt app's Home route, switchable with `?variant=` and `?density=`, and the author reacted to them. Decision: the direction is a **blend**, built as variant D on the same branch (commit "PROTOTYPE: add Blend variant D"; run `npm run prototype`, open `http://localhost:3100/?variant=D`).

- **Base layout and features: variant B "Day river".** The day flows down a rail; the Now card is the expanded node on it, with what is coming beneath; earlier items collapse into "Kept earlier ✓ N"; the header carries a progress bar ("3 of 6 done today") and a habit ribbon; the Today lens opens with the morning-briefing note and groups the day (Afternoon, Evening, Later); Habits are two-column tiles with a seven-dot week; the visible bottom bar carries the four Lenses.
- **Now card: variant A's.** A rounded white card with a small illustration, a serif title, the one-line reason, and Start, Not now, Park buttons.
- **Capture: variant A's.** A raised round capture button in the middle of the bottom bar that opens a bottom sheet ("What's on your mind?", a mic, "Park it").
- **Goals: variant A's progress bars, with a point along the bar for each milestone.** A point is filled when its milestone is done; labels sit under the points at Balanced density and above.
- **Dark scheme: variant C's dusk palette as an option.** A toggle switches between light and dark; light (B's cool base) is the default, following the system setting by default per ticket 01.
- **Not adopted:** variant C's conversation-thread layout and its composer-as-capture control, variant A's warm cream background and ring/round habit style.
- **Copy:** the "Four days away, and that is fine. Here is today." line is dropped. The returning greeting is the same one regardless of how long the user was gone ("Welcome back. Nothing is on fire."); Cadence never mentions how long the user was away. This fits the no-guilt rule.

Assumptions to confirm on the real screens: the Now card keeps its warm sun and terracotta accents against B's cool base as a focal point; Balanced stays the default density (the author did not pick one, and Rich is untested); the two stretch points from the audio ticket (the opened briefing and the habit list) drew no objection while B's features were praised, but were not tested explicitly.

Left open: how a long or half-formed Capture turns into a conversation (variant B's "Talk it through" chip was not carried over), which stays in the fog as "Conversation sheet behaviour".

Not verified: the browser extension could not drive the localhost page, so the layouts and the dark scheme were checked only by rendering each variant at each density without errors, not by screenshot. The author reviewed the running prototype themselves.

Build note (out of scope for this map): folding variant D into the real Home page and rewriting it properly (the prototype was written without tests or error handling) is implementation work for the roadmap.

## Addendum (author reviewed the Blend)

- Balanced is confirmed as the default density.
- Habits display is simplified: a small piece on Now ("Habits · 3 of 5 today", opening the Habits lens) and the full list only on the Habits lens.
- The morning briefing is too much: the briefing note is removed from the Today lens and the nudge is dropped from the defaults (opt-in only). The habit list is fine and stays.
- Prototype commit: "PROTOTYPE: compact habits piece on Home, drop morning briefing note" on prototype/ui-concepts.

## Addendum 2

- **"Talk it through" chip added to the capture sheet (author request).** The sheet keeps the mic and "Park it", and gains a "💬 Talk it through" chip. Tapping it turns the sheet into a short conversation in place: the coach asks what part is nagging at the user most, then offers to add it to a related checklist or park it, with "Add to checklist" and "Park it" quick replies. Any text already typed is carried into the conversation as the first message. Prototype replies are canned. The entry point is settled; the behaviour of the real conversation stays in the fog item "Conversation sheet behaviour". Prototype commit: "PROTOTYPE: add Talk it through chip to the Blend capture sheet" on prototype/ui-concepts.

## Addendum 3

The Blend's Habits lens now shows habits grouped by recurrence period (Every day, Each week, Each month, Each quarter, Each year), each tile with one dot per target count and a "2 of 3 this week" label; tapping logs one occurrence, and tapping past the target undoes back to zero. Home's small piece counts only day-period habits. Prototype commit: "PROTOTYPE: habit recurrence periods on the Habits lens" on prototype/ui-concepts.
