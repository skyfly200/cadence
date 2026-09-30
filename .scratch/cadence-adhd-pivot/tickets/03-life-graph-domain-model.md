---
title: Life graph domain model
type: grilling
status: closed
assignee: skyler
blocked-by: []
parent: map.md
---
## Question

What are the Node types and relationships in the Life graph (events, objects, places, people, routines, micro-tasks, ideas), how are dependencies like 'projector -> car -> cooler out' represented, how does it learn patterns from behaviour without manual setup, and how does Background node surfacing work so it stays non-rigid?

Scope addition from the author: Cadence is one app for basic todo, planning, habits AND goals, not only tasks. The model must cover Goal and Habit as first-class Nodes alongside tasks, plans and events, including how a goal decomposes into habits and tasks (the transcript's "bird's-eye goal map") and how a habit relates to a recurring commitment or Background node.

## Round 1 decisions (grilling, in progress)

- **Node kinds (five):** Goal, Habit, Commitment (a todo or an event, with or without a time), Idea (a Capture not yet classified), Thing (person, place or object, with a subtype). "Task" and "event" merge into Commitment. Background is not a kind.
- **Links (v1):** typed links only: *requires* (A before B), *needs* (a Commitment needs a Thing), *part-of* (decomposition), *at* (a Place), *with* (a Person). No conditions or states on Things in v1 (fog). The existing `dirty`, `needsClean` and `isHygiene` flags are re-expressed as *requires* links.
- **How links are created (author: both routes):** Cadence proposes links from repeated behaviour and conversation, storing a confidence and evidence on each; low-confidence links never surface; one-tap correction. Proposal threshold: three occurrences, or immediately when the user states it in conversation. The user can also define links themselves.
- **Goal decomposition (author chose full nesting):** goal → sub-goal → milestone → task, not just two levels. The store supports arbitrary depth; the Goals lens must still show only the next concrete step and expand in place (ticket 01).
- **Habit, recurring Commitment, Background:** Habit is a recurring behaviour the user builds or keeps (gets reinforcement). Recurring Commitment is a fixed-time repeat obligation. Background is a visibility setting on any Habit or Commitment: it stays out of every lens unless at risk. Existing anchors (meals, water, sleep) become Background Habits.
- **Surfacing Background nodes:** only when at risk, judged from the user's learned pattern; at most one soft nudge per node per day; silent after two dismissals; a global daily cap; delivery form is the audio ticket's decision. The starter set is off until the user opts in to each one.
- **Time, place, travel:** time constraints are properties of a Commitment (fixed time, deadline, opening window). Places are Things with coordinates. Travel time is derived from Places, not stored as a Node.
- **Memory:** an append-only occurrence log (done, skipped, parked, moved) attached to each Node; patterns and suggestions are computed from it; it powers undo and the success signals. Skipped and moved are logged neutrally, never as failure. It is the most sensitive data held (feeds the trust ticket).
- **Matching phrases to Nodes:** match silently when confident; otherwise file as a new Idea and reconcile later in a Planning session. Capture is never interrupted with a question.

## Resolution

Round 1 decisions above stand. Round 2 (all recommendations accepted):

- **Projects become Goals:** a Project is a Goal with a finish line; existing projects migrate into Goals and their tasks become the Goal's Commitments. No separate Project kind.
- **Milestone is not a kind:** it is a Goal marked as a checkpoint (done when its parts are done). Nesting is Goal → Goal → ... → Commitment or Habit, with no hard depth limit; the UI shows one level at a time (ticket 01).
- **Link provenance and decay:** every Link records its origin: *stated* by the user, *proposed and accepted*, or *inferred*. Stated Links never decay and change only when the user says so or after Cadence asks once in a Planning session. Inferred Links lose confidence when the pattern breaks (about three misses) and are retired quietly. Users define Links mostly by saying them in conversation ("the projector goes with House of Fire") and can edit them on a Node's detail view; there is no graph-editor screen in v1.
- **External items are mirror Nodes:** an external event (e.g. a Google Calendar event) becomes a Commitment carrying a link to its source and an external ID; read-mostly, never duplicated or written back unless the user allows; everything works with no integration connected.

Model summary: five Node kinds (Goal, Habit, Commitment, Idea, Thing); five Link types (requires, needs, part-of, at, with) with origin, confidence and evidence; an append-only Occurrence log; Background is a visibility setting, not a kind; time constraints are properties of a Commitment; Places are Things with coordinates; travel time is derived, not stored.

Worked example (House of Fire): a Commitment ("House of Fire", Saturday 8pm) is *at* a Place Thing (the venue); it *needs* Thing Nodes (projector, laptop, cables, power strip); a Commitment ("load the car") *requires* a Commitment ("take the cooler out"); the loading step is proposed after three occurrences or immediately when the user says it.

Left for other tickets: where the data lives and the store (Architecture and storage), how Now card selection uses the graph (fog), what may be read and stored (Trust and transparency model).

Migration consequences for the existing Nuxt app (input to the Keep/cut audit): `Task` becomes Commitment (its `location`, coordinates, `deadline`, `windowStart` and `windowEnd` become Commitment properties; `dependsOn` becomes *requires* Links; `dirty`, `needsClean` and `isHygiene` become *requires* Links); `Project` becomes Goal; `Habit` stays Habit (completions become Occurrences); anchors (meals, water, sleep) become Background Habits; `BrainDumpEntry` becomes Idea; `Trip` and its segments need a decision.

## Amendment: Habit recurrence (author requirement, all recommendations accepted)

The author wants habits to recur at these frequencies: multiple times a day, once a day, multiple times a week, weekly, multiple times a month, monthly, quarterly, annually.

- **One uniform model: a period plus a target count.** The periods are day, week, month, quarter and year; the target count is one or more per period. The author's eight options are presets (day x2 or more, day x1, week x2 or more, week x1, month x2 or more, month x1, quarter x1, year x1). Quarterly and annual habits may also take a count of two or more. Each completion is one logged Occurrence with a time, so "stretch three times a day" logs three events; late logging is allowed; logging past the target undoes back to zero.
- **Flexible by default, optional pinning.** A habit can happen on any day in its period. It can optionally be pinned to certain weekdays or to times of day (for a multi-daily habit, for example morning and evening).
- **Calendar periods.** The calendar week, month, quarter and year; the week's first day comes from settings (default Monday). A new period starts fresh and the old one is closed quietly with no failure mark.
- **Longer-period habits stay off Home.** Only day-period habits (and anything pinned to today) count in Home's small "Habits · 1 of 3 today" line and in the daily habit summary. Weekly, monthly, quarterly and annual habits live on the Habits lens, grouped by period with their period progress ("1 of 3 this week", "0 of 1 this quarter"). A longer-period habit surfaces gently just once in the final stretch of its period if it is still open (the At-risk rule applied to habits), and is dropped without comment after the period closes.
- **Existing habits** (daily or weekly with a days list) are not migrated (start fresh); the days list becomes optional pinning.
- **Left for the habit-reinforcement ticket:** what a met week, month, quarter or year feels like, and how progress is celebrated across periods.

### Amendment 2: two more periods (author request)

Habit periods are now: day, week, month, quarter, **every 4 months**, **every 6 months**, and year. The new presets are every 4 months x1 and every 6 months x1 (a count of two or more is allowed on either). Both are calendar-based like the others: every 4 months means the thirds of the year (January to April, May to August, September to December) and every 6 months means the halves (January to June, July to December). Everything else in the recurrence amendment applies unchanged: flexible by default, optional pinning, quiet close of each period, and only day-period habits on Home.
