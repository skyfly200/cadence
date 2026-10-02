---
title: Extraction spike
type: task
status: open
assignee:
blocked-by: []
parent: map.md
---
## Question

Task (HITL for the data, AFK for the run): measure how well models turn real captures into Nodes and Links. Collect 20 to 30 real transcripts or captures from the author (the original Cadence brainstorm transcript is a good start), hand-label the expected Nodes (Goal, Habit, Commitment, Idea, Thing) and Links (requires, needs, part-of, at, with), then run them through Haiku 4.5, Sonnet 5.5 and one local model using a flat nodes-plus-edges schema with confidence and evidence, validated with Zod. Record edge precision, recall and latency per model, and which cases fail.

Why it exists: it unblocks the extraction design decision (which model does extraction, and whether a local model is viable); the LLM research could not supply these numbers. It does not block the architecture, but it must finish before the extraction design is final.

## Status

Deferred (2026-10-02): not enough real captures yet. Extraction runs on Sonnet 5.5 behind the model setting and is provisional. Reassess once there are 20 to 30 real captures.
