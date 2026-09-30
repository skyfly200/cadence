# Cadence

A personal assistant, life coach and career coach for ADHD/AuDHD people. It removes the cognitive load their brains pay manually (holding plans, tracking dropped balls, switching contexts) instead of adding a planner to manage.

## Language

**Capture**:
Getting a thought into Cadence with minimum friction (one prompt, typed or spoken, or pushed from an outside assistant). Never requires choosing where it goes.
_Avoid_: Add task, create task, input

**Brain dump**:
An unstructured Capture of many half-formed thoughts at once.
_Avoid_: Import, bulk add

**Parking lot**:
The place a Capture goes when it is not to be acted on now. One tap, acknowledged with "Got it, parked".
_Avoid_: Backlog, inbox, incubator

**Node**:
Anything Cadence knows about in the user's life. There are five kinds: Goal, Habit, Commitment, Idea and Thing.
_Avoid_: Task, item, entry

**Goal**:
An outcome the user wants, which may contain other Goals (sub-goals and milestones), Habits and Commitments. A Project is a Goal with a finish line; a milestone is a Goal marked as a checkpoint.
_Avoid_: Project, milestone (as separate kinds)

**Habit**:
A recurring behaviour the user is building or keeping, defined by a Period and a target count per Period (for example three times a week, or once a quarter); it receives reinforcement.
_Avoid_: Routine, recurring task

**Period**:
The calendar window a Habit is counted within: a day, week, month, quarter, four-month span, half-year or year. A new Period starts fresh and the previous one closes quietly, never as a failure.
_Avoid_: Cadence, frequency, streak window

**Commitment**:
Something to do or attend, with or without a time. A todo and an event are both Commitments; a fixed-time repeat obligation is a recurring Commitment.
_Avoid_: Task, event, appointment, errand

**Idea**:
A Capture not yet classified into another kind; it waits until reconciled in a Planning session.
_Avoid_: Note, brain-dump entry

**Thing**:
A person, place or object that Commitments need, happen at, or involve (a projector, the car, a venue, a friend).
_Avoid_: Resource, contact, location

**Link**:
A typed relationship between Nodes (requires, needs, part-of, at, with) that records its origin (stated, proposed and accepted, or inferred) and, if inferred, a confidence and evidence.
_Avoid_: Dependency, edge, relation

**Occurrence**:
One immutable record that something was done, skipped, parked or moved; the log of Occurrences is the memory patterns are computed from. Skipped and moved are never failures.
_Avoid_: History entry, check-in, completion

**Life graph**:
The web of Nodes and Links that Cadence builds and updates from the user's behaviour and conversation, not from manual setup.
_Avoid_: Knowledge graph, database, task list

**Background**:
A visibility setting on any Habit or Commitment (eat, shower, brush teeth, trash): it appears in no Lens and surfaces only when it is at risk of slipping.
_Avoid_: Background node, recurring task

**Nudge**:
A calm, well-timed prompt (usually spoken) that arrives like a thought rather than an alarm.
_Avoid_: Alert, notification, reminder, alarm

**Transition ritual**:
A brief cue (sound or phrase) that bridges the user from one block to the next.
_Avoid_: Timer end, alarm

**Body double**:
Cadence's steady, non-judging presence (voice or ambient) that helps the user stay in a task.
_Avoid_: Coach voice, timer

**Planning session**:
A conversational review where Cadence shows what it organized since last time and the user steers.
_Avoid_: Weekly review, triage

**Recede**:
Cadence's behaviour when the user goes quiet: it stops nudging, silently moves unfinished items to the Parking lot, and never guilts them; on return the normal Home shows under a warm greeting.
_Avoid_: Streak loss, overdue

**Now card**:
The primary thing on Home: the single next thing Cadence suggests, with a way to start it, put it off, or park it.
_Avoid_: Dashboard, today list, task card

**Lens**:
One of four views (Now, Today, Habits, Goals) reachable through a fixed, visible bottom bar; only one is shown at a time.
_Avoid_: Tab, page, panel

**Capture surface**:
The always-in-the-same-place control, in the middle of the bottom bar, where a Capture is typed or spoken.
_Avoid_: Quick add, input box

**Tone setting**:
The user's chosen way for the coach voice to speak: a gentle, plain or direct dial, a literal-only switch, and an opt-in playful switch.
_Avoid_: Personality, persona, mode

**Home**:
The default screen: the Now card, a light strip of what is coming next, and a small habits summary that opens the Habits lens. It is also where the user lands after being away, under a warm one-line greeting.
_Avoid_: Dashboard, landing page

**Density setting**:
The user's choice of how much detail screens show: Simple, Balanced (default) or Rich.
_Avoid_: Theme, view mode, compact mode

**Kept**:
A logged Occurrence that counts as honoured: a habit logged, a Commitment finished, a Start pressed. Progress, tallies and the Garden are built from what was kept, never from what was missed.
_Avoid_: Points, score, XP, streak

**Slog**:
A user tag on something draining or boring, which earns a bigger reward and a two-minute "just start" ritual.
_Avoid_: Hard task, difficulty level

**Garden**:
The small illustrated collection that grows as things are kept: habits become plants, kept periods become blooms, goals become trees. It never wilts, shrinks or shows neglect, and its flowers glow softly in dark mode.
_Avoid_: Score, level, badge collection

**Season**:
A calendar quarter. At the turn of each Season the Garden rests on the calendar alone, never because of activity: most growth fades into soil and a few plants are pressed into the Pressed book, while perennials (goals and longer-period Habits) persist.
_Avoid_: Reset, wipe, cycle

**Pressed book**:
The archive of plants pressed at each Season turn, so nothing the user did is lost.
_Avoid_: History, archive, trophy case

**Private**:
A flag on any Node that keeps it out of every AI call and out of anything an assistant can read, while it still works normally inside the app.
_Avoid_: Hidden, secret, sensitive
