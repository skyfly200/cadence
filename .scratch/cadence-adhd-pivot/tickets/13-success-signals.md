---
title: Success signals
type: grilling
status: closed
assignee: skyler
blocked-by: [02-coach-role-and-persona]
parent: map.md
---
## Question

How will the author know it is working beyond novelty (e.g. still used at week 3, captures per day, dropped-ball rate, days without guilt), and what lightweight signals does the spec need?

Input: the ADHD design evidence research says gamification and body doubling lack efficacy evidence in adults; success signals should let the author test which mechanisms actually help.

Input (from the closed Nudge and audio system ticket): measure whether the default-on choices help or annoy: the rate of "Stop these" and "Not now" per nudge type, whether nudges are acted on, whether users keep voice on, and whether the opt-in "Stay with me" mode is used and repeated. These are the tests of the hypotheses the evidence research could not confirm.

Input (from the closed Habit formation and reinforcement ticket): success signals must tell which reward types are worth keeping. Measure use of each toggle (animation, sound, coach lines, tally, garden), whether the "slog" tag is used and whether tagged items get started sooner, whether opt-in recaps stay on, and whether people open the garden and the pressed book. Nothing is a failure signal for the user; these are signals for the product.

Input (from the closed Trust and transparency model ticket): no analytics by default. Success signals are computed on the user's device from the occurrence log. Any product telemetry is strictly opt-in, aggregate, off by default and shown on the transparency screen. Private Nodes are excluded from anything sent to the AI.

## Resolution

Decided in grilling (all recommendations accepted, with the author's amendment to Q6):

- **Three main signals of "it's working".** (1) **Still in use:** weeks with at least one kept action, plus **coming back after a break** (the single most telling one for an ADHD tool, since coming back is what the no-guilt promise is for). (2) **Things kept per week:** a trend, never rewarded as volume. (3) **A one-tap weekly feeling check.** Two supporting signals: **silently lapsed time-critical items** (a fixed-time Commitment that passed with no done, moved or parked) and **how quickly captures are triaged**. None is ever shown to the user as a failure; lapses are tracked only to improve nudges.
- **Where signals live.** A "Signals" screen in Settings, **off by default and on-device only**, for the author while dog-fooding: plain-language numbers with a one-line explanation each, exportable. The user-facing view is the opt-in weekly recap already decided (warm, no scores). Nothing leaves the device.
- **Testing which mechanisms help.** The user runs their own small experiments: Cadence logs when each feature was switched on or off (settings history), and an **"Experiment" button** starts a one-to-two-week try of turning something off or on, then compares kept-per-week and "Not now" rates before and after. It compares only when asked and never changes anything automatically. No random assignment.
- **Nudge health is report-only in v1.** The Signals screen shows, per nudge type, how many were shown, acted on, "Not now" and "Stop these". Nothing adapts automatically; any change stays the user's decision.
- **Self-report.** One tap in the weekly recap: a three-choice check ("Lighter / About the same / Heavier") with an optional short note that goes into the user's Ideas. It can be skipped freely and is not repeated; there is no other survey.
- **Checkpoints (author: add week 3 and week 9).** Four checkpoints over the first twelve weeks of the author's own use: **weeks 3, 6, 9 and 12**. Rules of thumb at each: keep a mechanism if it was used in at least half the weeks and "Stop these" did not rise; cut or rework it if the user switched it off within two weeks. The Signals screen shows each mechanism against its rule. ASSUMPTION for the author to confirm: weeks 3 and 9 are lighter check-ins (read the signals, note the trend, cut only when the case is clear), while weeks 6 and 12 are the decision checkpoints. The week-3 check directly addresses the novelty-decay worry (the research found no measured retention data for ADHD users, so this is the evidence-building step).

What the signals are computed from: the occurrence log and the settings history, on the device; the domain core's tally and runs (branch feature/domain-core) are the base. Private Nodes are excluded from anything sent to the AI, and no analytics are added.

What the mechanisms under test are (from the earlier tickets): default-on spoken nudges, the transition ritual, "Stay with me" body doubling, coach lines, the weekly tally, the garden, the slog tag and the opt-in recaps.

Left for the build: the Signals screen, the weekly feeling check, the Experiment button, the checkpoint cards and the nudge-health counters are build items for the roadmap.
