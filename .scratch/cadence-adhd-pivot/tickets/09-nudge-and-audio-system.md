---
title: Nudge and audio system
type: grilling
status: open
assignee:
blocked-by: [01-sensory-and-interaction-principles, 04-research-adhd-design-evidence, 19-research-own-app-handsfree-voice]
parent: map.md
---
## Question

What is the minimal v1 of spoken nudges, transition rituals, and body-double presence (one voice, one announcement per transition), how does music-as-timer fit, and what guardrails stop the audio layer becoming its own rabbit hole?

Input: the ADHD design evidence research (branch research/adhd-design-evidence) grades the spoken-nudge-vs-alarm startle claim as folk wisdom and body doubling as weakly supported. Justify the audio design by sensory sensitivity and user control, and treat voice/body-double behaviours as testable hypotheses.

Input from the author: they disliked the audio Fabulous plays. Any audio must be optional, minimal, and controllable; do not assume sound is a default part of the experience.

Input (from the closed Architecture and storage ticket): closed-app nudges go by Web Push from the Nuxt server (author is on Android), triggered by a Supabase pg_cron job every minute reading a `nudge_queue`; jobs are idempotent since delivery is best effort; in-app nudges stay client-side.
