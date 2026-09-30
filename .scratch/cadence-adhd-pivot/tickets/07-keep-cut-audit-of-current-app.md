---
title: Keep/cut audit of the current app
type: grilling
status: closed
assignee: skyler
blocked-by: [01-sensory-and-interaction-principles]
parent: map.md
---
## Question

Judged against the new principles, which existing features (Eisenhower matrix, points, pomodoro timer, capacity/wearable, timeline, voice input, notes importer, Google Calendar sync) and data survive, transform, or die, and does any existing data need migrating?

Note: the author is moving to Nuxt/Vue/Pinia on Vercel, so the current Next.js/React/Zustand code cannot be carried over as code. Judge what survives as concepts, data and integrations (e.g. Google Calendar sync logic, existing tasks in the live app), and whether the Netlify config and current deployment need any migration step.

CORRECTION (supersedes the note above): the live app is NOT the Next.js code in the local main checkout. `origin/main` is a Nuxt 3 / Vue 3 / Pinia / Tailwind v4 app with 35 commits the local `main` lacks (the Next.js line is the older rewrite; `netlify.toml` on origin/main says "This repo used to be a Next.js app"). It already has: Supabase accounts and normalized cross-device sync, passkey sign-in, task dependencies (dependency picker), XP/points and planning streak, Google Calendar OAuth, AI estimate/parse and voice-transcribe routes (via z-ai-web-dev-sdk), reminders/notifications, location-aware tasks and trip maps, install prompt. This audit is therefore judged against real, evolving Nuxt code: which of these features and files survive, transform or die, and what to do with the stale Next.js line (archive it). Inputs: read origin/main's README, stores/app.ts, lib/sync.ts, server/api/*, components/orchestrator/*, worklog.md.

Input (from the closed Sensory and interaction principles ticket): judge every screen and feature against a Now card home, four lenses (Now, Today, Habits, Goals) with 3-5 items each, one fixed capture control, no badges or counts, no confirm dialogs (undo instead), 16px body text and 44px targets. The nine-tab layout in `pages/index.vue` does not survive.

Input (from the closed Life graph domain model ticket): map existing data to the new model: Task to Commitment (dependsOn and the dirty/needsClean/isHygiene flags to *requires* Links), Project to Goal, Habit stays Habit (completions to Occurrences), anchors to Background Habits, BrainDumpEntry to Idea. Decide what to do with Trips and their segments.

Update (from the closed Architecture and storage ticket): the author chose to start fresh with NO data migration into the new tables; old tables stay in place untouched. The Life graph mapping is reference only, so the audit judges features, screens and code (sync engine, Google Calendar OAuth, Supabase auth and passkeys, PWA setup are kept and extended; `z-ai-web-dev-sdk` routes are replaced by the provider-agnostic layer), not data.

Input (from the closed Trust and transparency model ticket): the Google Calendar OAuth flow must change so tokens live server-side and encrypted, not in localStorage or the URL fragment; `exportAllData` and `importAllData` are a starting point for "Export everything"; sync tables need row-level security confirmed; there is no analytics to remove. Also needed: a "What Cadence knows and does" screen, an "AI off" switch, a Private flag on Nodes, and a 7-day delete-everything window.

Input (from the closed Success signals ticket): the audit should note that a Signals screen (off by default, on-device), a weekly one-tap feeling check, an Experiment button, checkpoint cards at weeks 3, 6, 9 and 12, per-nudge-type counters (shown, acted on, "Not now", "Stop these") and a settings-change history are new work; nothing in the current code provides them.

Update (from the amended Success signals ticket): checkpoint cards appear at weeks 2, 4, 6, 8 and 12 (not 3, 6, 9, 12). Each shows the stats and asks what does and doesn't work, and why, with the free-text answer saved into Ideas.

## Resolution

Audited against the Nuxt app on origin/main (about 8,000 lines of app code: components/orchestrator 3,892, stores/app.ts 1,377, lib/local-storage.ts 723, plus types, sync, geo and server routes). The author's answers to the judgement calls, and the standing principle behind them:

**Principle (author): depth on demand.** Cadence handles the obvious automatically so the user does not have to, but the user can always go deeper into planning by choice (timeline, matrix, manual estimates, trips). Deeper tools are available on demand and never required.

### Decisions

