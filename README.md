# Cadence

A capacity-aware daily planner: process-based scoring, resilient timers,
a drag-and-drop timeline, an Eisenhower backlog, and a morning triage ritual.

Built with **Nuxt 3 + Vue 3**, Pinia, Tailwind v4. Local-first — all data
persists in the browser via `localStorage`, no database required. A handful
of Nitro server routes back the optional AI features (task estimation, notes
parsing, voice transcription) and Google Calendar OAuth.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run preview  # preview the build
```

## Modules

- **Capacity Engine** — a daily readiness score maps to a focus-time budget.
- **Visual Timeline** — drag task blocks across a day; meal/hydration anchors are locked.
- **Idea Incubator + Triage** — Eisenhower matrix; unfinished tasks roll into triage at the day boundary (no silent rollover).
- **Resilient Timers** — pomodoro / open-flow sessions computed from wall-clock time; restored across reloads.
- **Gamification** — points for completion, focus, realism, anchor discipline, and triage streaks.
