---
title: Keep/cut audit of the current app
type: grilling
status: open
assignee:
blocked-by: [01-sensory-and-interaction-principles]
parent: map.md
---
## Question

Judged against the new principles, which existing features (Eisenhower matrix, points, pomodoro timer, capacity/wearable, timeline, voice input, notes importer, Google Calendar sync) and data survive, transform, or die, and does any existing data need migrating?

Note: the author is moving to Nuxt/Vue/Pinia on Vercel, so the current Next.js/React/Zustand code cannot be carried over as code. Judge what survives as concepts, data and integrations (e.g. Google Calendar sync logic, existing tasks in the live app), and whether the Netlify config and current deployment need any migration step.

CORRECTION (supersedes the note above): the live app is NOT the Next.js code in the local main checkout. `origin/main` is a Nuxt 3 / Vue 3 / Pinia / Tailwind v4 app with 35 commits the local `main` lacks (the Next.js line is the older rewrite; `netlify.toml` on origin/main says "This repo used to be a Next.js app"). It already has: Supabase accounts and normalized cross-device sync, passkey sign-in, task dependencies (dependency picker), XP/points and planning streak, Google Calendar OAuth, AI estimate/parse and voice-transcribe routes (via z-ai-web-dev-sdk), reminders/notifications, location-aware tasks and trip maps, install prompt. This audit is therefore judged against real, evolving Nuxt code: which of these features and files survive, transform or die, and what to do with the stale Next.js line (archive it). Inputs: read origin/main's README, stores/app.ts, lib/sync.ts, server/api/*, components/orchestrator/*, worklog.md.

Input (from the closed Sensory and interaction principles ticket): judge every screen and feature against a Now card home, four lenses (Now, Today, Habits, Goals) with 3-5 items each, one fixed capture control, no badges or counts, no confirm dialogs (undo instead), 16px body text and 44px targets. The nine-tab layout in `pages/index.vue` does not survive.

Input (from the closed Life graph domain model ticket): map existing data to the new model: Task to Commitment (dependsOn and the dirty/needsClean/isHygiene flags to *requires* Links), Project to Goal, Habit stays Habit (completions to Occurrences), anchors to Background Habits, BrainDumpEntry to Idea. Decide what to do with Trips and their segments.
