# Cadence: product spec

Status: build-ready, with the open items listed in section 16. Every decision below was made by the author in the wayfinder map (`.scratch/cadence-adhd-pivot/`); the ticket named in brackets holds the detail and the reasoning. The vocabulary is in `CONTEXT.md` and is used exactly here.

## 1. What Cadence is

A personal assistant, life coach and career coach for ADHD and AuDHD people, in one calm app for basic todo, planning, habits and goals. It removes the cognitive load these brains pay by hand (holding plans in working memory, tracking dropped balls, switching contexts) instead of adding a planner to manage. Core loop: **capture, classify, connect, nudge**.

Users: the author first (dog-fooding), designed for the general ADHD/AuDHD pattern; nothing is built for other people until the author relies on it (section 15).

## 2. Principles

1. **Lowest-friction capture.** One prompt, typed or spoken; you are never asked which bucket [11].
2. **The system carries the complexity.** The user lives; the graph updates from behaviour and conversation [03].
3. **Never punish absence.** No failure marks, no streaks that die, no overdue lists; periods close quietly; unfinished items roll silently into the Heap [01, 17].
4. **Depth on demand.** Cadence handles the obvious automatically; deeper planning (timeline, Eisenhower matrix, manual estimates, Trips and Map) is always available and never required [07].
5. **Simple, not overly minimal.** Calm and uncluttered, but with visible progress, colour, warmth and enough on screen to see the day [01].
6. **Honest evidence.** Sensory controls are well supported; body doubling, spoken-nudge and gamification claims are hypotheses to test, not facts (research on the map).
7. **Cheap upfront.** Free Vercel and Supabase plans while personal; cheap model routing; per-user usage cap [10].

## 3. Domain model [03]

Five **Node** kinds: **Goal**, **Habit**, **Commitment** (a todo or an event, with or without a time), **Idea** (an unclassified Capture), **Thing** (person, place or object).

- **Links** (typed): `requires` (A before B), `needs` (a Commitment needs a Thing), `part-of` (decomposition), `at` (a Place), `with` (a Person). Each Link carries an origin (stated, proposed-and-accepted, inferred), and inferred ones a confidence and evidence.
- **Goals nest without a depth limit** (goal, sub-goal, milestone, task). A Project is a Goal with a finish line; a milestone is a Goal marked as a checkpoint. The UI shows one level at a time.
- **Background** is a visibility setting on any Habit or Commitment (eat, teeth, trash): it appears in no lens and surfaces only when at risk.
- **Occurrence log:** append-only records (done, skipped, parked, moved, started, captured, logged; undone points at the log it undoes). Skipped, parked and moved are never failures. It is the memory patterns are computed from and the most sensitive data held.
- **Time, place, travel:** time constraints are properties of a Commitment; Places are Things with coordinates; travel time is derived.
- **External items** (for example Google Calendar events) are mirror Commitments carrying a source link and external id, read-mostly.
- **Proposing Links:** after three occurrences, or immediately when the user states it. Stated Links never decay; inferred ones lose confidence when the pattern breaks (about three misses) and retire quietly. Users define Links mostly by saying them; no graph-editor screen.
- **Matching phrases to Nodes:** silent when confident, otherwise a new Idea reconciled in a Planning session.
- **Slog:** an optional flag on a Commitment (draining or boring) that earns a bigger reward and a two-minute start ritual. **Private:** a flag on any Node that keeps it out of every AI call and assistant read.
- Left out of v1: conditions on Things (for example "the car has room").

### Habit recurrence
A uniform model: a **Period** (day, week, month, quarter, every 4 months, every 6 months, year) plus a target count. The author's presets: multiple times a day, daily, multiple times a week, weekly, multiple times a month, monthly, quarterly, annually (plus every 4 and 6 months). Calendar periods (week start from settings, default Monday; four-month thirds Jan-Apr, May-Aug, Sep-Dec; six-month halves). Flexible by default; optional pinning to weekdays or times of day. Each completion is one logged occurrence; logging past the target undoes back to zero. Only day-period habits (and anything pinned to today) count on Home and in the daily summary; longer periods live on the Habits lens grouped by period, with one gentle mention in a period's final stretch if still open. Implemented and tested in branch `feature/domain-core`.

## 4. Interface [01, 08]

Phone first (Android), desktop as a wider layout. Reference prototype: variant D on branch `prototype/ui-concepts` (`npm run prototype`, `/?variant=D`).

