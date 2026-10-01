---
title: Now card selection logic
type: grilling
status: closed
assignee: skyler
blocked-by: []
parent: map.md
---
## Question

How does the on-device deterministic core choose the single Now card and the coming-up strip (deadlines, dependencies and Requires links, opening windows, travel time, learned patterns, the optional energy check and workload guard, slog-tagged items, what "Not now" and "Park" do to ordering), how does it explain the choice in one line ("why this one") without the AI, and how does it start simple in Phase 1 and improve later? Needed by Phase 1.

## Resolution

Decided in grilling (all recommendations accepted except Q1, and Q4 extended by the author). The Now card is chosen by an on-device, deterministic core; the AI has no part in it and never has the last word on urgency.

- **Candidates (author: Q1 b): habits can be the Now card too.** The candidate set is open Commitments that are **ready** (every `requires` is done, not parked, "Not now" cooldown passed) plus Habits that are due. ASSUMPTION to confirm on real use: a Habit enters the ranking only when it is pinned to the current time of day (treated like a time-critical item) or is in the final stretch of its period (placed with "due today"); an unpinned open day-period habit competes only in the last tier ("the rest"); Background items never appear unless at risk; Ideas are not eligible until promoted.
- **Ranking: the first tier that has candidates wins.** (1) Time-critical: a fixed-time Commitment (or pinned Habit) whose start-by moment is within the next hour, travel included. (2) Unblockers: a Commitment that is a `requires` of a time-critical one (the cooler before loading the car), soonest first. (3) Due today, earliest deadline first (including a Habit in its final stretch). (4) The next step of an active Goal. (5) The rest, older captures before newer. Ties: with low energy shortest first; with good energy slog-tagged first.
- **"Not now" and "Park".** "Not now" shelves the item until the next one or two cards are finished or two hours pass, whichever is sooner; it is never buried or dropped, and after the fourth "Not now" on the same item the coach offers shrink, park or keep (persona rule). "Park" moves it to the Parking lot until the user brings it back. Nothing is dropped automatically.
- **Start-by moment (author: Q4 a, extended).** Start-by = fixed time minus duration minus travel. **Duration** comes from the user's own history (the median time from started to done for similar items), refined by the Place (history at the same Place counts more), falling back to 30 minutes, adjustable in the detail view. **Travel** comes from the Places' coordinates, and **when online the app uses a maps routing API for real travel time**; when offline it estimates from coordinates and the usual speed for the mode, corrected by a ratio learned from the user's past actual travel (event history). Estimates improve with use and are never asked for up front. Existing code already uses Nominatim (addresses) and the public OSRM demo server (routes and tables) in `lib/geo.ts`; the OSRM demo is rate-limited with no guarantee and not meant for production, so the travel-time service must go through a server route with caching and a swappable provider (see the fog item).
- **Energy and workload.** Low energy shrinks the strip to the next one or two items and favours short ones. The workload guard: when the minutes of today's open Commitments exceed the time left before the sleep window (minus fixed events and a 20% buffer), Home shows one calm line ("Today looks full. Want to park a few?") with a tap to choose; no red, no counts, never automatic.
- **"Why this one" without the AI.** One short template line per winning tier (under twelve words): "Leave by 6:40, so this comes first", "It unblocks loading the car", "It's due today", "The next step for projection mapping", "Up next". At Rich density it adds the chain ("needs: cooler out first"). The AI may polish it later but is never required.
- **When the ranking recomputes.** On opening the app and after each action, never while the user is looking at the screen; the strip and card stay put until the user acts. One exception: a time-critical item crossing its start-by moment appears as a nudge, not a silent swap.
- **How things become Commitments before the AI exists (Phase 1).** Two paths: a small on-device parser turns captured text containing a date or time ("call the dentist tomorrow 3pm", "send the invoice by Friday") into a Commitment automatically; everything else stays an Idea in the Parking lot with a one-tap "Do this today" that promotes it. No AI, no bucket questions; the AI improves on it in Phase 3.

Build slices that follow: the ranking function (pure, tested, using lib/domain), the on-device date and time parser, the travel-time and duration service (server route with caching and a provider swap, plus the offline estimate), and the Home wiring.
