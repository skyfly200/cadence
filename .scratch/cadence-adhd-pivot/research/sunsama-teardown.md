# Sunsama teardown

Ticket: `.scratch/cadence-adhd-pivot/tickets/15-research-sunsama-teardown.md`
Researched: 2026-09-29. All pages fetched that day; product facts reflect Sunsama as of then.
Method note: page content was retrieved through a summarising fetch tool, so quotes are as returned by that tool and should be re-checked on the live page before being used in any external copy.

## Answer in brief

Sunsama is a paid, desktop-first, calm-toned daily planner for knowledge workers. Its core is a guided morning ritual (pull tasks in, size them, get warned if overloaded, timebox) and an evening shutdown ritual. Undone tasks roll over automatically at midnight, then auto-archive after several consecutive rollovers. It is well loved by many ADHD/AuDHD users for the overload guard and ritual scaffolding, and criticised mainly for price, weak mobile, and a ritual that assumes daily attendance. For Cadence: borrow the workload guard, silent rollover and auto-archive, and the "just today" framing; reject the daily ritual as a required entry point, manual estimate entry, and the subscription-plus-professional positioning.

## How Sunsama works (primary sources)

### Daily planning ritual
Help centre ([Daily Planning](https://help.sunsama.com/docs/usage-guides/daily-planning)) lists five stages:
1. Reflect on yesterday (shown if the shutdown was skipped).
2. Add tasks (calendar events as tasks, plus integrated tools).
3. Check predicted workload against the user's threshold; warnings if overcommitted.
4. Finalise: order tasks, optionally timebox.
5. Share the plan (Slack/Teams, optional).

The marketing page names the same flow "Process, Plan, Prioritize, Prepare, Publish" ([features/daily-planning-and-shutdown](https://www.sunsama.com/features/daily-planning-and-shutdown)). Docs say "New users should aim significantly lower than their total available work hours", and that workload accuracy needs meetings imported as tasks and "planned times on most of your tasks" (the guard only works if the user keeps feeding estimates). After 3 pm the ritual switches to planning tomorrow.

### Task import
20+ integrations (homepage: Google Calendar, Outlook, Asana, Slack, Gmail, Todoist, Notion, GitHub, Linear, Zapier, etc.). Import is user-driven: from a side panel, drag a card to the task list or calendar, or "Add to today" ([Todoist integration doc](https://help.sunsama.com/docs/integrations/todoist)). Sync is two-way for due/start date and completion (not recurring tasks); four automation toggles are on by default. Changelog (roadmap.sunsama.com/changelog): completion sync to Google Tasks/Microsoft To Do/Planner (Aug 2026); priority carried over from Linear/Todoist/Jira/Asana (May 2026); Task Priority in beta (Apr 2026). These were read from search snippets, not each entry opened.

### Timeboxing
Drag a task onto the calendar, or press `X` to auto-schedule ([auto-scheduling doc](https://help.sunsama.com/docs/usage-guides/timeboxing/timeboxing-auto-scheduling)): never overlaps existing events, splits tasks over 1 hour, respects working hours set in Settings > Schedules. When the calendar is full it offers: schedule anyway, move to another day, or defer to tomorrow. Note: one aggregator (checkthat.ai, May 2026) says Sunsama "deliberately avoids auto-scheduling"; that conflicts with the first-party doc, so treat the aggregator as stale or wrong on this point.

### Focus mode
Minimal single-task view (`F`), subtasks/notes/timer available, calendar peek on hover so meetings are not missed, Pomodoro tab, optional auto-enter when starting a timer ([Focus Mode doc](https://help.sunsama.com/docs/usage-guides/focus-mode)). Homepage copy claims app muting and break reminders; the focus doc retrieved does not describe muting, so that claim is only verified at marketing-page level.

### Guided shutdown
At the user-chosen end time an in-app notification prompts shutdown ([Daily Highlights doc](https://help.sunsama.com/docs/usage-guides/daily-highlights/)): review the day's tasks with a time breakdown, auto-generate "highlights" (ranked algorithmically), optional written reflection (went well, concerns, obstacles), optional publish to Slack/Teams. Homepage frames it as "end work on time, without guilt".

### Weekly review
Weekly objectives are set in weekly planning; the review has three steps: objective review, work reflection (completed tasks with time by day), and journaling of "big wins, time distractions, and lessons learned". Can be merged into one planning+review flow ([Weekly Review doc](https://help.sunsama.com/docs/usage-guides/weekly-objectives/weekly-review)).

### AI and MCP
"Sunny", a built-in chat assistant with "full access to your tasks, calendar, backlog, objectives, and settings" ([Sunny doc](https://help.sunsama.com/docs/usage-guides/sunny/)); Beta badges removed Aug 2026 ([changelog, Aug 28 2026](https://roadmap.sunsama.com/changelog/weekly-product-changelog-august-28-2026), via search snippet only). First-party MCP server with OAuth (help centre, integrations/mcp). Relevant to Cadence's capture-channels/MCP contract ticket (11).

### Tone and copy
Homepage: "Start Calm. Stay Focused. End Confident."; "Start each day right. End each day fulfilled."; irreverent line "Work is f***ing chaotic" ([sunsama.com](https://www.sunsama.com)). ADHD page: "Planners and todo-lists are overwhelming. Our guided daily planning workflow helps you avoid overplanning..." and "Go home satisfied" ([for-adhd](https://www.sunsama.com/for-adhd)). The voice is warm, professional, aspirational; the nudge is toward finishing work, not toward life beyond work.

### Pricing and audience
[Pricing page](https://www.sunsama.com/pricing): single Pro plan, $17/mo billed yearly or $22/mo monthly; 14-day free trial, no card; no free tier; Enterprise custom (SSO/SAML/SCIM). Self-described as "professional grade" for "serious workplaces", SOC2, "busy professionals". Third-party reviews cite roughly $20/mo. iOS app: free download, subscription required, "companion to the desktop app", iOS 16.4+, 4.5 stars from 506 ratings (US App Store page, 2026-09-29; a search snippet showed 4.4 from 39 ratings, likely a different storefront). Google Play listing could not be retrieved; unverified.

## Overwhelm and rollover
- Rollover is automatic: "All tasks automatically roll over to the next day's task list if they are left incomplete at midnight" ([rollover doc](https://help.sunsama.com/docs/getting-started/basics/task-rollover-and-recurring-tasks-the-basics)).
- Auto-archive: tasks that roll over "multiple consecutive days" are moved out of the day view to an archive (crescent-moon panel, `Shift A`), with a pink badge; threshold configurable; entry is automatic only. This is the main anti-clutter mechanism.
- Overwhelm is handled by scoping to today only, the workload threshold warning, the "aim lower" guidance, and the shutdown closing the loop.
- Unverified: the default archive threshold, and whether the archive nags the user to triage it.

## What users say (dated, with bias flags)

Praise
- Lex Roman, Sep 18 2025 (updated Dec 6 2025), "Brought to you by Sunsama", affiliate: planning "so much less overwhelming because it's just showing you today's work"; the "unrealistic workload" warning; says it "changed the way I work more than any of the 10+ psych professionals". [Link](https://www.revenuerulebreaker.com/this-daily-planner-is-beloved-by-entrepreneurs-with-adhd/). Sponsored, low independence.
- Chris de Feijter (psychotherapist), Jul 28 2026, SaskADHD: praises workload protection and shame reduction; quote: "Sunsama handles inconsistency gracefully. Incomplete tasks roll forward, and you can pick up the planning ritual whenever you return. There's no shame mechanism for missed days". Criticises $20/mo, desktop-centric mobile, no Apple Calendar, "works best when you complete the daily planning ritual consistently". Affiliate links, no explicit disclosure found. [Link](https://saskadhd.com/sunsama-review-a-therapists-take-on-the-daily-planner-that-actually-works-with-your-brain/)
- Maria Redillas, May 13 2025: "a daily ritual of planning rather than an endless task list"; capacity feedback; says Sunsama is not enough alone for severe time blindness. [Link](https://mariaisquixotic.com/manage-time-blindness-with-sunsama/)
- App Store review (undated, retrieved 2026-09-29): a user with ADHD calls time blocking "extraordinarily helpful", "a lifesaver" for executive-function difficulty. [Link](https://apps.apple.com/us/app/sunsama/id1475755747)
- Aggregate (checkthat.ai, research date May 2026): Product Hunt 4.7 (21 reviews), Capterra 4.7 (27); praised for ritual, integrations, calm design. Secondary aggregator. [Link](https://checkthat.ai/brands/sunsama/reviews)

Criticism
- Rivva blog (Nia), 2026, a competing ADHD app, so biased: the ritual "can become its own obstacle... another thing to fail at"; "Miss a day and the backlog grows"; the model "works brilliantly for people with consistent executive function and badly for people whose executive function fluctuates by the hour." Read only through search-result summaries (the page redirected), so unverified against the page. [Link](https://blog.rivva.app/p/best-sunsama-alternatives-for-adhders)
- Jovana Simic, The Business Dive, Apr 27 2026 (updated May 28): 3.9/5; "Twenty dollars a month for a daily planning tool is not something you sign up for lightly."; weak smart features vs Reclaim; not a standalone calendar. Affiliate disclosed, no ADHD discussion. [Link](https://thebusinessdive.com/sunsama-review)
- App Store: one review calls mobile "surprisingly underfeatured for how costly Sunsama is ($20/month)"; search snippets mention bugs (freezing, deleted appointments) and a request for AI list generation to help planning paralysis. Android slowness reported by the aggregator.
- Reddit: not retrievable with my tools (reddit.com blocked). No Reddit quotes are cited; forum sentiment is unverified. Do a manual pass on r/Sunsama and r/ADHD before treating the criticism list as complete.

Cross-check: the two positions on missed days conflict (SaskADHD: no shame mechanism; Rivva: backlog grows and the ritual becomes another failure). Both can be true: the tool does not scold, but the ritual still asks for daily attendance and the archive still fills. No first-party data on ADHD retention exists.

## Transferable to Cadence

| Sunsama pattern | Why it fits | How to adapt |
|---|---|---|
| Show only today, not the whole list | Cuts overwhelm | Default surface, but Cadence assembles the day; no user ritual |
| Workload guard ("unrealistic workload") | Real ADHD win; time optimism | Infer load from life-graph nodes and calendar, no estimate entry; voice as a gentle nudge, not a red warning |
| Silent auto-rollover, no shame | Never punish absence | Never present rollover as yesterday's failures; drop "reflect on yesterday" |
| Auto-archive after N days | Anti-clutter; matches parking lot | Move stale nodes to the parking lot quietly; resurface only when a dependency puts them at risk |
| Import by drag from tool panels | Cheap sync | Ingest passively (MCP/capture channels), no daily import step |
| Focus mode (one task, calendar peek) | Fits body-double / single-task view | Pair with transition-ritual sounds |
| Shutdown as positive closure, auto highlights | Auto-highlights avoid effort; "without guilt" is on-brand | Opt-in, machine-written, skippable with no consequence |
| MCP server and chat assistant (Sunny) | Outside-assistant capture is table stakes | Comparison point for ticket 11 |

## Conflicts with Cadence principles
1. The ritual is the product. Value depends on a daily planning session and shutdown; reviewers concede it "works best" when done consistently. Cadence must work when the user does nothing.
2. Estimate-and-timebox is manual friction. Accurate warnings need planned times on most tasks and meetings imported as tasks; that is capture friction, the opposite of one-prompt capture.
3. Work-centric framing: copy is about professionals and "go home"; Cadence also covers eating, showering, life admin, and coaching.
4. Weekly objectives, journaling and daily written reflection are effortful; keep them optional, spoken, or inferred.
5. It does not recede. Planning and shutdown prompts imply it keeps asking; Cadence should fall quiet to a notepad when the user goes quiet.
6. Price and platform: $17-22/mo, no free tier, desktop-first; reviewers flag cost.
7. Flat task list with no dependency model; Sunsama tracks tasks and objectives, not a life graph (an aggregator quotes a user wanting project tracking).

## Unverified / gaps
- Reddit and forum threads (blocked); Google Play listing; Capterra/Product Hunt raw reviews (aggregator only).
- Focus-mode muting and break reminders (marketing claim only).
- Archive default threshold and triage nudges.
- Changelog entries reached via search snippets.
- Rivva quotes are secondhand.
