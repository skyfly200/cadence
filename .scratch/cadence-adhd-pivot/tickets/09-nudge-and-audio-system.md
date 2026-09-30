---
title: Nudge and audio system
type: grilling
status: closed
assignee: skyler
blocked-by: [01-sensory-and-interaction-principles, 04-research-adhd-design-evidence, 19-research-own-app-handsfree-voice]
parent: map.md
---
## Question

What is the minimal v1 of spoken nudges, transition rituals, and body-double presence (one voice, one announcement per transition), how does music-as-timer fit, and what guardrails stop the audio layer becoming its own rabbit hole?

Input: the ADHD design evidence research (branch research/adhd-design-evidence) grades the spoken-nudge-vs-alarm startle claim as folk wisdom and body doubling as weakly supported. Justify the audio design by sensory sensitivity and user control, and treat voice/body-double behaviours as testable hypotheses.

Input from the author: they disliked the audio Fabulous plays. Any audio must be optional, minimal, and controllable; do not assume sound is a default part of the experience.

Input (from the closed Architecture and storage ticket): closed-app nudges go by Web Push from the Nuxt server (author is on Android), triggered by a Supabase pg_cron job every minute reading a `nudge_queue`; jobs are idempotent since delivery is best effort; in-app nudges stay client-side.

## Round 1 decisions (grilling, in progress)

- **Nudges in v1 (author chose the wider set):** the three core nudges (Leave-by / start-by for time-critical Commitments including travel time; At-risk Background; Transition) PLUS a daily habit summary and a morning briefing, both on by default. This adds two default nudges that need wording, content and cap rules (see open questions).
- **Sound (author chose voice on by default):** spoken nudges are ON by default, not opt-in. Constraints that still hold: a spoken nudge plays only while the app is open (a web page cannot speak when closed); browsers block audio until first user interaction; when the app is closed the OS notification tone plays; one mute silences everything including the mic. This supersedes the earlier input that audio must be optional.
- **Transition ritual:** the same short cue every time (soft tone, light vibration on Android, Now card changes to "Next: X" with one line of why, spoken phrase since voice is on); one gentle heads-up before a block ends (default five minutes, only for blocks over 30 minutes), then one transition; nothing more.
- **Body doubling:** an opt-in "Stay with me" mode: quiet unless talked to, optional soft ambient sound, one small presence cue, one check-in at the half-way point; a hypothesis whose usefulness the Success signals ticket measures.
- **Music-as-timer:** not in v1; a block may hold a link that opens the user's own playlist; playlist-length timing goes on the roadmap as an opt-in module.
- **Caps and quiet hours:** at most five nudges a day by default (adjustable); quiet hours follow the sleep window; one nudge per Node per day; "Not now" reschedules once and a second dismissal silences that Node; snoozes and dismissals are never logged as failures.
- **Voice:** the browser's built-in speech voices in v1 (free, offline, picker limited to device voices); natural cloud voices later as an option.
- **Wording:** templates filled from the graph and rendered on the device, following the coach voice (plain and warm, one reason plus one small ask, no urgency words); the AI is never on the delivery path; only the Now card's optional "why this one" line uses the AI.
- **Feedback controls:** two quiet controls on every nudge, "Not now" and "Stop these" (turns off that type or that Node, remembered, reversible in settings); no ratings.

## Resolution

Round 1 decisions above stand. Round 2 (the author's answers):

- **Morning briefing (author: read it by opening it):** the push only announces that the briefing is ready; the content is read inside the app when opened. It is delivered at the wake time from settings, with the normal notification tone, and can be turned off from the nudge with "Stop these". ASSUMPTION to confirm in the prototypes: the briefing opens as the Today lens under the ticket 01 rules (Now card first, then at most 3 to 5 items, no counts, no overdue), and speaks at most its one-line "first up" sentence when voice is on.
- **Daily habit summary (author: a list of every habit still to do):** sent once a day at a time the user chooses, and only when at least one habit is open. It is a list of habit names, with no count number and no "overdue" or "behind" wording. ASSUMPTION to reconcile with ticket 01: the list follows the lens rule of 3 to 5 items with a quiet "more"; the push text stays short and the list is read on opening. This stretches ticket 01's one-calm-thing test, and the prototypes should test whether it feels calm.
- **Cap (author: the two extras do not count):** the daily cap of five counts only the core nudges (Leave-by / start-by, At-risk Background, Transition). The morning briefing and the habit summary sit outside the cap and are limited to once each per day. Worst case per day is seven interruptions, all suppressed during quiet hours.
- **Voice on by default:** said once at first run ("Cadence can speak short nudges while it's open. You can mute it anytime."); plays only after the user's first interaction; nothing is spoken in quiet hours; one-tap mute always available.
- **Late or missing pushes:** never escalate or resend. A late nudge is dropped if it is no longer useful (for example a leave-by after the leave time). If notification permission is off, show one gentle, dismissible notice in settings and on the Capture surface, not a repeating warning. No email or SMS fallback.
- **In the car:** spoken nudges from the app when closed are out of v1 (background speech and screen-off audio are native-only). In-car hands-free runs through the capture channels (Gemini, Claude, Grok), not app nudges.

Summary of the whole ticket: five nudge kinds (Leave-by, At-risk Background, Transition, morning briefing, habit summary); default sound is a short soft tone with text at low volume plus spoken voice from the browser's built-in voices while the app is open; one mute silences everything including the mic; templates rendered on the device, never the AI on the delivery path; feedback via "Not now" and "Stop these"; Web Push from the Nuxt server via the Supabase-scheduled `nudge_queue`, jobs idempotent; body doubling ("Stay with me") is an opt-in experiment; music-as-timer, cloud voices and in-car mirroring are later opt-in modules.

Tensions to remember (author's choices): voice and two extra nudges are on by default while the evidence supports sensory control, not a startle case, so the mute, per-type "Stop these" and quiet hours must be easy to find; Q10 and Q11 stretch the one-calm-thing and no-lists rules from ticket 01 and need to be tested for how they feel.

Note (from the amendment to Sensory and interaction principles): Lenses now show 5 to 7 items and celebratory progress numbers are allowed, so the opened briefing and the habit list fit inside the rules; still test how they feel.

## Amendment (author reviewed the prototype)

- **Morning briefing removed from the defaults:** the author found it too much. It is now an opt-in nudge that is off by default (say so if it should be deleted outright). The Today lens no longer opens with a briefing note.
- **Habit list kept:** the daily habit summary (a list of open habit names, no count) stays a default nudge.
- **Default nudge kinds:** four: Leave-by / start-by, At-risk Background, Transition, and the daily habit summary. The cap of five a day covers the first three; the habit summary sits outside it, once a day, so the worst case is six interruptions a day.

Note (from the Habit recurrence amendment): the daily habit summary lists only day-period habits (and anything pinned to today). A weekly, monthly, quarterly or annual habit that is still open gets at most one gentle mention in the final stretch of its period, and none after the period closes. These count toward the habit summary's once-a-day limit rather than adding new nudges.