- **Home:** the **Now card** (the one next thing: a rounded white card with a small illustration, a serif title, a one-line reason, and **Start**, **Not now**, **Park**), a day-river layout (the day flows down a rail, earlier items collapse into "Kept earlier"), a light strip of what is coming (about three items), a progress bar ("3 of 6 done today") and a small habits line ("Habits · 1 of 3 today") that opens the Habits lens.
- **Four Lenses** behind a visible labelled bottom bar: Now, Today, Habits, Goals; one shown at a time; fixed position; 5 to 7 items per lens with a quiet "more", never auto-reordering. The **capture button** is raised in the middle of the bar.
- **Capture sheet:** "What's on your mind?", a mic, **Add**, and **Discuss** (turns the same sheet into a short conversation in place).
- **Progress that celebrates is allowed** ("3 of 5 done", rings, weekly totals, goals with a point per milestone on the bar); counts of what is left, late or piling up are banned. No badges, no red-for-late, no confirm dialogs (every action undoable; the only soft confirmation is the 7-day delete).
- **Returning after a break:** the normal Home under a warm greeting ("Welcome back. Nothing is on fire."); Cadence never mentions how long the user was away.
- **Look:** a richer soft palette (cool sage and teal base with the warm Now card as focal point), light illustration, 16px body text and 44px touch targets. **Dark scheme** (dusk palette, glowing flowers in the Garden) is an option; light is the default and follows the system setting.
- **Density setting:** Simple, Balanced (default), Rich. **Motion** stays at the current level with a toggle (and honours the OS reduced-motion setting automatically); **sound** is on by default at gentle volume with one mute that also stops the mic.
- **Go deeper:** a planned entry in the Today lens opens optional views (a simplified timeline, an Eisenhower matrix, Trips and Map when enabled). Not designed yet.

## 5. Coach voice [02]

An unnamed voice with one consistent style (the user may name it). Default register: plain and warm, short, second person, one reason and one small ask, one or two sentences. Rare light storybook touches in warm moments. **Playful is opt-in**, never guilt-based.
- Speaks first only when something is about to slip, or when a Planning session is wanted; everything regular is opt-in.
- Names patterns neutrally and offers choices ("This has moved four times. Shrink it, park it, or keep it?"); never uses *behind, overdue, failed, lazy* or *should*.
- Learns goals one small question at a time; no long interview. Career coaching means career direction (goals, skills, next steps), shown in the Goals lens.
- **Limits:** not therapy; no diagnosis; no medication or medical advice; no manipulation; says when it does not know; honest that it is an app (no claimed feelings); on crisis language drops the coaching voice and points to real help (on-device rules only, a calm card with local help lines and no AI check; ticket 24).
- **Tone settings:** a dial (gentle, plain, direct), a literal-only switch, an opt-in playful switch.

## 6. Nudges and audio [09]

Default nudge kinds: **Leave-by / start-by** (time-critical Commitments with derived travel time), **At-risk Background**, **Transition**, and a **daily habit summary** (a list of open day-period habit names, no count). A **morning briefing** (opt-in, off by default) is postponed and not built.
- Caps: at most five a day for the first three; the habit summary is outside the cap, once a day; quiet hours follow the sleep window; one nudge per Node per day; "Not now" reschedules once and a second dismissal silences that Node. Nothing is logged as a failure.
- Every nudge has **Not now** and **Stop these** (per type or per Node, reversible in settings).
- Default sound: a short soft tone with text at low volume plus **spoken voice from the browser's built-in voices while the app is open**; a first-run disclosure; plays only after the first interaction; none in quiet hours. When the app is closed the OS notification tone plays. Cloud voices, music-as-timer and in-car nudges are later opt-in modules.
- **Wording:** templates filled from the graph, rendered on the device; the AI is never on the delivery path.
- **Transition ritual:** the same short cue every time (soft tone, light vibration on Android, the Now card changes to "Next: X" with one line of why); one heads-up five minutes before a block over 30 minutes ends, then one transition.
- **"Focus together"** (built as "Stay with me" in the research): an opt-in body-double mode on the Now card (15, 25 or 45 minutes; a plain spoken start, one "Halfway." check-in and a "Time is up." end; quiet otherwise); an experiment, not a claim. Ambient sound is dropped. It can open **music** on start: YouTube Music by default, Spotify and SoundCloud supported, an optional playlist link, set in Settings; a web app cannot play audio itself, so it opens the player's app or site.
- **Sound controls:** one mute silences everything including the mic; the tone and the speech each have their own on/off and volume (per device), with a Test button.
- **Late or missing pushes:** never escalate or resend; drop if no longer useful; one gentle notice if notifications are blocked. No email or SMS fallback.

## 7. Reinforcement [17]