- **Trips and Map (author: Q1 b): keep as an optional module inside the new app** (TripsView, MapView, TripPlaceField, the offline map tiles). ASSUMPTION: the module is off by default and switched on in Settings. Over time its places become Things and its trips become Commitments with derived travel time.
- **Timeline (author: Q2 b): keep a simplified timeline** as a fallback for planning a day by hand, inside the Today lens at Rich density, reachable on demand. ASSUMPTION: a "Go deeper" entry in the Today lens opens the deeper planning views (timeline, matrix, and the Trips and Map module when enabled); this entry point is not designed yet (see fog).
- **Capacity (author: Q3 a): transform** the engine into an optional one-tap energy check ("Low / OK / Good") that feeds the on-device Now-card ordering and a gentle workload guard; the wearable and readiness numbers go.
- **Timers (author: Q4 a): keep the resilient timer engine** (computed from the wall clock, survives reloads) behind **Start** and "Stay with me"; drop the separate timer panel.
- **Eisenhower matrix (author: Q5 b): keep as an optional view** over Commitments, reached on demand. The Triage ritual and the Backlog and Incubator tabs are still replaced (Parking lot, silent rollover, Planning session). Open detail for the build: a Commitment no longer carries an Eisenhower field, so the matrix derives urgency from the deadline and importance from linked Goals or a user flag, and stays editable.
- **AI routes and importer (author: Q6): keep for now, until their replacements exist.** `estimate.post.ts`, `parse-todos.post.ts`, `voice/transcribe.post.ts` (z-ai-web-dev-sdk) and `NotesImporter.vue` stay until the provider-agnostic layer and the browser speech recognition replace them; each is removed when its replacement ships.
- **How old code goes (author: Q7 a): replace slice by slice.** Tag `pre-pivot` at the current origin/main for history (created locally; not pushed), build each new screen in place, and delete an old screen only when its replacement ships, so the live site keeps working throughout.

### Keep and extend
`nuxt.config.ts` (update the PWA name, description and theme), `app.vue`, `plugins/pwa-install.client.ts`, `composables/useInstallPrompt.ts`, `useToast.ts`, `useCurrentLocation.ts`, `lib/supabase.ts`, `lib/sync.ts` (extend to the new collections), `lib/local-storage.ts` (extend; keep export and import; the Google token parts are already removed on branch feature/google-tokens-server), `lib/time-utils.ts`, `lib/notifications.ts`, `lib/utils.ts`, `lib/geo.ts`, `lib/confetti.ts` (scaled down and gated on the motion setting), `components/ui/*`, `AuthDialog.vue`, `GoogleCalendarSettings.vue` and `server/api/google-calendar/*` (with the token fix), `SettingsPanel.vue` (transform: add the sensory, tone, AI-off, Private, export and delete, Signals and module sections).

### Keep as optional or on-demand
`TripsView.vue`, `MapView.vue`, `TripPlaceField.vue` (module); `TimelineView.vue` (simplified, Rich density, on demand); `QuadrantCard.vue` and the matrix part of `BacklogIncubator.vue` (optional view).

### Transform
`CapacityPanel.vue` (one-tap energy and workload guard), `TimerPanel.vue` (engine stays, panel goes), `TaskFormDialog.vue` (a Commitment detail view), `useReminders.ts` (becomes the nudge system when it ships).

### Replace when the replacement ships
`pages/index.vue` (the nine-tab shell becomes Home and the four lenses), `Dashboard.vue`, `TriagePanel.vue`, `StatsView.vue`, `GamificationPanel.vue`, `HabitsPanel.vue` (the Habits lens with periods), `BrainDump.vue` (Ideas and the Parking lot), the list parts of `BacklogIncubator.vue`, `VoiceInput.vue` (the capture sheet with Add and Discuss), `lib/types.ts` and the task, project and habit logic in `stores/app.ts` (replaced by the domain core in branch feature/domain-core; keep the store's auth, sync, calendar, undo and timer logic), and the three AI routes once their replacements exist.

### Cut
The points, XP, levels and planning-streak data and logic (replaced by Kept, the weekly tally and the Garden), the Eisenhower matrix as a primary surface, and `netlify.toml` and the Netlify `siteUrl` default once Vercel is live. No data is migrated (start fresh).

### New work the decisions created (nothing in the current code)
Home with the Now card, the day river, the visible bottom bar and the capture sheet (Add and Discuss); the four Lenses (Now, Today, Habits, Goals); habits by period; goals with milestone bars; the Garden and the Pressed book; the dark scheme toggle and the density setting; tone settings; the nudge system (`nudge_queue`, Supabase scheduler, Web Push, on-device templates, caps, quiet hours); the transparency screen, the AI-off switch, the Private flag, export and the 7-day delete; the Signals screen, the weekly feeling check, the Experiment button and checkpoint cards at weeks 2, 4, 6, 8 and 12; the capture endpoint; the provider-agnostic AI layer and extraction; the Planning session; connected assistants (later).

### Left for later
The design of the "Go deeper" entry and the look of the deeper planning views (a prototype candidate); how the Eisenhower view derives quadrants; whether the Trips and Map module is on by default.
