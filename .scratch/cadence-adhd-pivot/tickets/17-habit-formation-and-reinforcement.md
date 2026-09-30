---
title: Habit formation and reinforcement
type: grilling
status: closed
assignee: skyler
blocked-by: [01-sensory-and-interaction-principles, 02-coach-role-and-persona]
parent: map.md
---
## Question

How should Cadence reinforce habits and kept commitments so it feels like Fabulous at its best (gentle gamification, real behaviour change, no pressure) without the brittle streaks, pageantry, clutter or intrusive audio? What are the reinforcement moments, the reward forms (words, small visuals, progress), how are lapses handled (forgiveness, undo, non-daily habits), and how does this replace the current points system?

Input: the author formed better habits with Fabulous's reinforcement and found it low-pressure; disliked its audio and the clutter. The design-evidence research found delay aversion well supported (short feedback loops) but no efficacy evidence for gamification in adult ADHD apps, so treat mechanisms as hypotheses to test.

Author's premise: gamification works for ADHD because it raises dopamine around planning and tasks that are draining or boring. So reinforcement should cover the boring/draining parts (planning itself, starting, small steps), not only completion. This is a design premise to build in and test; the evidence research found short feedback loops well supported but no direct efficacy data for gamification in adult ADHD apps.

Input (from the closed Sensory and interaction principles ticket): celebration and reward visuals must fit the motion and sound rules (current-level motion with a toggle, gentle sound on by default with one mute, OS reduced-motion honoured) and the receded state (no streak-broken messages, silent rollover to the Parking lot). The Habits lens shows 3-5 items at a time.

Input (from the closed Nudge and audio system ticket): audio defaults are a short soft tone with text at low volume plus spoken voice from the browser while the app is open; any celebration sound or speech follows the same mute, quiet hours and first-run disclosure; a daily habit summary already exists as a list of open habit names with no count.

Input (from the amendment to Sensory and interaction principles): visible progress is now allowed ("3 of 5 done", rings, weekly totals, goal progress; never leftover, late or backlog counts), the palette is richer with light illustration, and Lenses show 5 to 7 items. Design reinforcement moments with those materials.

Input (from the amendments after the prototype review): Home shows habits only as a small "Habits · 3 of 5 today" line; the full list, week dots and detail live on the Habits lens; the daily habit summary nudge stays a default (a list of open habit names, no count).

Input (from the Habit recurrence amendment on the Life graph ticket): habits have a period (day, week, month, quarter, year) and a target count, calendar-based, flexible by default with optional pinning; only day-period habits show on Home and in the daily summary; longer periods live on the Habits lens grouped by period. This ticket decides what a met period feels like, how progress is celebrated across periods (streaks that can die stay ruled out), and how a closed period is handled (quietly, no failure mark).

Note: habit periods are day, week, month, quarter, every 4 months, every 6 months and year (calendar-based); reinforcement has to make sense across all seven.

## Round 1 decisions (grilling, in progress)

- **Behaviours that earn reinforcement:** logging a habit, pressing Start on the Now card, finishing a Commitment, completing a Planning session, and capturing a thought. Nothing is rewarded for hours spent or volume.
- **Reward forms (author: coach lines and a growing collection):** a short coach line, a small progress update, a soft tone, and one weekly tally ("14 things kept this week"); an occasional warm note in the spirit of Fabulous's letters; PLUS a growing collection as a reward in v1 (author addition; its design is settled in round 2). Points, XP and levels are retired, along with the planning streak.
- **Surprise:** mostly predictable, with a rare small delight (a warm note or light animation), capped and never tied to loss, inside the manipulation limits from the coach ticket.
- **Lapses and runs:** a period that ends without meeting the target closes quietly and shows as a lighter one, never a failure. Runs are allowed only as praise ("kept 6 weeks running" once a run is two or more periods long) and vanish silently when broken, with no alarm or reset message and no streak that can die.
- **Boring or draining work:** the user can tag something "a slog" (or Cadence notices it has been put off often and offers the tag); a tagged item gets a bigger reward and a tiny start ritual (a two-minute "just start" prompt).
- **Recaps:** immediate feedback (under a second) on every logged action; a small end-of-day "here's what you kept" line on Home; a weekly recap in the Planning session and a monthly or quarterly recap for longer-period habits; recaps are opt-in.
- **Customisation:** reward types are simple toggles on the settings page (animation, sound, coach lines, tally, collection); no adaptive learning in v1; friends, circles and leaderboards are out of scope; success signals decide which rewards to keep or cut.

## Resolution

Round 1 decisions above stand. Round 2 (the collection), with the author's amendments:

- **The collection is a garden (author addition to Q2).** A small illustrated garden that grows as things are kept: habits become plants, kept periods become blooms, goals become trees. The author's own interests can theme it (for example a mushroom patch for foraging, a lit lantern for a fire piece). Fabulous-style letters survive only as the occasional warm note.
- **Dark mode: glowing flowers (author).** In dark mode the flowers glow softly, a subtle nod to Hyphi (the author's reference). The glow is a still, gentle luminous edge by default. A slow, subtle shimmer plays only when animation is on in settings, and it is off automatically when the device asks for reduced motion. The glow is not tied to how much the user did.
- **Growth rules.** Every kept thing adds growth (a slog-tagged item grows more); partial progress counts too. Quiet weeks simply do not grow, and nothing is ever shown as neglected. Undoing a log undoes its growth. Users can rename or remove anything.
- **Clearing in seasonal cycles (author's idea, confirmed).** Cycles follow the calendar and never activity: at the turn of each calendar season (matching the quarters) the garden gently rests. Most annual growth fades into soil, and a few plants are **pressed into a book** (the archive; the author chose this over seeds), so nothing the user did is ever lost. Perennials persist across seasons: goals (trees) and habits with longer periods. Clearing happens whether the user was busy or away, so it never signals neglect; a new season begins with a light garden. This keeps the garden from filling up (no clutter) without any guilt.
- **Where it lives (author: also in Goals).** Not a fifth Lens. A small garden strip sits at the top of the Habits lens AND the Goals lens; tapping the weekly tally ("14 things kept this week") opens the full garden view, and the pressed book is reachable from there. Version 1 uses a small hand-made set of about 15 illustrated pieces drawn as simple vector shapes, placed procedurally, with a glowing variant for dark mode and a resting state for the season turn; more themes come later.

Reinforcement rules summary: reward the hard-to-start behaviours (log a habit, press Start, finish a Commitment, finish a Planning session, capture a thought), never hours or volume; a reward moment is a short coach line from templates, a small progress update, a soft tone, and the weekly tally, with rare capped delights that are never tied to loss; points, XP, levels and the planning streak are retired; periods close quietly with no failure mark and runs appear only as praise and vanish silently; a "slog" tag (or an offered tag after repeated postponing) earns a bigger reward and a two-minute "just start" ritual; feedback is immediate (under a second), with opt-in recaps (end-of-day line on Home, weekly in the Planning session, monthly or quarterly for longer-period habits); reward types are toggles in settings; friends, circles and leaderboards are out of scope. Coach lines come from templates on the device, never the AI on the delivery path.

Model consequences (input to the architecture and success-signals tickets): a Commitment gets an optional "slog" flag; growth and the weekly tally are derived from the Occurrence log; each season turn writes a small record of the pressed plants (the book) so it survives; nothing here needs a new Node kind.

Left for later: the garden's art (the piece set, glow and resting states, how plants map to habit types and goals, the pressed-book layout) is a prototype candidate for the roadmap.