- **Rewards** go to the hard-to-start moments: logging a habit, pressing Start, finishing a Commitment, finishing a Planning session, capturing a thought; never hours or volume. A reward is a template coach line, a small progress update, a soft tone and a weekly tally ("14 things kept this week"), with rare capped delights never tied to loss. Points, XP, levels and the planning streak are retired.
- **Lapses:** a period that ends unmet closes quietly as a lighter one. "Kept 6 weeks running" appears only as praise and vanishes silently if broken.
- **Slog tag** (or an offered tag after repeated postponing): a bigger reward and a two-minute "just start" ritual.
- Feedback under a second; opt-in recaps (end-of-day line on Home, weekly in the Planning session, monthly or quarterly for longer habits). Reward types are settings toggles; no adaptive learning in v1; no social features.
- **The Garden:** a small illustrated collection; habits become plants, kept periods blooms, goals trees. It grows with everything kept, never wilts or shows neglect, and undoing a log undoes its growth. Each calendar **Season** (quarter) it rests on the calendar alone, never because of activity: most growth fades into soil, a few plants are pressed into the **Pressed book** so nothing is lost, and perennials (goals, longer-period habits) persist. A strip shows on the Habits and Goals lenses; the full garden opens from the weekly tally. About 15 vector pieces placed procedurally, a glowing dark-mode variant (still by default, slow shimmer only if animation is on).

## 8. Architecture [10]

- **Stack:** Nuxt 3, Vue 3, Pinia, Tailwind, PWA, hosted on Vercel (new project connected to this repo), Supabase for accounts, passkeys and Postgres. Live at `cadence.skylerfly.com` (Netlify until re-pointed).
- **Truth:** Supabase is the source of truth once signed in; the browser keeps an offline-first cache; signed-out use works locally. The existing last-writer-wins sync is extended; the occurrence log merges by union.
- **Storage:** nodes as JSON rows in one table with a `kind` column; links and occurrences in their own tables; Postgres recursive queries (with `CYCLE`) for nesting and dependency chains; no graph database; no vector database in v1. Schema: `supabase/drafts/0001_graph_core.sql` (applied 2026-09-30 as migration `cadence_graph_core`).
- **AI layer:** a thin provider-agnostic interface on the Vercel AI SDK with two adapters (Anthropic default, OpenAI-compatible, which also reaches local models) replacing `z-ai-web-dev-sdk`; small fast models for wording, stronger ones for extraction and coaching; keys server-only; per-user usage cap. The graph is the memory: each call gets the relevant slice.
- **What the AI decides:** a deterministic on-device core picks the Now card and works offline; the AI handles language and extraction only and never has the last word on urgency.
- **Scheduling:** a `nudge_queue` table and a Supabase scheduler (every minute) calling one Nuxt route that sends Web Push (`web-push`, Android); jobs idempotent; the route must acknowledge within the scheduler's 2 second timeout.
- **Start fresh:** new tables, no migration; old tables left untouched.
- **Risks:** a free Supabase project pauses after seven days of low activity (monitor it); no point-in-time backup on the free plan (see export); Vercel Hobby is non-commercial.

## 9. Capture [11]

