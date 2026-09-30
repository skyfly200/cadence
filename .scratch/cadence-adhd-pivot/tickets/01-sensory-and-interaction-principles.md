---
title: Sensory and interaction principles
type: grilling
status: closed
assignee: skyler
blocked-by: []
parent: map.md
---
## Question

What are the non-negotiable sensory and interaction rules for a UI that suits ADHD/AuDHD brains (visual noise, motion, sound, predictability, layout stability, one-thing-at-a-time, the 'now' view plus one-tap conversation)? What makes the current tab-and-dashboard UI wrong, and what does 'never guilt, recede to a notepad' look like on screen?

Input: the ADHD design evidence research (branch research/adhd-design-evidence) strongly supports sensory controls for ADHD/AuDHD users; PDA-style autonomy-supportive tone is prudent UX but not evidence-backed.

Input (optional): competitor research tickets Sunsama teardown and ADHD-oriented app landscape, once closed, show what other apps do to reduce clutter and overwhelm.

Scope: the surface must cover todo, planning, habits and goals together without clutter (author's requirement). A test for every concept: does it stay one calm thing at a time?

## Round 1 decisions (grilling, in progress)

- **Default screen:** a single **Now card** (the one next thing, with start / not now / park). Everything else is one gesture away; a quiet peek at "later today" exists but is never shown by default.
- **Navigation:** one calm home with a single **lens switcher** (Now, Today, Habits, Goals); no tab bar; conversation is a second way to reach the same lenses. One lens visible at a time; the switcher looks and sits the same everywhere and never reorders.
- **Counts and urgency:** no badges, no counts, no red-for-late anywhere. Urgency is carried by wording and ordering; a truly time-critical item is one calm statement on the Now card.
- **Motion (author chose to keep current motion):** keep the current level of motion, with a toggle to turn it off. Note the tension with the sensory-atypicality evidence: the default is the busier one, so the toggle has to be easy to find.
- **Sound (author chose on by default):** sound is on by default at a gentle volume. Note: browsers block audio until first user interaction anyway, and ticket 09 decides what actually plays.
- **Predictability:** fixed anatomy. Capture is always in the same spot and one tap away; nothing reorders or reflows on its own. Adaptation happens inside the Now card's content, never in the frame around it.
- **Receded state:** on return you land on an empty capture surface with one soft line ("Welcome back. Nothing is on fire."). No counts, overdue lists or streak-broken messages. Unfinished items silently move to the Parking lot (Sunsama-style rollover and auto-archive); "want to see what's parked?" is available, never forced.
- **Customisation (author chose a full settings page):** sensory options live on a full settings page, not a one-time small profile.
- **Primary device:** phone first, desktop as a wider layout.

Open assumptions to confirm next round: OS-level reduced-motion is honoured automatically even though motion defaults to on; a single mute (which also stops the mic) exists even with sound on; each notification type can be silenced separately.

## Resolution

Round 1 decisions above stand. Round 2 (all recommendations accepted):

- **Now card contents:** title plus one line of context, and three fixed actions: *Start*, *Not now* (moves it later today, no judgement), *Park* (to the Parking lot). A tiny "why this one" line comes from the Life graph. Anything richer (notes, subtasks, estimates, timer) lives one tap deeper.
- **Who picks it:** Cadence suggests one; the user can say *Not this one* to get the next suggestion. Nothing skipped is ever marked failed. How it chooses (deadlines, energy, dependencies) is decided by the Life graph and coach tickets.
- **Other lenses:** each shows at most 3 to 5 items with a quiet "more" that expands in place; never auto-sorts under the user's finger. Goals show the next concrete step, not a wall of milestones.
- **Capture and conversation:** one fixed control (bottom of the screen on phone) takes typed or spoken input. A short line is filed instantly ("Got it, parked"); a longer or half-formed one opens a conversation sheet in the same place. No separate capture and chat controls.
- **Confirmed assumptions:** OS-level reduced-motion is honoured automatically; one mute exists (and also stops the mic) even with sound on by default; each notification type can be silenced separately on the settings page.
- **Type, touch, theme:** body text at least 16px, touch targets at least 44px, system theme by default, one calm accent colour, no saturated red or amber.
- **Confirmations:** no blocking modals and no confirm dialogs; every action is undoable (extends the existing undo/redo); sheets slide in and out of the same place; toasts are neutral and brief.

Standing tensions to carry forward (the author's choices, not evidence-led): motion defaults to the current, busier level with a toggle, and sound defaults on at a gentle volume; the design-evidence research supports sensory controls, so the toggle and mute must be easy to find. What plays and when is decided by the Nudge and audio system ticket.

Consequences for the current Nuxt app (`pages/index.vue`): the nine-tab bar, count badges, 9-11px text, pulsing footer dot, blurred full-screen loading overlay and confirm/destructive-styled dialogs all conflict with these principles; the Keep/cut audit judges the rest against them.

## Amendment (author: "the calm and quiet is a bit too extreme; simple yet not overly minimal")

All recommendations accepted. These supersede the matching decisions above; everything not listed still stands (fixed anatomy, no red-for-late, none of the shame words, undo instead of confirm dialogs, 16px text and 44px targets, four lenses behind one fixed frame, one capture control that opens a conversation sheet, silent rollover to the Parking lot).

- **Home (replaces "a single Now card only"):** the Now card plus a light strip of what is coming next (about three items) and a small row of today's habits. It reads as a day, not one item. The Now card remains the primary thing.
- **Numbers (replaces "no counts anywhere"):** progress that celebrates is allowed: "3 of 5 done today", a filling ring, weekly totals, a goal moving forward. Counts of what is left over, late or piling up stay banned (overdue, backlog size, unread badges). Rationale: the reward loop needs visible progress, and only "behind" numbers cause guilt.
- **Colour and personality (replaces "one calm accent colour"):** a richer but soft palette: a distinct hue per Lens or kind of thing, warm neutrals, friendly icons and light illustration, moderate saturation, no alarm reds. The line to hold is no clutter, not no colour.
- **Navigation (clarifies the fixed switcher):** a visible bottom bar with the four Lenses labelled and the capture button in the middle, always in the same place.
- **Items per Lens (replaces 3 to 5):** 5 to 7 by default with a quiet "more", still no auto-reordering.
- **Coming back after a break (replaces the empty capture surface):** the normal home screen with a warm one-line greeting on top and the parked things a tap away. Nothing is marked missed, but the day is visible.
- **Density setting (new):** Simple, Balanced (default) and Rich, on the settings page. Balanced is what is described above; Simple is the original stricter ticket 01 version; Rich adds more detail.

Consequences: the prototypes ticket must show all three densities side by side; the habit-reinforcement ticket now has visible progress to work with; the two stretch points in the audio ticket (briefing opened to read, habit list) now fit inside the 5 to 7 item rule and are easier to accept, but should still be tested.

## Amendment 2 (author reviewed the prototype)

- **Habits on Home:** only a small piece: a compact "Habits · 3 of 5 today" line that opens the Habits lens. The full habit list, the seven-dot week and the tiles live on the Habits lens only. This replaces the earlier "small row of today's habits" on Home.
- **Density:** Balanced is confirmed as the default.

- **Capture sheet (clarifies the capture rule above):** the sheet offers "Park it" for a quick capture and a "Talk it through" chip that turns the same sheet into a conversation; a long or half-formed capture is offered the chip rather than forced into it.

- **Home habits piece (clarifies Amendment 2):** "Habits · 1 of 3 today" counts only day-period habits; longer-period habits appear on the Habits lens only, grouped by period.
