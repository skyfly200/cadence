---
title: Research: Sunsama teardown
type: research
status: closed
assignee: research-subagent
blocked-by: []
parent: map.md
---
## Question

How does Sunsama work (daily planning ritual, task import from other tools, timeboxing, focus mode, weekly review, guided shutdown, tone, pricing and audience) and how does it handle overwhelm and rollover of undone tasks? What do users, including ADHD users, praise and criticise? What is transferable to Cadence and what conflicts with the low-friction, never-punish, recede-when-quiet principles?

## Resolution

Findings: branch `research/sunsama-teardown`, file `research/sunsama-teardown.md`.

- **What it is:** paid ($17-22/mo, no free tier), desktop-first daily planner for "busy professionals", built on a 5-step morning ritual (reflect, add tasks, check workload vs threshold, timebox, optional share) and an evening guided shutdown. Imports from 20+ tools, auto-timeboxes around calendar events, single-task focus mode with Pomodoro, weekly review, AI assistant "Sunny", first-party MCP server. Tone: calm, professional.
- **Overwhelm and rollover:** undone tasks roll over silently at midnight, then auto-archive after several consecutive rollovers (configurable). Shows only today; warns when the plan exceeds a workload threshold and nudges planning under available hours.
- **Users:** ADHD users and clinicians praise the workload guard, reduced shame and guided structure; criticise price, weak mobile and a ritual that assumes daily attendance ("another thing to fail at" when you miss a day; unverified, secondary source).
- **Adopt (inferred from the Life graph, not typed):** today-only default, workload guard, silent rollover with auto-archive into the Parking lot, opt-in machine-written shutdown highlights.
- **Avoid:** the ritual as entry point, manual estimates, work-only framing, subscription barrier, weekly journaling, no recede-when-quiet mode, flat task list with no dependency model.

Unverified: Reddit/forum sentiment (blocked), Google Play listing, focus-mode muting and break reminders, default archive threshold, changelog details. Pages were summarised by the fetch tool; re-check quotes before external use. Some reviews are affiliate/sponsored (flagged in the file).