Own app only in v1 (typed input and tap-to-talk using the browser's speech recognition). Every channel posts to one authenticated, source-tagged, idempotent endpoint that acknowledges in under a second; the raw text lands as an **Idea**, extraction runs afterwards (unclear stays an Idea for a Planning session). Safeguards: captured text is data, never instructions; identical captures from one source within a few minutes count once; size and rate limits; no destructive tools.

**Later connectors (Claude first, then Gemini and Grok):** four tools: `capture`, `whats_next` (read-only), `log_kept` (habits) and `complete` (Commitments or milestone Goals); `read` and `write` scopes; per-assistant rotating tokens; a "Connected assistants" list in Settings with Revoke; a thin Nuxt authorization server reusing the passkey login; registered on the current domain with URLs from one config value. ChatGPT and Siri are out. In-car work is skipped for now.

## 10. Trust and transparency [12]

- One plain-language screen, **"What Cadence knows and does"**: what is connected, what is stored where (device, account, sent to the AI), what each feature sends, and the control for each.
- Each AI feature discloses what it sends; only the relevant slice goes; an **AI off** switch runs the app on the deterministic core (captures stay Ideas). Paid API tiers only, retention off where possible.
- **Export everything** (one tap; opt-in monthly reminder); **Delete everything** has a 7-day undo window.
- Row-level security on every table; **Google tokens server-side and encrypted** (built in branch `feature/google-tokens-server`, `0002_google_tokens.sql` (applied 2026-09-30), needs `CADENCE_TOKEN_KEY` and `SUPABASE_SERVICE_ROLE_KEY`); an activity list of sensitive actions.
- **Private** flag; activity-log retention with delete-by-range and "forget older than a year"; any suggestion shows its origin and evidence and can be forgotten; **no analytics** by default.

## 11. Success signals [13]

Computed on the device from the log and the settings history; a **Signals** screen in Settings (off by default).
- Main signals: still in use (weeks with a kept action, plus **coming back after a break**), things kept per week (a trend), and a one-tap weekly feeling check (lighter, same, heavier). Supporting: lapsed time-critical items and capture-triage speed; never shown as failures.
- An **Experiment** button compares kept-per-week and "Not now" rates before and after turning a feature off or on, only when asked. Nudge health is report-only in v1.
- **Checkpoints at weeks 2, 4, 6, 8 and 12**, all decision points: show the stats and ask what does and does not work, and why (short answer saved to Ideas). Rule of thumb: keep a mechanism used in at least half the weeks with no rise in "Stop these"; cut or rework it if switched off within two weeks.

## 12. What to keep, change and cut in the existing app [07]

Replace the Nuxt app slice by slice; tag `pre-pivot` (created locally at `ba0ed13`); delete an old screen only when its replacement ships.
- **Keep and extend:** Nuxt/PWA/Tailwind setup, Supabase auth and passkeys, the sync engine, local storage (with export and import), Google Calendar (with the token fix), time utilities, notifications, geo, the resilient timer engine, confetti (scaled down and motion-gated), the UI primitives, the settings panel (extended).
- **Keep as optional or on demand:** Trips and Map (module, off by default assumed), the simplified timeline (Rich density), the Eisenhower matrix (derived quadrants).
- **Transform:** Capacity into a one-tap energy check plus a gentle workload guard; timers behind Start and "Focus together"; the task form into a Commitment detail view; reminders into the nudge system.
- **Replace when the replacement ships:** the tab shell, Dashboard, Triage, Stats, Gamification, Habits, Brain Dump, the task, project and habit logic; the three z-ai routes and the importer stay until their replacements exist.
- **Cut:** points, XP and streak data; `netlify.toml` once Vercel is live.

## 13. Roadmap [22]

- **Phase 0 Groundwork: DONE (2026-09-30).** The two code branches are reviewed and merged to `main`; both SQL migrations are applied to the cadence Supabase project; the Vercel project builds and serves `cadence.skylerfly.com` with its environment variables set; `netlify.toml` is removed; the `pre-pivot` tag is pushed; Google Calendar connects end to end. Found and fixed on the way: the Google token endpoint the app had always used returned 404 (now `oauth2.googleapis.com/token`, pinned by a test).
- **Phase 1 Capture-first core: DONE (2026-10-01), start living in it here:** new tables and sync; the capture endpoint; Home with simple Now-card ordering; bottom bar and capture sheet (Add); the Plan lens (a week Stack and the Heap, with a sort flow); Habits with periods; dark toggle, density, basic settings; the weekly tally. A "Classic view" switch keeps the old app until after Phase 3.
- **Desktop layout: DONE:** at wide widths the Home gets a left rail (lenses, a persistent capture box, menu) and Plan becomes a multi-column week board.
- **Phase 2 Nudges and voice: DONE (2026-10-01):** the nudge planner (four kinds, caps, quiet hours, "Not now" and "Stop these", templates; pure and on the device); in-app delivery (notification, soft tone, optional speech, mute, volume); Web Push (`nudge_queue` and `push_subscriptions`, a cron job every minute calling `/api/nudges/dispatch`, a service-worker handler with "Not now" and "Stop these" buttons, a Settings switch to subscribe); tap-to-talk from the bottom bar (typed add lives on the Plan page); "Focus together" with music; "Stop for now" on a started item. Verified on a real phone by the author. Not built: the morning briefing (postponed) and ambient sound (dropped).
- **Also built with Phase 2:** edit and delete entries (title, time, location, duration, dependency; habits: frequency, weekdays, link); links and **open-app buttons** (a known app named in a title, or an https link you attach, opens the installed app on Android or the website; GitHub, Netlify, Google Docs, Notion, Trello and more); a 12 or 24 hour clock setting; a header menu with room for more pages.
- **Phase 3 Understanding: DONE (2026-10-01):** the AI layer (Vercel AI SDK, Anthropic default, OpenAI-compatible adapter, per-user cap), Goals with milestone bars, "Why now", Discuss, the Planning session, crisis handling (on-device rules), AI-off, Private, the transparency page, export and 7-day delete. Extraction runs on Sonnet 5.5 and is provisional until the extraction spike (21) has real captures. The "Classic view" switch can be removed once nothing relies on it.
- **Phase 4 Reinforcement and signals: DONE (2026-10-02), not yet tried in a browser:** the Garden and Pressed book (five plants pressed per season), reward lines, the slog tag, recaps, the Signals screen, the weekly feeling check, Experiment and checkpoints at weeks 2, 4, 6, 8 and 12.
- **Phase 5 Reach:** connectors, Go deeper, Trips and Map module, onboarding for others, later audio modules.
- **Go deeper (defaults chosen, to confirm on real screens):** a `/deeper` page, linked from the menu and the desktop rail. The **Eisenhower matrix** derives quadrants, never asks: urgent = a deadline or fixed time within 48 hours (or past); important = part of a Goal through part-of links, or slog-tagged; done and parked items are left out (`lib/domain/eisenhower.ts`). **Trips and Map** is a module, **off by default**, switched on in Settings under Go deeper; it reuses the existing trip planner and map. The simplified timeline is not built.
- **Onboarding (default chosen):** a three-step welcome sheet (capture, one card at a time, what the AI sees) shown once per device, only when the graph is empty; Skip is always there and it can be replayed from the menu. No accounts flow or data seeding. Full multi-user onboarding stays with the out-of-scope multi-user effort (§15).
- **Later audio modules:** **In the car** is built as an opt-in Settings switch (off by default): nudges are spoken aloud at full volume even if speech is off; mute and quiet hours still apply. **Cloud voices** and **music-as-timer** are not built: they need a paid voice service and a player a web app cannot control, so they stay later opt-in efforts (§6).
- **Phase 5 decisions (2026-10-02):**
  - **Connectors:** Claude first, through a remote MCP server (Streamable HTTP) with a thin OAuth server inside Nuxt (Dynamic Client Registration, PKCE S256, the claude.ai callback, passkey login on the consent screen, `read` and `write` scopes, access tokens 1 hour, rotating refresh tokens 30 days) and a "Connected assistants" list with Revoke in Settings; tools per ticket 11.
  - **Ingest:** Google Tasks and Docs only, as user-triggered, read-only imports (Tasks become Ideas with an external id so re-import skips duplicates; a Doc, picked with the Google Picker under the `drive.file` scope, runs through extraction as tap-to-keep proposals). Keep is paste-only through Capture and Discuss (its API is Workspace-only). Needs the Google Cloud project published to Production (unverified) and a Picker API key.
  - **Extraction:** also detects habit cycles ("twice a week", "monthly") into a Habit's recurrence, and place names, which the server resolves with the place search into an address and coordinates (the AI never supplies coordinates); Things get an optional address.
  - **Garden:** pressed pages sync through `cadence_kv`; the Planning recap card opens the Garden; season names follow the hemisphere (time zone, with a Settings override).
  - **Signals:** the slog signal counts a slog-tagged Commitment finished that week; Garden usage is not tracked.

## 14. How it is built

One branch per slice, built by a background agent, tests run by the assistant, a pull request reviewed by the author before merging to `main`, a Vercel preview per pull request; independent slices in parallel. Nothing merges without review and nothing is pushed without the author saying so.

## 15. Out of scope for this spec

Deep ingestion of Gmail, texts, Drive and Maps timeline; Notion, Trello and Keep sync; multi-user hosting and public release (later efforts; the capture path and model leave seams); ChatGPT and Siri integrations; friends, circles and leaderboards.

## 16. Open items

- **Design tickets open:** the extraction spike [21] (needs 20 to 30 of the author's real captures; decides which model does extraction).
- **Design questions left for their phase:** the Garden's art and the Pressed book layout; the look of the optional views; body-double presence beyond audio; the Google Calendar approach (including mirroring leave-by nudges); conditions on Things; later audio modules; the assistant-connectors rollout.
- **Assumptions to confirm on real screens:** the warm Now card accent on the cool base; Balanced as the default density; whether Calendar sync should work signed-out (currently requires sign-in).
- **Unverified in the research:** voice mode with a custom connector for Claude, Gemini and Grok; Grok in the car; whether free Supabase pg_cron activity prevents pausing; several Web Push and Android details (all flagged in `.scratch/cadence-adhd-pivot/research/`).

## 17. Code and reference branches

- `feature/domain-core`: types, period math, habit progress, runs, tally (41 tests), SQL `0001` (applied).
- `feature/google-tokens-server`: server-side encrypted Google tokens (93 tests total), SQL `0002` (applied).
- `prototype/ui-concepts`: the UI prototype (variant D is the agreed direction); throwaway, never merged.
- `adhd-pivot-map-nuxt`: the map, tickets, glossary, research and this spec.
